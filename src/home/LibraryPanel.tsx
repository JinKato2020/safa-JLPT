// 仮UI: 古代辞書の復元パネル。物語の背骨を"動かして体感"するための足場(絵はまだ=プレースホルダ)。
//  ・修復率=現在級の合格リング(homeStatus.passPct)。節目20/40/60/80/100%で書庫の要素が直り、覚書(小ストーリー)が蘇る。
//  ・受け取った覚書は storySeen に一度きり記録(dueStory の seen)。付与ロジックには触れない(表示だけ)。
//  ・「プレビュー(仮)」は動きの確認用にスライダで修復率を動かす=本番の進捗/seenは消費しない(ローカル分離)。
//  ・本実装(P1)で: 書庫のイラスト段階差し替え・手紙がフワッと出る演出・柴犬のリアクションに置き換える。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { homeStatus } from './homeStatus';
import { stageOf, sceneStateOf, restorationPercent, dueStory, isBookComplete, STAGES, SMALL_STORIES, type SceneState } from '../story/library';

const SCENE_CHIPS: [keyof SceneState, string][] = [
  ['shelf', '本棚'], ['light', '照明'], ['garden', '庭'], ['sakura', '桜'], ['water', '水路'],
];

export default function LibraryPanel() {
  const state = useAppState();
  const { markStoryRead } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  // 本番の修復率=現在級の合格リング(0..1)。
  const realPct = useMemo(() => homeStatus(state, Date.now()).passPct / 100, [state]);

  // 仮プレビュー: スライダで修復率を動かして演出を体感(seenは本番と分離=消費しない)。
  const [preview, setPreview] = useState(false);
  const [pvPct, setPvPct] = useState(0);
  const [pvSeen, setPvSeen] = useState<string[]>([]);

  const pct = preview ? pvPct : realPct;
  const seen = preview ? pvSeen : (state.storySeen ?? []);
  const stage = STAGES[stageOf(pct)];
  const scene = sceneStateOf(pct);
  const due = dueStory({ percent: pct, seen });

  const onRead = (id: string) => {
    if (preview) setPvSeen((p) => (p.includes(id) ? p : [...p, id]));
    else markStoryRead(id);
  };

  return (
    <View style={s.card}>
      <Text style={s.h}>📖 古代辞書の復元（仮）</Text>

      {/* 進捗バー */}
      <View style={s.barRow}>
        <View style={s.barBg}><View style={[s.barFg, { width: `${Math.round(restorationPercent(pct) * 100)}%` }]} /></View>
        <Text style={s.barPct}>{Math.round(pct * 100)}%</Text>
      </View>
      <Text style={s.stage}>{stage.label}・{stage.dict}</Text>

      {/* 書庫の要素(節目で一つずつ綺麗になる=仮チップ→本実装でイラスト差し替え) */}
      <View style={s.chips}>
        {SCENE_CHIPS.map(([k, label]) => (
          <View key={k} style={[s.chip, scene[k] ? s.chipOn : s.chipOff]}>
            <Text style={[s.chipT, scene[k] ? s.chipTOn : s.chipTOff]}>{scene[k] ? '✓ ' : ''}{label}</Text>
          </View>
        ))}
      </View>

      {/* 節目に達したら覚書が蘇る / 完成 / 途中の案内 */}
      {due ? (
        <View style={s.story}>
          <Text style={s.storyTag}>📜 消えていたページが、読めるようになった</Text>
          <Text style={s.storyTitle}>{due.title}</Text>
          {due.record.map((line, i) => <Text key={i} style={s.storyLine}>{line}</Text>)}
          <Text style={s.storySakura}>桜：{due.sakura}</Text>
          <Pressable style={s.readBtn} onPress={() => onRead(due.id)} hitSlop={6}>
            <Text style={s.readBtnT}>この記録を受け取る</Text>
          </Pressable>
        </View>
      ) : isBookComplete(pct) ? (
        <Text style={s.done}>書庫が元通りになった。すべての記録が、未来へ残った。</Text>
      ) : (
        <Text style={s.hint}>学習を進めると、次の節目でページが一つ読めるようになります。</Text>
      )}

      <Text style={s.count}>受け取った記録：{seen.length} / {SMALL_STORIES.length}</Text>

      {/* プレビュー(仮)—動きの確認用。本番の進捗/seenは消費しない。 */}
      <View style={s.pv}>
        <Pressable onPress={() => setPreview((v) => !v)} style={s.pvToggle} hitSlop={6}>
          <Text style={s.pvToggleT}>{preview ? '■ プレビュー中（仮）— 実際の進捗ではありません' : '□ プレビュー（仮）で動きを見る'}</Text>
        </Pressable>
        {preview && (
          <View style={s.pvRow}>
            <Pressable style={s.step} onPress={() => setPvPct((p) => Math.max(0, +(p - 0.1).toFixed(2)))} hitSlop={6}><Text style={s.stepT}>−10%</Text></Pressable>
            <Text style={s.pvPct}>{Math.round(pvPct * 100)}%</Text>
            <Pressable style={s.step} onPress={() => setPvPct((p) => Math.min(1, +(p + 0.1).toFixed(2)))} hitSlop={6}><Text style={s.stepT}>＋10%</Text></Pressable>
            <Pressable style={s.step} onPress={() => { setPvPct(0); setPvSeen([]); }} hitSlop={6}><Text style={s.stepT}>リセット</Text></Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: { width: '100%', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    h: { fontSize: ty.body, fontWeight: '900', color: c.ink },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    barBg: { flex: 1, height: 10, borderRadius: 6, backgroundColor: c.bgSoft, overflow: 'hidden' },
    barFg: { height: '100%', borderRadius: 6, backgroundColor: c.blue },
    barPct: { fontSize: ty.small, fontWeight: '800', color: c.blue, fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' },
    stage: { fontSize: ty.small, color: c.mute },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1 },
    chipOn: { backgroundColor: c.blue, borderColor: c.blue },
    chipOff: { backgroundColor: c.bgSoft, borderColor: c.line },
    chipT: { fontSize: ty.small, fontWeight: '800' },
    chipTOn: { color: '#ffffff' },
    chipTOff: { color: c.mute },
    story: { backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: 4 },
    storyTag: { fontSize: ty.small, fontWeight: '800', color: c.blue },
    storyTitle: { fontSize: ty.body, fontWeight: '900', color: c.ink, marginTop: 2 },
    storyLine: { fontSize: ty.small, color: c.ink2, lineHeight: 22 },
    storySakura: { fontSize: ty.small, color: c.ink, fontWeight: '700', marginTop: 4 },
    readBtn: { marginTop: spacing.sm, alignSelf: 'flex-start', backgroundColor: c.blue, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 8 },
    readBtnT: { color: '#ffffff', fontSize: ty.small, fontWeight: '800' },
    done: { fontSize: ty.small, color: c.ink, fontWeight: '700', lineHeight: 22 },
    hint: { fontSize: ty.small, color: c.mute, lineHeight: 20 },
    count: { fontSize: ty.small, color: c.mute },
    pv: { borderTopWidth: 1, borderTopColor: c.line, paddingTop: spacing.sm, gap: spacing.sm },
    pvToggle: { alignSelf: 'flex-start' },
    pvToggleT: { fontSize: ty.small, color: c.mute, fontWeight: '700' },
    pvRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    pvPct: { fontSize: ty.small, fontWeight: '800', color: c.ink, fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'center' },
    step: { backgroundColor: c.bgSoft, borderRadius: radius.sm, borderWidth: 1, borderColor: c.line, paddingHorizontal: 10, paddingVertical: 6 },
    stepT: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
  });
