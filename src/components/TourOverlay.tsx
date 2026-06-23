// 初回ガイドツアー: オンボーディング後、各機能を「実物そっくりのサンプル見本」付きで順番に説明。
// 実画面に枠を重ねる方式はやめ(位置ズレ/中身依存)、各ステップに本物の部品(HeroGauge/RingGauge等)を
// 仮データで描画＝何の機能か一目で分かる。依存追加なし。Web/実機両対応。
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppActions } from '../store/store';
import { useT } from '../i18n';
import HeroGauge from './HeroGauge';
import RingGauge from './RingGauge';

type Kind = 'gauge' | 'growth' | 'rings' | 'today' | 'streak' | 'study' | 'test' | 'dict' | 'cheer';
type Step = { kind: Kind; titleKey: string; bodyKey: string };

const STEPS: Step[] = [
  { kind: 'gauge', titleKey: 'touroverlay.step_gauge_title', bodyKey: 'touroverlay.step_gauge_body' },
  { kind: 'growth', titleKey: 'touroverlay.step_growth_title', bodyKey: 'touroverlay.step_growth_body' },
  { kind: 'rings', titleKey: 'touroverlay.step_rings_title', bodyKey: 'touroverlay.step_rings_body' },
  { kind: 'today', titleKey: 'touroverlay.step_today_title', bodyKey: 'touroverlay.step_today_body' },
  { kind: 'streak', titleKey: 'touroverlay.step_streak_title', bodyKey: 'touroverlay.step_streak_body' },
  { kind: 'study', titleKey: 'touroverlay.step_study_title', bodyKey: 'touroverlay.step_study_body' },
  { kind: 'test', titleKey: 'touroverlay.step_test_title', bodyKey: 'touroverlay.step_test_body' },
  { kind: 'dict', titleKey: 'touroverlay.step_dict_title', bodyKey: 'touroverlay.step_dict_body' },
  { kind: 'cheer', titleKey: 'touroverlay.step_cheer_title', bodyKey: 'touroverlay.step_cheer_body' },
];

function Illustration({ kind, c }: { kind: Kind; c: ThemeColors }) {
  const t = useT();
  if (kind === 'gauge') {
    return (
      <HeroGauge value={62} color={c.amber} mark={55} size={134} stroke={10}>
        <Text style={{ fontSize: 42, fontWeight: '800', color: c.ink, lineHeight: 46 }}>62</Text>
        <Text style={{ fontSize: ty.tiny, color: c.faint }}>±6</Text>
      </HeroGauge>
    );
  }
  if (kind === 'growth') {
    const bars = [8, 13, 11, 19, 24, 22, 31, 38, 44];
    const max = 44;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 66 }}>
        {bars.map((b, i) => (
          <View key={i} style={{ width: 12, height: 6 + (56 * b) / max, backgroundColor: c.green, borderRadius: 2 }} />
        ))}
      </View>
    );
  }
  if (kind === 'rings') {
    const sample = [
      { v: 72, label: t('touroverlay.ring_kanji'), col: c.green },
      { v: 54, label: t('touroverlay.ring_grammar'), col: c.amber },
      { v: 38, label: t('touroverlay.ring_reading'), col: c.red },
      { v: 30, label: t('touroverlay.ring_listening'), col: c.red },
    ];
    return (
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {sample.map((r) => <RingGauge key={r.label} value={r.v} color={r.col} label={r.label} size={58} stroke={6} />)}
      </View>
    );
  }
  if (kind === 'today') {
    return (
      <View style={{ alignSelf: 'stretch', backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
        <Text style={{ color: '#ffffff', fontSize: ty.h2, fontWeight: '800' }}>{t('touroverlay.today_label')}</Text>
        <Text style={{ color: '#dbeafe', fontSize: ty.tiny, marginTop: 3 }}>{t('touroverlay.today_sub')}</Text>
      </View>
    );
  }
  if (kind === 'streak') {
    const days = [
      t('touroverlay.day_mon'),
      t('touroverlay.day_tue'),
      t('touroverlay.day_wed'),
      t('touroverlay.day_thu'),
      t('touroverlay.day_fri'),
      t('touroverlay.day_sat'),
      t('touroverlay.day_sun'),
    ];
    const on = [true, true, true, false, true, true, false];
    return (
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ fontSize: ty.h2, fontWeight: '800', color: c.ink }}>{t('touroverlay.streak_label')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {days.map((d, i) => (
            <View key={d} style={{ alignItems: 'center', gap: 3 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on[i] ? c.orange : c.bgSoft, borderWidth: 1, borderColor: on[i] ? c.orange : c.line }}>
                <Text style={{ fontSize: ty.small, color: on[i] ? '#ffffff' : c.faint, fontWeight: '800' }}>{on[i] ? '✓' : ''}</Text>
              </View>
              <Text style={{ fontSize: ty.tiny, color: c.faint }}>{d}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (kind === 'study') {
    const cards: [string, string][] = [
      ['字', t('touroverlay.study_kanji')],
      ['文', t('touroverlay.study_grammar')],
      ['読', t('touroverlay.study_reading')],
      ['聴', t('touroverlay.study_listening')],
    ];
    return (
      <View style={{ alignSelf: 'stretch', gap: 6 }}>
        {cards.map(([ic, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: 8, paddingHorizontal: 10 }}>
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '800', color: c.ink2, fontSize: ty.body }}>{ic}</Text>
            </View>
            <Text style={{ flex: 1, fontWeight: '800', color: c.ink, fontSize: ty.body }}>{label}</Text>
            <Text style={{ color: c.trace, fontSize: 20 }}>›</Text>
          </View>
        ))}
      </View>
    );
  }
  if (kind === 'test') {
    const cards: [string, string, string][] = [
      [t('touroverlay.test_mini'), t('touroverlay.test_mini_time'), t('touroverlay.test_mini_note')],
      [t('touroverlay.test_full'), t('touroverlay.test_full_time'), t('touroverlay.test_full_note')],
    ];
    return (
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        {cards.map(([label, time, note]) => (
          <View key={label} style={{ backgroundColor: c.bgSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: 10, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', color: c.ink, fontSize: ty.body }}>{label}</Text>
              <Text style={{ fontSize: ty.tiny, color: c.mute, backgroundColor: c.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' }}>{time}</Text>
            </View>
            <Text style={{ fontSize: ty.tiny, color: c.ink2 }}>{note}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (kind === 'cheer') {
    return <Text style={{ fontSize: 52 }}>🌸</Text>;
  }
  // dict (辞書画面)
  const entries: [string, string, string][] = [['勉強', 'べんきょう', 'study'], ['時間', 'じかん', 'time, hour']];
  const dictTabs = [t('touroverlay.dict_tab_vocab'), t('touroverlay.dict_tab_kanji'), t('touroverlay.dict_tab_grammar')];
  return (
    <View style={{ alignSelf: 'stretch', gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {dictTabs.map((k, i) => (
          <View key={k} style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: i === 0 ? c.blue : c.line, backgroundColor: i === 0 ? c.blueLight : c.surface }}>
            <Text style={{ fontSize: ty.tiny, fontWeight: '800', color: i === 0 ? c.blueDark : c.ink2 }}>{k}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: 7, paddingHorizontal: 10 }}>
        <Ionicons name="search" size={16} color={c.faint} />
        <Text style={{ fontSize: ty.small, color: c.faint }}>{t('touroverlay.dict_search_placeholder')}</Text>
      </View>
      {entries.map(([w, r, m]) => (
        <View key={w} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: 7, paddingHorizontal: 10 }}>
          <Text style={{ color: c.green, fontWeight: '800' }}>✓</Text>
          <Text style={{ fontWeight: '800', color: c.ink, fontSize: ty.body }}>{w}</Text>
          <Text style={{ fontSize: ty.tiny, color: c.mute }}>{r}</Text>
          <Text style={{ flex: 1, fontSize: ty.tiny, color: c.ink2 }} numberOfLines={1}>{m}</Text>
        </View>
      ))}
    </View>
  );
}

export default function TourOverlay() {
  const t = useT();
  const c = useColors();
  const s = makeStyles(c);
  const { setSettings } = useAppActions();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i + 1 >= STEPS.length;
  const finish = () => setSettings({ tourDone: true });

  return (
    <View style={s.overlay} pointerEvents="auto">
      <View style={s.card}>
        <Text style={s.kicker}>{t('touroverlay.kicker')}</Text>
        <View style={s.illu}><Illustration kind={step.kind} c={c} /></View>
        <Text style={s.count}>{i + 1} / {STEPS.length}</Text>
        <Text style={s.title}>{t(step.titleKey)}</Text>
        <Text style={s.body}>{t(step.bodyKey)}</Text>
        <View style={s.row}>
          <Pressable onPress={finish} hitSlop={8}><Text style={s.skip}>{t('touroverlay.skip')}</Text></Pressable>
          <View style={s.rrow}>
            {i > 0 && <Pressable onPress={() => setI(i - 1)} hitSlop={8} style={s.back}><Text style={s.backTxt}>{t('touroverlay.back')}</Text></Pressable>}
            <Pressable style={s.next} onPress={() => (last ? finish() : setI(i + 1))}>
              <Text style={s.nextTxt}>{last ? t('touroverlay.start') : t('touroverlay.next')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(8,12,24,0.62)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
    },
    card: {
      width: '100%', maxWidth: 380, backgroundColor: c.surface, borderRadius: radius.xl, padding: spacing.lg,
      alignItems: 'center', gap: 6,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
    },
    kicker: { fontSize: ty.tiny, fontWeight: '800', color: c.blue, letterSpacing: 1 },
    illu: { minHeight: 130, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
    count: { fontSize: ty.tiny, color: c.faint, fontWeight: '700' },
    title: { fontSize: ty.h1, fontWeight: '800', color: c.ink, textAlign: 'center' },
    body: { fontSize: ty.body, color: c.ink2, lineHeight: 22, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: spacing.md },
    rrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    skip: { fontSize: ty.small, color: c.faint, fontWeight: '600' },
    back: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    backTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '700' },
    next: { backgroundColor: c.blue, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
    nextTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  });
