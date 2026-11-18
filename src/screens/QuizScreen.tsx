import StudyLayout from '../components/StudyLayout';
import StudyChoiceList from '../components/StudyChoiceList';
import StudyPrompt, { StudyInstruction } from '../components/StudyPrompt';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, type StyleProp, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { spacing, type as ty, type ThemeColors } from '../theme';
import { useStudyColors } from '../components/StudyPresentation';
import AppButton from '../components/AppButton';
import { useAppState, useAppActions } from '../store/store';
import { type SaveRef } from '../store/state';
import { progressSnapshot } from '../store/selectors';
import { useT, meaningL1, pickTr } from '../i18n';
import AfterStudyReward from '../components/AfterStudyReward';
import AnswerFooter from '../components/AnswerFooter';
import { walletPoints } from '../store/wallet';
import { resolveStudiedWords, type StudiedQuestion } from '../data/studiedWords';

import DevIdPicker from '../components/DevIdPicker';
import { itemsFor, allWordsFor, rubyNeeded } from '../data';
import { buildQueue, buildUnitQueue, makeQuestion, EXAM_FORMATS } from '../quiz/quiz';
import { daimonUnitIds, questionForUnit, learnCardFor, expressionUnitIds, MOJI_DAIMON, BUNPOU_DAIMON, type LearnCard } from '../data/daimon';
import { selectReview } from '../review/selectReview';
import { unitForPick } from '../review/reviewQuestion';
import type { StudyItem } from '../data';
import type { Category } from '../engine/engine';
import type { RootStackParamList } from '../navigation/types';
import RubyText from '../components/RubyText';
import { useSessionGate } from '../pro/useSessionGate';
import LimitReachedSheet from '../pro/LimitReachedSheet';

// 学習カードの例文を表示。ふりがな「漢字（かな）」はレベル適応ルビ、対象部「【…】」は括弧を外して下線に統一。
function LearnText({ text, target: explicitTarget, style, hitStyle, rubyStyle, rubyGate }: { text: string; target?: string; style: StyleProp<TextStyle>; hitStyle: StyleProp<TextStyle>; rubyStyle: StyleProp<TextStyle>; rubyGate: (run: string) => boolean }) {
  // ふりがな=「かな」が入った括弧のみルビ化する。訳文中の半角(補足)…例: ネパール語 "(आदरार्थी)" や英語 "(honorific)"…は
  // かな以外なのでルビ化しない(Devanagari等はルビ処理で母音記号が土台から外れ ◌ に化けるため)。全角・半角どちらの括弧も対象。
  const hasFuri = /[（(][ぁ-ゖァ-ヶー]+[）)]/.test(text);
  if (hasFuri) {
    const m = text.match(/【([\s\S]+?)】/);
    // 【…】があればそれを下線対象に、無ければ明示targetを使う(⑤用法=活用語も追従)。
    const target = m ? m[1].replace(/[（(][^）)]*[）)]/g, '') : (explicitTarget ?? ''); // 対象語のふりがなを除いた素の語でマッチ
    const body = text.replace(/[【】]/g, ''); // 括弧を外し、中身は下線対象(target)として渡す
    return <RubyText text={body} target={target} style={style} hitStyle={hitStyle} rubyStyle={rubyStyle} rubyGate={rubyGate} center />;
  }
  // ふりがな無し=従来Text。【…】は下線に。
  return <Text style={style}>{text.split(/【(.+?)】/).map((p, i) => (i % 2 === 1 ? <Text key={i} style={hitStyle}>{p}</Text> : p))}</Text>;
}

const SESSION_SIZE = 10;
// 文法ミックス出題用の大問(passage_grammarはセット形式=questionForUnitで単問化できないため除外。専用画面PassageGrammarScreenへ)。
const MIX_BUNPOU_DAIMON = BUNPOU_DAIMON.filter((d) => d !== 'passage_grammar');

function poolFor(level: 'N5' | 'N4' | 'N3', cat: Category | 'all'): StudyItem[] {
  if (cat === 'all') return [...itemsFor(level, 'moji_goi'), ...itemsFor(level, 'bunpou')];
  return itemsFor(level, cat);
}
// 「全区分の復習」は区分ごとにキューを作り交互に混ぜる(SRS期限切れが1区分に偏らない=本当に全区分から出す)。
function buildAllQueue(level: 'N5' | 'N4' | 'N3', items: Parameters<typeof buildQueue>[1], now: number): StudyItem[] {
  const a = buildQueue(itemsFor(level, 'moji_goi'), items, now, SESSION_SIZE);
  const b = buildQueue(itemsFor(level, 'bunpou'), items, now, SESSION_SIZE);
  const out: StudyItem[] = [];
  for (let i = 0; out.length < SESSION_SIZE && (i < a.length || i < b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (out.length < SESSION_SIZE && i < b.length) out.push(b[i]);
  }
  return out;
}

export default function QuizScreen() {
  const nav = useNavigation();
  // 1日の回数ゲート(共通)。GATING_ENABLED=false の間は素通りする。
  const gate = useSessionGate();
  const [gateAllowed, setGateAllowed] = useState<boolean | null>(null);
  useEffect(() => { setGateAllowed(gate.begin()); }, []); // 画面に入った時に1回だけ
  const route = useRoute<RouteProp<RootStackParamList, 'Quiz'>>();
  const category = route.params?.category ?? 'all';
  const itemIds = route.params?.itemIds;
  const review = route.params?.review; // 面別マスタリー統合復習(既習の苦手な面だけを忘却曲線で)
  const sessionSize = route.params?.firstLesson ? 5 : SESSION_SIZE;
  const paramTitle = route.params?.title;
  const daimon = route.params?.daimon; // 大問学習(本番の大問を固定形式で連続出題・状態は「項目#大問」キー)
  const expression = route.params?.expression; // JFT会話と表現(場面→適切な表現)
  const state = useAppState();
  const { settings, items } = state;
  const { quizAnswer, addToMyList } = useAppActions();
  const c = useStudyColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  const title = review ? t('review.title') : paramTitle; // 復習はヘッダー名を「試験問題の復習」に
  // レベル適応ルビ: ユーザーのレベル以上(同レベル含む)の漢字群にだけ読みを振る。
  const rubyGate = (run: string) => rubyNeeded(run, settings.level);

  // 誤答プール＆弱点ドリルの照合は全語(学習＋模試専用)。出題キュー(category)は学習のみ=poolFor。
  const pool = useMemo(() => [...allWordsFor(settings.level, 'moji_goi'), ...allWordsFor(settings.level, 'bunpou')], [settings.level]);
  // 大問モードはユニットid(string)、それ以外はStudyItemのキュー。
  const [queue, setQueue] = useState<(StudyItem | string)[]>(() => {
    if (review) {
      // 面別マスタリー統合復習: 既習の苦手な面を弱い順に選び、描ける面だけを unit にして出題。
      // listen/漢字書き取り等の描けない面は読み飛ばすため多めに選んで先頭 SESSION_SIZE 件。
      const picks = selectReview(state.mastery ?? {}, Date.now(), SESSION_SIZE * 2);
      const reviewQ = picks.map((p) => unitForPick(p.itemId, p.facet, Math.random)).filter((u): u is string => !!u).slice(0, SESSION_SIZE);
      if (reviewQ.length > 0) return reviewQ;
      // 苦手な単語がまだ無い(未学習 or 期限内)=その級の頻出単語(語彙)を順番に出す。
      //  buildQueueが未習・低習得を優先=自然に頻出順の先頭から進み、解くほど苦手が記録され次回の復習の種になる。
      return buildQueue(itemsFor(settings.level, 'moji_goi'), items, Date.now(), SESSION_SIZE);
    }
    if (expression) return buildUnitQueue(expressionUnitIds(), items, Date.now(), SESSION_SIZE);
    if (daimon) return buildUnitQueue(daimonUnitIds(settings.level, daimon, 'learn'), items, Date.now(), sessionSize);
    if (itemIds && itemIds.length) {
      // 模試の弱点ドリルも復習/学習と同じ検証済みバンクから出す。idは模試が daimonUnitIds→questionForUnit で
      // 出した検証済みユニット＝文字列のまま questionForUnit で描く(makeQuestionの自動生成＝文法2正解バグ源を通さない)。
      return itemIds.filter((id) => !!questionForUnit(id));
    }
    // 学習(バランス/カテゴリ)も検証済の大問バンクから出題(makeQuestionの曖昧な意味当てクイズを廃止＝一意性確保)。
    // 文章の文法(passage_grammar)は questionForUnit で解決できないセット形式なので、ミックス出題からは除外(専用のPassageGrammarScreenへ)。
    const daimons = category === 'moji_goi' ? MOJI_DAIMON : category === 'bunpou' ? MIX_BUNPOU_DAIMON : [...MOJI_DAIMON, ...MIX_BUNPOU_DAIMON];
    return buildUnitQueue(daimons.flatMap((d) => daimonUnitIds(settings.level, d, 'learn')), items, Date.now(), SESSION_SIZE);
  });
  // 大問モード=4択の前に「学習カード」で自習(スキップ可)。学習する語=初期キューと同じ。
  const [learnList] = useState<{ unit: string; card: LearnCard }[]>(() =>
    daimon
      ? (queue.filter((x): x is string => typeof x === 'string'))
          .map((u) => ({ unit: u, card: learnCardFor(u, meaningL1(settings)) }))
          .filter((x): x is { unit: string; card: LearnCard } => !!x.card)
      : [],
  );
  const [phase, setPhase] = useState<'learn' | 'test'>(() => (daimon && learnList.length ? 'learn' : 'test'));
  const [idx, setIdx] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false); // 開発用: 問題IDタップで同じ大問の全問へジャンプ
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [before] = useState(() => progressSnapshot(state, Date.now()));
  const [walletStart] = useState(() => walletPoints(state));
  const [studiedRefs, setStudiedRefs] = useState<{ ref?: SaveRef; correct: boolean; q?: StudiedQuestion }[]>([]); // この回に学習した語(終了時にまとめて私の単語帳へ・正誤も)＋問題スナップショット(正誤表の振り返り用)。refが無い(辞書に無い)問題も記録する

  // 【開発用】同じ大問の全問へジャンプ(問題IDタップ)。開発ビルド or 7回タップで解禁した端末のみ。大問モードのみ有効。
  const devTools = __DEV__ || state.settings.devToolsUnlocked === true;
  const canDevPick = devTools && !!daimon;
  const devIds = useMemo(
    () => (canDevPick && daimon ? daimonUnitIds(settings.level, daimon, 'all') : []),
    [canDevPick, daimon, settings.level],
  );
  const jumpTo = (unit: string) => {
    if (!daimon) return;
    const all = daimonUnitIds(settings.level, daimon, 'all');
    const pos = all.indexOf(unit);
    if (pos < 0) return;
    setQueue(all);
    setIdx(pos);
    setPicked(null);
    setPickerOpen(false);
  };

  const item = queue[idx];
  const answerId = typeof item === 'string' ? item : item?.id; // quizAnswer/SRSのキー(大問=項目#大問)
  const question = useMemo(
    () => (!item ? null : typeof item === 'string' ? questionForUnit(item) : makeQuestion(item, pool, Math.random, EXAM_FORMATS)),
    [answerId, idx], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 解答後は自動で進めず、解説を確認してから「次へ」で進む(ユーザー要望: 回答後に解説を読める)。
  const advance = () => {
    setPicked(null);
    setIdx((i) => i + 1);
  };

  if (gateAllowed === null) return null;
  if (!gateAllowed) return <LimitReachedSheet onClose={() => nav.goBack()} />;

  // 学習フェーズは同じセットのカードを縦一覧で読む。開始ボタンは一覧の上と下に置く。
  if (phase === 'learn') {
    const goTest = () => setPhase('test');
    const startButton = (position: 'top' | 'bottom') => (
      <Pressable testID={`learn-start-${position}`} accessibilityRole="button" onPress={goTest}
        style={({ pressed }) => [s.learnStart, pressed && { opacity: 0.8 }]}>
        <Text style={s.learnStartText}>{t('quiz.learn_start')}</Text>
      </Pressable>
    );
    return (
      <StudyLayout title={[t('quiz.learn_tag'), title].filter(Boolean).join(' · ')} current={0} total={learnList.length}
        countLabel={t('quiz.learn_count', { n: learnList.length })} showProgress={false}
        scrollKey="learn-list" onClose={() => nav.goBack()}>
        {startButton('top')}
        <StudyInstruction>{t('quiz.learn_scroll')}</StudyInstruction>
        {learnList.map(({ unit, card: lc }, i) => (
          <View key={`${unit}-${i}`} testID="learn-card">
            <StudyPrompt>
              <Text style={s.learnNumber}>{String(i + 1).padStart(2, '0')} / {learnList.length}</Text>
              {lc.title ? <LearnText text={lc.title} style={[s.prompt, lc.title.length > 10 && s.promptLong]} hitStyle={s.learnHit} rubyStyle={s.promptRuby} rubyGate={rubyGate} /> : null}
              {lc.sub ? <Text style={s.reading}>{lc.sub}</Text> : null}
              {lc.body ? <LearnText text={lc.body} target={lc.hit} style={s.learnBody} hitStyle={s.learnHit} rubyStyle={s.learnRuby} rubyGate={rubyGate} /> : null}
              {lc.note ? <LearnText text={lc.note} style={s.learnNote} hitStyle={s.learnHit} rubyStyle={s.learnRuby} rubyGate={rubyGate} /> : null}
            </StudyPrompt>
          </View>
        ))}
        {startButton('bottom')}
      </StudyLayout>
    );
  }

  // 復習に出す問題が無い(未学習/苦手が期限内)=ねぎらいつつ新出学習へ誘導。
  if (review && queue.length === 0 && answered === 0) {
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={s.center}>
          <Text style={s.bigEmoji}>🌸</Text>
          <Text style={s.doneTitle}>{t('review.empty_title')}</Text>
          <Text style={s.doneSub}>{t('review.empty_sub')}</Text>
          <AppButton label={t('reading.backToHome')} onPress={() => nav.goBack()} full={false} style={{ marginTop: spacing.md }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!item || !question) {
    const after = progressSnapshot(state, Date.now());
    return (
      <SafeAreaView style={s.c}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, alignItems: 'center', flexGrow: 1, justifyContent: 'center' }}>
          <AfterStudyReward
            words={resolveStudiedWords(studiedRefs, meaningL1(settings))}
            reviewByRef={Object.fromEntries(studiedRefs.filter((r) => r.q && r.ref).map((r) => [r.ref!.type + ':' + r.ref!.id, r.q!]))}
            shellsEarned={Math.max(0, walletPoints(state) - walletStart)}
            scored={after.touched - before.touched}
            accuracy={answered ? Math.round((correctCount / answered) * 100) : 0}
            correct={correctCount}
            total={answered}
            mode="quiz"
          />
          {/* 既に結果表示中。ボタンは「結果を見る」ではなくホームへ戻る(他ドリル画面と統一)。 */}
          <AppButton label={t('reading.backToHome')} onPress={() => nav.goBack()} full={false} style={{ marginTop: spacing.sm }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const onPick = (choiceIdx: number) => {
    if (picked !== null) return;
    const isCorrect = choiceIdx === question.answerIndex;
    setPicked(choiceIdx);
    setStudiedRefs((r) => [...r, { ref: question.saveRef, correct: isCorrect, q: {
      itemId: question.itemId, prompt: question.prompt, example: question.example, furi: question.furi, furiTarget: question.furiTarget,
      noTargetRuby: question.noTargetRuby, question: question.question, choices: question.choices, answerIndex: question.answerIndex,
      picked: choiceIdx, explain: question.explain ?? question.orderSentence, correct: isCorrect,
    } }]); // 全問=正誤＋問題スナップショットを蓄積(辞書に無い問題も残す=学習後リストに意味空欄で出す)
    if (answerId) quizAnswer(answerId, isCorrect);
    setAnswered((a) => a + 1);
    if (isCorrect) setCorrectCount((c) => c + 1);
    // 不正解でも同じ問題をこの回に再出題しない(＝多くは10問固定)。苦手は次回以降にSRSで自然に戻る。
  };

  const total = queue.length;

  return (
    <StudyLayout current={idx + 1} total={total} title={title} id={question.idLabel ?? question.itemId ?? answerId} onClose={() => nav.goBack()} onPressId={canDevPick ? () => setPickerOpen(true) : undefined} onReport={() => (nav.navigate as (n: string, p?: Record<string, unknown>) => void)('BugReport', { itemId: question.itemId ?? answerId, level: settings.level, daimon: title, screen: 'Quiz' })} reportA11y={t('bug.report')}  footer={picked !== null ? <AnswerFooter study correct={picked === question.answerIndex} onNext={advance} nextKind={idx + 1 >= total ? 'result' : 'next'} /> : null}>
        {canDevPick ? <DevIdPicker visible={pickerOpen} ids={devIds} currentId={(question.itemId ?? answerId) as string} onPick={jumpTo} onClose={() => setPickerOpen(false)} /> : null}

        {!!question.question && <StudyInstruction>{question.question}</StudyInstruction>}
        <StudyPrompt>
          {question.furi ? (
            // ふりがな付き問題文=レベル適応ルビ(同レベル以上の漢字のみ)。①漢字読みは対象語のルビを抑止。
            <RubyText text={question.furi} target={question.furiTarget} style={s.sentence} hitStyle={s.exHit} rubyStyle={s.qRuby} rubyGate={rubyGate} noRubyOnHit={question.noTargetRuby} center />
          ) : (
            <>
              {question.prompt ? (
                /[（(][^）)]*[）)]/.test(question.prompt) ? (
                  // ふりがな付き提示文(JFT表現の場面文など)は素のTextだと括弧のまま出るのでルビ化する。
                  <RubyText text={question.prompt} target={question.furiTarget} style={[s.prompt, question.prompt.length > 10 && s.promptLong]} hitStyle={s.exHit} rubyStyle={s.qRuby} rubyGate={rubyGate} center />
                ) : (
                  <Text style={[s.prompt, question.prompt.length > 10 && s.promptLong]}>{question.prompt}</Text>
                )
              ) : null}
              {question.example ? (
                <Text style={question.prompt ? s.reading : s.sentence}>
                  {question.example.map((sg, i) => (
                    <Text key={i} style={sg.hit ? s.exHit : undefined}>{sg.text}</Text>
                  ))}
                </Text>
              ) : question.reading ? (
                <Text style={s.reading}>{question.reading}</Text>
              ) : null}
            </>
          )}
        </StudyPrompt>

        <StudyChoiceList choices={question.choices} selectedIndex={picked} answerIndex={question.answerIndex}
          revealed={picked !== null} onSelect={onPick}
          renderChoice={(ch, _index, textStyle) => /[（(]/.test(ch)
            ? <RubyText text={ch} style={textStyle} rubyStyle={s.cRuby} rubyGate={rubyGate} />
            : <Text style={textStyle}>{ch}</Text>} />

        {/* 文の組み立て: 回答後に「正しい文(日本語順)＋母語の意味」を表示(データのある問題のみ)。 */}
        {picked !== null && question.orderSentence ? (
          <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.blueLight, gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: c.blue, textAlign: 'center', letterSpacing: 1 }}>{t('quiz.correct_sentence')}</Text>
            <RubyText text={question.orderSentence} style={{ fontSize: 18, fontWeight: '700', color: c.ink, textAlign: 'center' }} rubyStyle={s.qRuby} rubyGate={rubyGate} center />
            {pickTr(meaningL1(settings), question.orderMeaningTr) ? (
              <Text style={{ fontSize: 14, color: c.ink2, textAlign: 'center' }}>{pickTr(meaningL1(settings), question.orderMeaningTr)}</Text>
            ) : null}
          </View>
        ) : null}
        {/* 本文対訳: 回答後に問題文の下へ母語(en/ne)の意味を表示(データのある問題のみ)。 */}
        {picked !== null && pickTr(meaningL1(settings), question.promptTransTr) ? (
          <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.blueLight, gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: c.blue, textAlign: 'center', letterSpacing: 1 }}>{t('quiz.sentence_meaning')}</Text>
            <Text style={{ fontSize: 15, color: c.ink2, textAlign: 'center' }}>{pickTr(meaningL1(settings), question.promptTransTr)}</Text>
          </View>
        ) : null}
        {/* 用法: 回答後に「正解の文の意味」を表示(誤答は訳さない=わざと不自然な日本語のため)。 */}
        {picked !== null && pickTr(meaningL1(settings), question.answerTransTr) ? (
          <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.blueLight, gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: c.blue, textAlign: 'center', letterSpacing: 1 }}>{t('quiz.answer_meaning')}</Text>
            <Text style={{ fontSize: 15, color: c.ink2, textAlign: 'center' }}>{pickTr(meaningL1(settings), question.answerTransTr)}</Text>
          </View>
        ) : null}
        {/* 言い換え: 回答後に「本文の意味＋各選択肢の意味」を表示(誤答も正当な日本語語ゆえ訳あり)。番号は選択肢と同じ。 */}
        {picked !== null && question.choiceTransTr ? (
          <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.blueLight, gap: 4 }}>
            {pickTr(meaningL1(settings), question.synonymSentenceTr) ? (
              <Text style={{ fontSize: 14, color: c.ink2, textAlign: 'center', marginBottom: 4 }}>{pickTr(meaningL1(settings), question.synonymSentenceTr)}</Text>
            ) : null}
            <Text style={{ fontSize: 12, fontWeight: '800', color: c.blue, textAlign: 'center', letterSpacing: 1 }}>{t('quiz.choice_meanings')}</Text>
            {question.choices.map((_, i) => {
              const m = pickTr(meaningL1(settings), question.choiceTransTr)?.[i];
              if (!m) return null;
              const isAns = i === question.answerIndex;
              return (
                <Text key={i} style={{ fontSize: 13, color: isAns ? c.green : c.ink2 }}>{`${i + 1}. ${m}${isAns ? ' ✓' : ''}`}</Text>
              );
            })}
          </View>
        ) : null}
        {picked === null && <Text style={s.hint}>{t('quiz.hint')}</Text>}
    </StudyLayout>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  prompt: { fontSize: 34, fontWeight: '800', color: c.ink },
  promptLong: { fontSize: ty.h2, lineHeight: 30, textAlign: 'left', alignSelf: 'stretch' }, // 穴埋め/バンク=長文プロンプト

  reading: { fontSize: ty.small, color: c.mute },
  sentence: { fontSize: ty.h2, lineHeight: 32, color: c.ink, textAlign: 'left', alignSelf: 'stretch' }, // 言い換え=文＋下線を主表示

  learnBody: { fontSize: ty.body, color: c.ink2, marginTop: spacing.xs, textAlign: 'center', lineHeight: 22 },
  learnNote: { fontSize: ty.small, color: c.ink, marginTop: spacing.sm, textAlign: 'center', lineHeight: 22 },
  learnHit: { color: c.ink, fontWeight: '800', textDecorationLine: 'underline' },
  learnRuby: { fontSize: 9, lineHeight: 11, color: c.mute, textAlign: 'center' },
  promptRuby: { fontSize: 12, lineHeight: 14, color: c.mute, textAlign: 'center' }, // 見出し(title)のルビ(大きめ本文用)
  learnNumber: { fontSize: ty.small, color: c.blueDark, fontWeight: '800' },
  learnStart: { minHeight: 52, borderRadius: 12, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.blue },
  learnStartText: { fontSize: ty.h2, fontWeight: '800', color: '#fff', textAlign: 'center' },
  exHit: { color: c.blueDark, textDecorationLine: 'underline' },
  qRuby: { fontSize: 10, lineHeight: 12, color: c.mute, textAlign: 'center' },
  cRuby: { fontSize: 9, lineHeight: 11, color: c.faint, textAlign: 'center' },
  hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center', marginTop: spacing.sm },
  bigEmoji: { fontSize: 56 },
  doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink },
  doneSub: { fontSize: ty.body, color: c.mute },
});
