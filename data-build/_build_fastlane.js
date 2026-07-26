// fastlane deliver 用メタデータ(en-US/ja)を app/fastlane/metadata/ に生成。
// 文言は ASC申請文言_iOS.md と一致。スクショ束は別途 Bash でコピー。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../app/fastlane/metadata');

const EN_DESC = `Know exactly how ready you are to pass the JLPT — and raise that readiness a little more every day.

Mainichi JLPT turns the vague goal of "passing" into a clear daily number. A readiness gauge estimates how prepared you are, broken down into the three sections the real exam scores: Language Knowledge (vocabulary, kanji, grammar), Reading, and Listening. Because the JLPT requires a minimum score in each section, the app surfaces your weakest section first — so you always study what actually moves your result.

A FEW MINUTES A DAY
Short daily sessions fit a real schedule. Practice vocabulary, kanji, grammar, mini-reading, and mini-listening, with spaced repetition that brings back the items you're about to forget and eases off the ones you've mastered.

EVERYTHING IN ONE PLACE
• Vocabulary, kanji, and grammar with example sentences
• Furigana and clear kanji readings (on'yomi / kun'yomi)
• Mini reading and listening practice every day
• Full mock tests to check your level
• Streaks, growth charts, and badges to keep you motivated

STUDY IN YOUR LANGUAGE
The interface is available in 10 languages: English, Japanese, Nepali, Vietnamese, Burmese, Indonesian, Korean, Chinese, Bengali, and Thai.

WORKS OFFLINE
Vocabulary, kanji, grammar, and reading work fully offline. Listening audio can be downloaded per level, so you can study on the train or on a plane.

LEVELS
Currently supports N5, N4, and N3, with content that keeps growing.

Free to use. Start today and watch your readiness climb.

Mainichi JLPT is an independent study app and is not affiliated with or endorsed by the Japan Foundation or the official JLPT.`;

const JA_DESC = `「いま受けたら、受かる？」――その答えを、数字で。

まいにちJLPTは、ばくぜんとした「合格」という目標を、毎日見える「準備度」に変えるアプリです。本番と同じ3区分――言語知識（語彙・漢字・文法）／読解／聴解――ごとに、あなたの準備度をゲージで表示します。JLPTは区分ごとに基準点があるため、いちばん弱い区分を最前面に。だから、合格に直結する学習だけに集中できます。

■ 1日数分でいい
短い毎日の学習が、忙しい生活にフィットします。語彙・漢字・文法・ミニ読解・ミニ聴解を、忘れかけた項目をちょうど良いタイミングで復習する「間隔反復」で。覚えた項目は出題をひかえめにします。

■ これひとつで
・例文つきの語彙・漢字・文法
・ふりがな＆わかりやすい漢字の読み（音読み／訓読み）
・毎日のミニ読解・ミニ聴解
・実力チェックの模試
・継続記録・成長グラフ・バッジ

■ あなたの言語で
英語・日本語・ネパール語・ベトナム語・ミャンマー語・インドネシア語・韓国語・中国語・ベンガル語・タイ語の10言語に対応。

■ オフライン対応
語彙・漢字・文法・読解はオフラインで利用できます。聴解音声はレベルごとにダウンロードでき、電車や飛行機の中でも学べます。

■ 対応レベル
現在 N5・N4・N3 に対応。コンテンツは順次拡充していきます。

無料で使えます。今日から始めて、準備度が上がっていくのを見てください。

※本アプリは独立した学習アプリであり、国際交流基金および公式のJLPTとは関係ありません。`;

const M = {
  'en-US': {
    'name.txt': 'Mainichi JLPT',
    'subtitle.txt': 'Pass readiness, raised daily',
    'keywords.txt': 'japanese,nihongo,n5,n4,n3,kanji,vocabulary,grammar,listening,reading,furigana,flashcards,srs,exam',
    'promotional_text.txt': 'See how ready you are to pass the JLPT — then raise that score every day with short sessions in kanji, vocabulary, grammar, reading, and listening.',
    'description.txt': EN_DESC,
    'support_url.txt': 'https://www.safa-lang.com/jlpt/en',
    'marketing_url.txt': 'https://www.safa-lang.com/jlpt/en',
    'privacy_url.txt': 'https://www.safa-lang.com/jlpt/en/privacy/',
  },
  ja: {
    'name.txt': 'まいにちJLPT',
    'subtitle.txt': '合格準備度を、毎日すこしずつ上げる',
    'keywords.txt': '日本語能力試験,日本語,N5,N4,N3,漢字,語彙,単語,文法,聴解,読解,ふりがな,模試,試験対策,過去問,日本語学習,リスニング',
    'promotional_text.txt': 'JLPTに今どれくらい受かりそうか――その「準備度」を見える化。語彙・漢字・文法・読解・聴解を毎日少しずつ。いちばん弱い区分から、合格に直結する学習を積み上げます。',
    'description.txt': JA_DESC,
    'support_url.txt': 'https://www.safa-lang.com/jlpt/ja',
    'marketing_url.txt': 'https://www.safa-lang.com/jlpt/ja',
    'privacy_url.txt': 'https://www.safa-lang.com/jlpt/ja/privacy/',
  },
};

for (const [loc, files] of Object.entries(M)) {
  const dir = path.join(ROOT, loc);
  fs.mkdirSync(dir, { recursive: true });
  for (const [fn, txt] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, fn), txt, 'utf8');
    const lim = { 'name.txt': 30, 'subtitle.txt': 30, 'keywords.txt': 100, 'promotional_text.txt': 170, 'description.txt': 4000 }[fn];
    const len = [...txt].length;
    console.log(`${loc}/${fn}: ${len}${lim ? '/' + lim + (len > lim ? ' ⚠OVER' : '') : ''}`);
  }
}
console.log('done →', ROOT);
