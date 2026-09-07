// ポスター朗読のテーマ選択。POSTER_LESSONS を一覧表示し、選ぶと PosterAudio へ。
//  単語(書斎)タブ → 語彙カード「ポスター朗読」から遷移。
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { spacing, radius, useColors } from '../theme';
import { useT, useUiLang } from '../i18n';
import { POSTER_LESSONS } from '../data/posterLessons';

export default function PosterListScreen() {
  const nav = useNavigation<any>();
  const c = useColors();
  const t = useT();
  const lang = useUiLang();
  const pick = (m?: Record<string, string>) => (m ? (m[lang] ?? m.en ?? Object.values(m)[0]) : undefined);

  return (
    <SafeAreaView style={[styles.c, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.back}>
          <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M15 18l-6-6 6-6" stroke={c.ink} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>{t('poster.list_title')}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={[styles.sub, { color: c.mute }]}>{t('poster.list_sub')}</Text>
        {POSTER_LESSONS.map((l) => {
          const l1 = pick(l.titleL1);
          const showL1 = l1 && l1 !== l.title;
          return (
            <Pressable key={l.id}
              style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.line }, pressed && { backgroundColor: c.bgSoft }]}
              onPress={() => nav.navigate('PosterAudio', { lessonId: l.id })}>
              <View style={[styles.badge, { backgroundColor: c.blueLight }]}><Text style={[styles.badgeTxt, { color: c.blueDark }]}>{l.title.slice(0, 1)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: c.ink }]}>{l.title}</Text>
                {showL1 && <Text style={[styles.rowSub, { color: c.mute }]} numberOfLines={1}>{l1}</Text>}
              </View>
              <Text style={[styles.chevron, { color: c.trace }]}>›</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { width: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  sub: { fontSize: 13, marginBottom: spacing.xs, paddingHorizontal: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, borderWidth: 1, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  badge: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontSize: 20, fontWeight: '800' },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 1 },
  chevron: { fontSize: 26, fontWeight: '700' },
});
