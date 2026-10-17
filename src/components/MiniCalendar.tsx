// 純JS製ミニカレンダー(ネイティブ依存なし=OTA可)。未来日のみ選択可。JFTの試験日(CBT予約日)入力用。
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function MiniCalendar({ value, min, onSelect }: { value: string | null; min: string; onSelect: (d: string) => void }) {
  const c = useColors();
  const s = makeStyles(c);
  const t = useT();
  const base = value && value >= min ? value : min;
  const [vy, setVy] = useState(Number(base.slice(0, 4)));
  const [vm, setVm] = useState(Number(base.slice(5, 7))); // 1-12

  const minY = Number(min.slice(0, 4)), minM = Number(min.slice(5, 7));
  const firstDow = new Date(Date.UTC(vy, vm - 1, 1)).getUTCDay(); // 0=日
  const daysInMonth = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
  const canPrev = vy > minY || (vy === minY && vm > minM);

  const go = (delta: number) => {
    let y = vy, m = vm + delta;
    if (m < 1) { m = 12; y -= 1; } else if (m > 12) { m = 1; y += 1; }
    setVy(y); setVm(m);
  };

  const weekdays = (t('profile.weekdays') || '日,月,火,水,木,金,土').split(',');
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={s.cal}>
      <View style={s.head}>
        <Pressable onPress={() => canPrev && go(-1)} disabled={!canPrev} style={s.nav} hitSlop={8}>
          <Text style={[s.navTxt, !canPrev && s.navOff]}>◀</Text>
        </Pressable>
        <Text style={s.title}>{vy}.{vm}</Text>
        <Pressable onPress={() => go(1)} style={s.nav} hitSlop={8}>
          <Text style={s.navTxt}>▶</Text>
        </Pressable>
      </View>
      <View style={s.row}>
        {weekdays.map((w, i) => (
          <Text key={i} style={[s.wd, i === 0 && s.sun, i === 6 && s.sat]}>{w}</Text>
        ))}
      </View>
      <View style={s.grid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={i} style={s.cell} />;
          const ds = ymd(vy, vm, d);
          const past = ds < min;
          const sel = ds === value;
          return (
            <Pressable key={i} style={s.cell} disabled={past} onPress={() => onSelect(ds)}>
              <View style={[s.day, sel && s.daySel]}>
                <Text style={[s.dayTxt, past && s.dayPast, sel && s.dayTxtSel]}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    cal: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, marginTop: spacing.sm },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    nav: { paddingHorizontal: spacing.md, paddingVertical: 2 },
    navTxt: { fontSize: ty.h2, fontWeight: '800', color: c.blue },
    navOff: { color: c.trace },
    title: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    row: { flexDirection: 'row' },
    wd: { width: `${100 / 7}%`, textAlign: 'center', fontSize: ty.tiny, fontWeight: '700', color: c.mute, marginBottom: 4 },
    sun: { color: c.red },
    sat: { color: c.blue },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    day: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    daySel: { backgroundColor: c.blue },
    dayTxt: { fontSize: ty.body, color: c.ink, fontWeight: '600' },
    dayPast: { color: c.trace },
    dayTxtSel: { color: '#ffffff', fontWeight: '800' },
  });
