// 合格リングをタップした時に最上部へ出す「試験情報」パネル。
//  ・左＝桜(ホームと同じ装備キャラ)。右＝①試験日 ②試験までの日数 ③受験申込み期間 ④費用。
//  ・試験日＝設定の試験日。未設定/過去なら次回JLPT(7月・12月の第1日曜)を「目安」として表示。
//  ・申込み期間/費用＝国内(日本)JLPTの目安。海外は国により異なるため注記＋公式確認を促す。最新値は公式で要更新。
//  ・JFT-Basic目標の人にはJLPTの申込み期間/費用は出さず、通年CBTの注記を出す(誤情報防止)。
import { View, Text, Image, StyleSheet } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { SHOP_BY_ID } from '../data/shop';
import { GUIDE } from '../data/mywordsArt';
import { dayStr, daysBetween } from '../store/state';

// 7月・12月の「第1日曜」= JLPT実施日(ProfileScreenと同じ算出)。
function firstSundayOf(year: number, month: number): string {
  for (let d = 1; d <= 7; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0) {
      return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
// 今日より後で最も近いJLPT実施日。設定の試験日が無い/過去の時のフォールバック。
function nextJlpt(today: string): string {
  const y = Number(today.slice(0, 4));
  return (
    [firstSundayOf(y, 7), firstSundayOf(y, 12), firstSundayOf(y + 1, 7), firstSundayOf(y + 1, 12)].find((d) => d > today) ??
    firstSundayOf(y + 1, 7)
  );
}

// 国内(日本)JLPTの受付期間。例年ほぼ固定(インターネット申込=MyJLPT)。7月回/12月回で分ける。
//  7月回=3月下旬〜4月中旬 / 12月回=8月下旬〜9月中旬。年度により数日前後するため画面で注記＋公式確認を促す。
const APPLY_PERIOD_JP: Record<'jul' | 'dec', string> = {
  jul: '3月下旬〜4月中旬',
  dec: '8月下旬〜9月中旬',
};
// 国内(日本)JLPTの受験料(全レベル共通)。※改定される場合があるため公式最新値に要更新。
const FEE_JP = '7,500円';

export default function ExamInfoCard() {
  const c = useColors();
  const s = makeStyles(c);
  const state = useAppState();

  // 桜＝ホーム(HomeCoach)と同じ選択: 民族衣装 > 背負い筆 > 既定の案内キャラ。
  const eqBrush = state.equipped?.brush;
  const isShort = state.equipped?.hair === 'hair_short';
  const bItem = eqBrush ? SHOP_BY_ID[eqBrush] : undefined;
  const brushImg = bItem ? (isShort ? bItem.homeShort : bItem.homeLong) : undefined;
  const eqCostume = state.equipped?.costume;
  const costumeImg = eqCostume ? SHOP_BY_ID[eqCostume]?.asset : undefined;
  const heroChar = costumeImg ?? brushImg ?? GUIDE.open;
  const heroFull = !!(costumeImg ?? brushImg); // 全身立ち絵(縦長)か

  const today = dayStr(Date.now());
  const set = state.settings.examDate;
  const usingSet = !!set && set > today;          // 設定の試験日を使う(未来のみ)
  const examDate = usingSet ? (set as string) : nextJlpt(today);
  const days = daysBetween(today, examDate);
  const month = Number(examDate.slice(5, 7));
  const season: 'jul' | 'dec' = month >= 9 || month <= 2 ? 'dec' : 'jul'; // 12月回 or 7月回

  const isJft = (state.settings.targetExam ?? 'jlpt') === 'jft';

  const rows: { label: string; value: string }[] = [
    { label: '試験日', value: examDate.replace(/-/g, '/') },
    { label: '試験までの日数', value: `あと ${days} 日` },
  ];
  if (!isJft) {
    rows.push({ label: '受験申込み期間', value: APPLY_PERIOD_JP[season] });
    rows.push({ label: '費用', value: FEE_JP });
  }
  const note = isJft
    ? '※JFT-Basicは通年CBT。申込みは随時、受験料は会場・国により異なります。'
    : '※国内（日本）の受付期間・費用です。年度により数日前後し費用も改定される場合があります。海外は国により異なるため、最新は公式サイトでご確認ください。';

  return (
    <View style={s.card}>
      <View style={s.rowTop}>
        <Image source={heroChar} style={heroFull ? s.guideFull : s.guide} resizeMode="contain" />
        <View style={s.info}>
          {rows.map((r) => (
            <View key={r.label} style={s.line}>
              <Text style={s.lbl}>{r.label}</Text>
              <Text style={s.val} numberOfLines={1}>{r.value}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={s.note}>{note}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    guide: { width: 78, height: 87 },
    guideFull: { width: 92, height: 126 }, // 全身立ち絵(民族衣装/背負い筆)は縦長
    info: { flex: 1, gap: spacing.xs },
    line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
    lbl: { fontSize: ty.small, fontWeight: '700', color: c.mute },
    val: { flex: 1, textAlign: 'right', fontSize: ty.body, fontWeight: '800', color: c.ink },
    note: { fontSize: ty.tiny, color: c.faint, lineHeight: 16 },
  });
