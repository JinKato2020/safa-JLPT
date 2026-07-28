// 合格の「色紙(しきし)」の壁。合格を自己申告すると1枚だけ残る証(級ごと一度)。桜貝は付かない=嘘の旨味を作らない。
//  ・画像素材は使わない(P0はゼロ画像)。和紙調のカードに「合格」朱印風＋級＋日付。凝った意匠はP1(要素材)。
//  ・壁は state.shikishi が空なら何も出さない。
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import type { Shikishi } from '../store/state';

/** 色紙1枚(合格の証)。ResultReportCard と壁の両方で使う共通の見た目。 */
export function ShikishiCard({ item }: { item: Shikishi }) {
  const c = useColors();
  const s = makeStyles(c);
  return (
    <View style={s.shikishi}>
      <View style={s.seal}><Text style={s.sealTxt}>合格</Text></View>
      <Text style={s.level}>{item.level}</Text>
      <Text style={s.date}>{item.date.replace(/-/g, '.')}</Text>
    </View>
  );
}

export default function ShikishiWall() {
  const state = useAppState();
  const c = useColors();
  const s = makeStyles(c);
  const list = state.shikishi ?? [];
  if (list.length === 0) return null;
  return (
    <View style={s.card}>
      <Text style={s.h}>合格の色紙</Text>
      <View style={s.wall}>
        {list.map((it) => <ShikishiCard key={`${it.level}-${it.date}`} item={it} />)}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    h: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
    wall: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    // 和紙調の色紙。朱印風の「合格」＋級＋日付。
    shikishi: {
      width: 92, height: 116, borderRadius: radius.md, backgroundColor: c.bgSoft,
      borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    seal: { width: 40, height: 40, borderRadius: 6, borderWidth: 2, borderColor: '#c0392b', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
    sealTxt: { fontSize: 15, fontWeight: '900', color: '#c0392b' },
    level: { fontSize: ty.body, fontWeight: '900', color: c.ink },
    date: { fontSize: ty.tiny, color: c.mute },
  });
