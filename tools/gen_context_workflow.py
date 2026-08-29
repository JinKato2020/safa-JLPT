# -*- coding: utf-8 -*-
"""文脈規定の作り直しWorkflowスクリプトを生成する。
- データは args を使わずJSリテラルで埋め込む（args=undefined で全滅した事故の再発防止）
- 改行はLFのみ（CRLFはWorkflowが control characters として拒否する）
使い方: python tools/gen_context_workflow.py N4
"""
import io, json, os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv[1:]
GEN_ONLY = '--gen-only' in argv                 # 生成のみ（反証・修正エージェントを付けない）
argv = [a for a in argv if not a.startswith('--')]
LEVEL = (argv[0] if argv else 'N4').upper()
# エージェント総数を30前後に収める（N4=300語/30問=10バッチ×3段=30体で実測1.0M）
BATCH = {'N4': 18, 'N3': 40, 'N5': 10}.get(LEVEL, 30)  # 各級≒10バッチ=1バッチ10%=完了ごとjournal保存(CLAUDE.md#11)
LIMIT = int(argv[1]) if len(argv) > 1 else None  # パイロット: 先頭N語だけ回す

# 級ごとの形式。公式PDFの実読から（問題対策と問題作成.md）。N4とN3は別物なので混ぜない。
LEVEL_SPEC = {
    'N4': r'''- **分かち書きはしない**。漢字はそのまま書く(**ルビは後で機械が振るので書かない**)
- **和語動詞・イ形容詞・基本漢語(予約/招待)・時の副詞**が中心
- **鍵はやや明示的でよい**（「チケットを」のような具体的な手がかり）
- 文は概ね15〜35字。**会話形式も可**(A「…」B「…〔　〕…」)
- 場面は日常（学校・店・家・駅）''',
    'N3': r'''- **分かち書きはしない**。漢字はそのまま書く(**ルビは後で機械が振るので書かない**)
- **漢語名詞が主力**（公式では11問中5問）。ほかに**受身形・擬態語・カタカナ語・複合動詞**
- **鍵は1語だけ・抽象的に**（例:「バランスよく取る」だけで「栄養」に絞る）。N4のような明示的な手がかりは置かない
- 文は概ね20〜40字。**会話形式は使わない**（N3の公式には無い）
- 場面は**社会寄り**（仕事・地域・防災・公共・報道）。ただし国・宗教・政治的に中立に''',
    'N5': r'''- **分かち書きする**（ひらがな中心・語の間に半角スペース）。漢字は使ってよい(**ルビは後で機械が振るので書かない**)
- **4択は必ず全部が同じ品詞・同じ活用形**（助数詞なら全部助数詞／て形動詞なら全部て形／い形容詞なら全部い形／漢語サ変なら全部サ変／接辞なら同種の接辞）。N5は「品詞で消す」を絶対にさせない＝これが命
- **鍵の4割は「〜から/〜ですから」で理由を明示**し結果を選ばせる（例:「とけいを わすれた から、じかんが〔わからない〕」）。残りはコロケーション（「ナイフで〔切る〕」「かぜが〔ふく〕」）
- 鍵はN3のように抽象で切らせない。**必ず文中に明示**する
- 文は概ね10〜25字・日常（学校・家・店・駅）・役割ベース
- 接辞語（〜中/〜週間/お/たち/ごろ 等）は、同種の接辞4つを揃えて選ばせる（例: 〜中/〜前/〜後/〜時）''',
}[LEVEL]

# 級ごとの見本。すべて独立の反証役を通過したもの（＝実際に一意で、当てずっぽうでは消せない）。
LEVEL_SAMPLES = {
    'N4': r'''- 「事故で電車が止まって、会議に10分〔遅れました〕。」誤答=急ぎました/間に合いました/進みました ← trick2(時間×移動)+語形そろい、key=「事故で電車が止まって」(因果)
- 「かぜをひいたので、きのうの授業を〔欠席〕しました。」誤答=出席/着席/満席 ← trick3(同漢字「席」)、key=「かぜをひいたので」(因果)
- 「授業で、江戸〔時代〕の武士の生活について習った。」誤答=時間/時刻/時期/期間/当時 ← trick3(全部「時」の語)、key=「江戸」
- 「この店の〔店員〕は、商品の使い方を丁寧に説明してくれる。」誤答=客/駅員/工員/議員 ← trick1(全部「〜員」)、key=「この店の」(所属)''',
    'N3': r'''- 「大雨のため、来週のマラソン大会は1か月後に〔延期〕された。」誤答=延長/短縮/継続 ← trick3(同漢字「延」)+trick2(全部が期間の操作)、key=「1か月後に」(時点の移動)
- 「会場の準備ができたか、係の人に〔確認〕してみた。」誤答=確保/観察/承認 ← trick4(near-miss「確」)、key=「できたか」(疑問節を取れるのは確認だけ)
- 公式の最高到達点(trick6)の型: 「子どもの成長」の話題に対し 栄養/経験/環境/教育 ＝**4つとも成長に関係する**ので分野で消せない。決め手は「バランスよく**取る**」というコロケーション1点だけ → 正解=栄養。
  **N3ではこの型を狙え。** 漢語名詞4つを同じ話題でそろえ、共起する動詞1つだけで切る。''',
    'N5': r'''- 「へやには だれも いなくて、〔一人〕でした。」誤答=一つ/一本/一まい ← trick1(全部助数詞)、key=「だれも いなくて」
- 「そらに 〔黒い〕 くもが でてきて、いまにも あめが ふりそうです。」誤答=白い/赤い/青い ← trick1(全部色のい形容詞)、key=「あめが ふりそう」
- 「とけいを わすれた〔から〕、じかんが わかりません。」誤答=まで/より/ほど ← 因果の接続助詞。「〜から」で理由→結果を選ばせるN5最頻の型
- 「くらいですから、でんきを 〔つけて〕ください。」誤答=けして/しめて/あけて ← trick1(全部て形他動詞)、key=「くらいですから」(因果)''',
}[LEVEL]

sel = json.load(io.open(os.path.join(ROOT, f'scratchpad/context_regen/select_{LEVEL}.json'), encoding='utf-8'))
# dictExample(=avoid) が入っていれば「辞書丸写し禁止」モード（select_context_reuse.py 由来）
HAS_AVOID = any(e.get('dictExample') for e in sel)
words = [{'id': e['id'], 'word': e['word'], 'oldPrompt': e['oldPrompt'],
          'avoid': e.get('dictExample', ''), 'oldChoices': e.get('oldChoices', [])} for e in sel]
if LIMIT:
    words = words[:LIMIT]  # パイロット（作り方の検証にだけ使う。率は信じない＝鉄則1）
# 大きめ集合ではエージェント数を~30(=約10バッチ×3段)に抑える
import math as _math
BATCH = max(BATCH, _math.ceil(len(words) / 10))

GEN_RULES = r'''あなたはJLPT ''' + LEVEL + r''' 「文脈規定」の作問者です。渡された語について、1語につき1問、公式と同じ型の4択問題を作ります。

## 文脈規定が測るもの（出題者の狙い）
「語を知っているか」ではなく「**文中の鍵1つに反応して、似た語の中から1つに絞れるか**」。
公式は必ず2段階で作られている。
1. **4語(正解+誤答)を何らかの軸で揃える** → 分野・品詞・語形では消せなくする(＝当てずっぽうを封じる)
2. **文中に鍵を1つだけ置く** → その鍵だけが正解を一意にする
「揃える」を怠ると当てずっぽうで解け、「鍵」を怠ると複数正解になる。この2段階が全て。

## 誤答の手口（どれかで必ず揃える。番号を trick に書く）
1. **語形をそろえる**(語頭・語末) 例: 全部「〜ました」/全部「〜つける」/全部4拍の擬態語
2. **同一意味フィールド** 例: 予約・約束・計画・予定(全部「先を決める」)
3. **同じ漢字を共有する漢語** 例: 欠席・出席・着席・満席 / 延期・延長
4. **音が近い near-miss を混ぜる** 例: しょうかい↔しょうたい / われて↔わかれて
5. **選択制限**(何と結びつくか) 例: 爪が「割れる」(壊れる=機械/破ける=紙)
6. **全部が話題に関連＝分野で消せない**(最難) コロケーション1点だけで切る

## 鍵の型（必ず1つだけ置く。key に文中から抜き出す）
- **コロケーション**:「チケットを」→予約 /「〜を測った」→体温
- **因果・論理**:「なくしてしまったので」→謝る
- **時間の向き**:「あと15分」「行きましょうか」→そろそろ
- **恒常↔一時**:「あそびに行くとき」「ホテルに」→泊まる
- **場面の限定**:「結婚式に」→招待
鍵は必ず1つ。**2つ置くと簡単になり、0だと複数正解になる。**

## ''' + LEVEL + r''' の形式
''' + LEVEL_SPEC + r'''
- 空所は必ず全角の `〔　〕`(亀甲括弧＋全角スペース)を1文に**1個だけ**

## 【誤答の文字種を正解にそろえる】
正解が漢語なら誤答も漢語、ひらがな語ならひらがな語、カタカナ語ならカタカナ語にする。
1つだけ文字種が違うと**見た目が浮いて即座に消せてしまう**。
公式は4語の文字種が90%そろっている。前回の作り直しはここが78.6%で**唯一改善できなかった弱点**なので、今回は特に意識せよ。

## 【絶対禁止】
- **荒唐無稽な分野違いダミー**。例: 正解「作法」の誤答が 湿度/酸素/時刻 ＝当てずっぽうで消せる＝測定にならない。**これが現行アプリの欠陥そのもの**
- **誤答が全部同じ向き**。例: 「悲しい」の誤答が うれしい/楽しい/おもしろい ＝全部プラス感情で1つの理屈でまとめて消える
- **個人名**。役割ベースで書く(先生/学生/店員/客/係の人/近所の人/同僚/駅員)
- 国・宗教・政治的に中立でない話題
- **正解の上位語を誤答にする** ←パイロットで実損: 正解「体温」の誤答に「温度」→「かぜかもしれないので温度を測ってみた」が成立＝第2の正解
- **多義語を誤答にする** ←パイロットで実損: 正解「都合」の誤答に「具合」→具合には"体調"だけでなく"都合"の語義がある(それでは具合が悪い)＝第2の正解

## 【必須の検算】3つとも実行してから出力する（パイロットの実損から）
**A) 一意性テスト**: 誤答を1つずつ〔　〕に入れ「**日本語母語話者がこの文をこの場面で自然に言うか**」を見る。少しでも言えたら第2の正解＝その誤答は不可。別の語に替える。
  実損: 「会議で新しい計画が〔認められ〕、来月から始まる」の誤答「比べられ」→比較→採用→開始で矛盾せず成立＝第2の正解
**B) 鍵が効くか検算**: 鍵を隠しても解けるなら、その鍵は飾り＝作り直す。
  実損: 「食事が終わったので、テーブルの上を〔片づけました〕」誤答=見つけました/気をつけました/近づけました → 一意だが「食事が終わったので」が全く働かず〜つける系の語形遊びだけで消せる＝測定力なし
**C) 文の照応を点検**: 主語・目的語・指示対象が食い違っていないか。
  実損: 「重いかばんを長く持っていたので、ふくろの持つところが切れて」→かばんとふくろが別物で文が破綻
**D) 鍵が【決定的】か検算**: 鍵が弱いと、同じ分野の語が全部通ってしまい誤答が1個も作れない。
  実損: 「あの会社は、外国と自動車の〔貿易〕をして大きくなった」→鍵が「外国と」だけ。輸入・輸出・販売・交流が**全部**「外国と（組んで）〜する」と読めて成立＝誤答が0個になり問題ごと廃棄。
  → 鍵は「その語**だけ**が満たす条件」にせよ。「外国と」ではなく「品物を外国へ売り、外国から買う」のように**語の定義を分解して文に埋める**。
**E) 助詞・活用だけで消せる誤答を作るな**: 語の意味を知らなくても文法だけで消せる＝語彙力を測れない。
  実損: 「この学校は毎年三月に卒業式を〔行います〕」誤答=参加します/集まります → 「式**に**参加する」で格が合わないだけ＝**意味を知らずに消せる**。
  一方で「手伝います/見学します」は格が通るので**第2の正解**になった。→ **他動詞は全部通り、通らないものは文法で消える＝この設計は成立しない。文から作り直せ。**

## 承認済みの見本（この水準で書く。すべて独立の反証役を通過したもの）
''' + LEVEL_SAMPLES + r'''

## answer の形
`answer` は**〔　〕にそのまま入る表記**にする。辞書形が自然に入る文を書くのが原則だが、活用が必要なら活用形でよい(例: word=遅れる → answer=遅れました)。
その場合 **誤答5個も必ず同じ活用形に揃える**(急ぎました/間に合いました/…)。揃っていないと語形で消せてしまう。

## 誤答の個数
**5個**作る。あとで独立の反証役が第2の正解を削除し、残った中から3個を使う。
**5個ひねり出すために一意性を犠牲にするな。第2の正解を作るくらいなら4個で出し、needsDrop=true と申告せよ。**減らすのは正当な判断で減点ではない。

## 解説は書かない（不要）

## 参考: oldPrompt
`oldPrompt` は**現行の低品質な問題文**。**語義の取り違えを防ぐ参考にのみ使う**(その語をどの意味で問うているか)。文体・誤答は真似しないこと。'''

AVOID_BLOCK = r'''## 【最重要・今回の主目的】辞書例文の丸写しを禁止する
各語には `avoid`（辞書の例文）が付いている。現行アプリの問題はこの avoid をほぼ丸写しして語を〔　〕に空けただけの低品質問題で、**それを作り直すのが今回の目的**。
- **avoid とは違う場面・違う文を新しく書く**。同じ語義・同じ品詞は保つが、状況／登場人物／コロケーション／文の骨格を変える。
- avoid と文型・語順・鍵が同じなら不合格。読み手が「別の例文だ」と分かる新しさを出す。
- ただし avoid の**語義**は正しい手がかり。その語をどの意味で問うているかは avoid で確認する。

## 参考: oldChoices（既存の誤答）
各語には `oldChoices`（現行の誤答）が付いている。
- **新しい文でも「第2の正解」にならず、上の誤答設計ルール(軸で揃う/文字種そろい)を満たす誤答は流用してよい**。
- 新しい文で成立してしまう・当てずっぽうで消せる・軸が揃わないものは**捨てて**、誤答設計ルールで作り直す。
- 誤答設計ルール（一意性・文字種そろい・trick）が最優先。oldChoices はあくまで叩き台。'''

if HAS_AVOID:
    GEN_RULES = GEN_RULES + '\n\n' + AVOID_BLOCK

VERIFY_RULES = r'''あなたはJLPT「文脈規定」問題の【独立の反証役】です。目的は【第2の正解】を暴くことだけです。作った本人ではないので、遠慮なく厳しく判定してください。

## 文脈規定とは
`prompt` の `〔　〕` に入る語を4択(正解1＋誤答3)から選ぶ問題。誤答プールから毎回3個が抽選される。
**正解が文脈で一意に定まらなければ不良問題**です。

## 判定手順（各問・各誤答について必ず実行）
1. `answer` と各 `choices`(誤答候補) を `〔　〕` に1つずつ代入する。
2. 「**日本語母語話者がこの文をこの場面で自然に言うか**」を判定する。少しでも自然に成立するなら、その誤答は **valid**(＝第2の正解＝削除対象)。
3. **基準は「疑わしきは valid」**。甘い反証は無意味です。「やや不自然だが言えなくはない」は **valid** にしてください。
4. `answer` すら不自然、または文自体が破綻している(主語と目的語の照応ズレ等)なら `verdict='bad_answer'`。

## 見逃されやすい型（この水準の重なりは必ず valid とせよ）
- **上位語**: 正解「体温」に対する「温度」…「かぜかもしれないので温度を測ってみた」は成立＝valid
- **多義語**: 正解「都合」に対する「具合」…「具合が悪い」は"都合が悪い"の意味でも言う＝valid
- **論理が通ってしまう語**: 正解「認められ」に対する「比べられ」…「計画が比べられ、来月から始まる」は矛盾しない＝valid
- 実例: 「刷る/印刷する」に対する「コピーする」/「活気/活力」に対する「熱気」「エネルギー」＝valid

## verdict
- valid が1個以上 → `multi`
- どの誤答も成立しない → `unique`
- answer すら不自然・文が破綻 → `bad_answer`

## 損害は非対称（判断に迷ったときの指針）
良い誤答を誤って valid にして消す＝**軽微**(5個作ってあり3個あれば足りる)。
第2の正解を見逃す＝**不良問題を出荷**＝重大。**迷ったら valid にせよ。**

## 出力
各問について {id, validChoices(第2の正解になっている誤答の文字列を全部), verdict, note(validなものは代入した自然な文を必ず示す)}'''

REPAIR_RULES = r'''あなたはJLPT ''' + LEVEL + r''' 「文脈規定」問題の【独立の検証＋修理役】です。作った本人ではありません。各問について【正解が文脈で一意に決まるか】を厳しく判定し、崩れていれば**その場で直して最終版を返します**。

## 検証（各誤答について必ず実行）
1. answer と各誤答を〔　〕に代入し「**日本語母語話者がこの文をこの場面で自然に言うか**」を見る。少しでも成り立つ誤答は【第2の正解】＝不良。**疑わしきは不良**。
2. 見逃されやすい重なり（必ず不良とせよ）: 上位語(体温↔温度)、多義語(都合↔具合)、論理が通ってしまう語(認められ↔比べられ)、実例「刷る/印刷する↔コピーする」「活気/活力↔熱気」。
3. **当てずっぽうで消せる**荒唐無稽ダミー(分野違い・場違い)も不良。例: 正解「作法」に 湿度/酸素/時刻。
4. answer 自体が不自然・文が破綻(主語と目的語の照応ズレ等)＝正解ごと不適。その場合は本文を作り直して一意化する。

## 修理（崩れている問だけ・その場で）
- 不良誤答は【同カテゴリ・同品詞・同語形の綺麗な近接語】へ差し替えて一意化(near-missを最低1つ残す)。荒唐無稽・上位語・多義語・正解の同義語にはしない。
- 【差し替えだけで一意化できない／answerが構造的に近接誤答を作れない時は、本文を書き換えて帳尻を合わせる】: 鍵(コロケーション/因果/時間の向き/恒常↔一時/場面限定)を1つ足す・入れ替える、語順や語句を直す、場面を変える。**目的＝正解だけが一意に決まり、4語が軸で揃い、本文が自然につながること**。
- 保つ: 題材の骨子・''' + LEVEL + r'''相当の難度・ボーダーレス(個人名なし・役割ベース)・空所〔　〕は1文に1個・''' + LEVEL + r'''の形式(上の「''' + LEVEL + r''' の形式」に従う)。ルビは書かない(後で機械が振る)。

## 【鉄則3】自分の修理を必ず再確認
差し替えた新しい誤答を1つずつ〔　〕に入れ直し、**第2の正解が生まれていないか**を確認してから返す。

## 誤答の個数
最終の誤答は**4個**(一意な4個目が無理なら3個でよい＝減らすのは正当)。5個は要らない。正解は choices に含めない。

## 返し方(StructuredOutputのみ)
各問 {id, status(無修正='ok' / 修理した='fixed'), prompt(最終・〔　〕1個・ルビ無し), answer(最終), choices(最終の誤答のみ3〜4個・正解を含めない), trick(使った手口1-6), key(文中の鍵), note(第2正解だったもの＋何を直したか。okは空でよい)}'''

GEN_SCHEMA = {
    'type': 'object',
    'required': ['items'],
    'properties': {
        'items': {
            'type': 'array',
            'items': {
                'type': 'object',
                'required': ['id', 'word', 'prompt', 'answer', 'choices', 'trick', 'key'],
                'properties': {
                    'id': {'type': 'string'},
                    'word': {'type': 'string'},
                    'prompt': {'type': 'string', 'description': '〔　〕を1個だけ含む問題文。ルビは書かない'},
                    'answer': {'type': 'string', 'description': '〔　〕にそのまま入る表記'},
                    'choices': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 4, 'maxItems': 5,
                                'description': '誤答のみ。正解を含めない'},
                    'trick': {'type': 'string', 'description': '使った手口の番号(1-6)'},
                    'key': {'type': 'string', 'description': '文中から抜き出した鍵'},
                    'needsDrop': {'type': 'boolean', 'description': '一意な5個目が作れず4個にした場合true'},
                },
            },
        },
    },
}

VERIFY_SCHEMA = {
    'type': 'object',
    'required': ['results'],
    'properties': {
        'results': {
            'type': 'array',
            'items': {
                'type': 'object',
                'required': ['id', 'validChoices', 'verdict'],
                'properties': {
                    'id': {'type': 'string'},
                    'validChoices': {'type': 'array', 'items': {'type': 'string'}},
                    'verdict': {'type': 'string', 'enum': ['unique', 'multi', 'bad_answer']},
                    'note': {'type': 'string'},
                },
            },
        },
    },
}

REPAIR_SCHEMA = {
    'type': 'object',
    'required': ['items'],
    'properties': {
        'items': {
            'type': 'array',
            'items': {
                'type': 'object',
                'required': ['id', 'status', 'prompt', 'answer', 'choices'],
                'properties': {
                    'id': {'type': 'string'},
                    'status': {'type': 'string', 'enum': ['ok', 'fixed']},
                    'prompt': {'type': 'string', 'description': '〔　〕を1個だけ含む最終問題文。ルビは書かない'},
                    'answer': {'type': 'string', 'description': '〔　〕にそのまま入る最終表記'},
                    'choices': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 3, 'maxItems': 4,
                                'description': '最終の誤答のみ。正解を含めない'},
                    'trick': {'type': 'string'},
                    'key': {'type': 'string'},
                    'note': {'type': 'string'},
                },
            },
        },
    },
}

batches = [words[i:i + BATCH] for i in range(0, len(words), BATCH)]

js = f'''export const meta = {{
  name: 'context-{LEVEL.lower()}-regen',
  description: '文脈規定{LEVEL} {len(words)}問を作問（生成→反証+修正→再反証）',
  phases: [
    {{ title: '生成', detail: '{BATCH}問×{len(batches)}体・Opus high・誤答5個' }},
    {{ title: '反証+修正', detail: '第2正解/場違いを検出→近接語へ差替・必要なら本文書換（鉄則3自己確認）' }},
    {{ title: '再反証', detail: '修理済みを再検査し残った第2正解のみ削除（3個未満は人手送り）' }},
  ],
}}

const GEN_RULES = {json.dumps(GEN_RULES, ensure_ascii=False)}
const REPAIR_RULES = {json.dumps(REPAIR_RULES, ensure_ascii=False)}
const VERIFY_RULES = {json.dumps(VERIFY_RULES, ensure_ascii=False)}
const GEN_SCHEMA = {json.dumps(GEN_SCHEMA, ensure_ascii=False)}
const REPAIR_SCHEMA = {json.dumps(REPAIR_SCHEMA, ensure_ascii=False)}
const VERIFY_SCHEMA = {json.dumps(VERIFY_SCHEMA, ensure_ascii=False)}
const BATCHES = {json.dumps(batches, ensure_ascii=False)}

// 反証の結果を「削除のみ」で適用する。追加しないので新しい第2の正解は構造的に入らない。
function applyDeletions(items, v, pass) {{
  const byId = new Map()
  if (v && Array.isArray(v.results)) for (const r of v.results) byId.set(r.id, r)
  const kept = []
  const flagged = []
  for (const it of items) {{
    const r = byId.get(it.id)
    if (!r) {{ kept.push(it); continue }}          // 判定漏れは温存（勝手に壊さない）
    if (r.verdict === 'bad_answer') {{ flagged.push({{ ...it, issue: 'bad_answer', note: r.note, pass }}); continue }}
    const bad = new Set(r.validChoices || [])
    const left = it.choices.filter((c) => !bad.has(c))
    if (left.length < 3) {{ flagged.push({{ ...it, issue: 'under3', left, note: r.note, pass }}); continue }}
    kept.push({{ ...it, choices: left }})
  }}
  return {{ kept, flagged }}
}}

const out = await pipeline(
  BATCHES,
  // ① 生成（誤答5個）
  (batch, _orig, i) =>
    agent(GEN_RULES + '\\n\\n## 対象語(' + batch.length + '語)\\n' + JSON.stringify(batch),
      {{ label: 'gen:b' + (i + 1), phase: '生成', schema: GEN_SCHEMA, effort: 'high' }}),
  // ② 反証＋修正（削除でなく直す。必要なら本文も書換＝ユーザー指定フロー）
  (gen, batch, i) => {{
    if (!gen || !Array.isArray(gen.items) || !gen.items.length) {{
      log('gen:b' + (i + 1) + ' が空を返した（harvestで救済対象）')
      return {{ items: [], genEmpty: true }}
    }}
    const probe = gen.items.map((x) => ({{ id: x.id, word: x.word, prompt: x.prompt, answer: x.answer, choices: x.choices, trick: x.trick, key: x.key }}))
    return agent(REPAIR_RULES + '\\n\\n## 検査・修理対象(' + probe.length + '問)\\n' + JSON.stringify(probe),
      {{ label: 'fix:b' + (i + 1), phase: '反証+修正', schema: REPAIR_SCHEMA, effort: 'high' }})
      .then((rep) => ({{ items: (rep && Array.isArray(rep.items)) ? rep.items : [], genEmpty: false }}))
  }},
  // ③ 再反証（修理済みを再検査・削除のみ＝鉄則3）
  (rep, batch, i) => {{
    if (!rep || !Array.isArray(rep.items) || !rep.items.length) return {{ kept: [], flagged: [], genEmpty: rep && rep.genEmpty }}
    const probe = rep.items.map((x) => ({{ id: x.id, prompt: x.prompt, answer: x.answer, choices: x.choices }}))
    return agent(VERIFY_RULES + '\\n\\n## 検査対象(' + probe.length + '問)\\n' + JSON.stringify(probe),
      {{ label: 'reverify:b' + (i + 1), phase: '再反証', schema: VERIFY_SCHEMA }})
      .then((v) => applyDeletions(rep.items, v, 2))
  }},
)

const good = out.filter(Boolean).flatMap((r) => r.kept || [])
const flagged = out.filter(Boolean).flatMap((r) => r.flagged || [])
const emptyBatches = out.filter(Boolean).filter((r) => r.genEmpty).length
log('確定=' + good.length + '問 / 人手送り=' + flagged.length + '問 / 空バッチ=' + emptyBatches)
return {{ level: '{LEVEL}', good, flagged, emptyBatches }}
'''

if GEN_ONLY:
    # 生成のみ（反証・修正エージェントを付けない＝ユーザー指定）。生成の自己検算(A〜E)だけで確定。
    js = f'''export const meta = {{
  name: 'context-{LEVEL.lower()}-genonly',
  description: '文脈規定{LEVEL} {len(words)}問を生成のみ（反証・修正なし）',
  phases: [
    {{ title: '生成', detail: '{BATCH}問×{len(batches)}体・Opus high・誤答5個・自己検算のみ' }},
  ],
}}

const GEN_RULES = {json.dumps(GEN_RULES, ensure_ascii=False)}
const GEN_SCHEMA = {json.dumps(GEN_SCHEMA, ensure_ascii=False)}
const BATCHES = {json.dumps(batches, ensure_ascii=False)}

const out = await pipeline(
  BATCHES,
  (batch, _orig, i) =>
    agent(GEN_RULES + '\\n\\n## 対象語(' + batch.length + '語)\\n' + JSON.stringify(batch),
      {{ label: 'gen:b' + (i + 1), phase: '生成', schema: GEN_SCHEMA, effort: 'high' }}),
)
const good = out.filter(Boolean).flatMap((r) => (r && Array.isArray(r.items)) ? r.items : [])
const emptyBatches = out.filter(Boolean).filter((r) => !r || !Array.isArray(r.items) || !r.items.length).length
log('生成=' + good.length + '問（反証・修正なし）/ 空バッチ=' + emptyBatches)
return {{ level: '{LEVEL}', good, flagged: [], emptyBatches }}
'''

STAGES = 1 if GEN_ONLY else 3
out = os.path.join(ROOT, f'scratchpad/context_regen/wf_context_{LEVEL}.mjs')
with io.open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)

# CRLF混入の検査（テキストモードでは\rが見えないのでバイナリで読む）
raw = io.open(out, 'rb').read()
assert b'\r' not in raw, 'CRLFが混入した（Workflowが拒否する）'
print(f'出力: {out}')
print(f'  語数={len(words)} バッチ={len(batches)}(各{BATCH}問) 予定エージェント数={len(batches)*STAGES}体{" (生成のみ)" if GEN_ONLY else ""}')
print(f'  ファイルサイズ={len(raw)/1024:.0f}KB / CR混入なし')
print(f'  先頭データ: {json.dumps(batches[0][0], ensure_ascii=False)}')
print(f'  末尾データ: {json.dumps(batches[-1][-1], ensure_ascii=False)}')
