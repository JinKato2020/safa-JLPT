// 母語(l1)の解説を非同期取得して表示。l1=ja/未取得/ja同一なら非表示。既存のja解説は呼び出し側が表示済み。
import { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors, type as ty } from '../theme';
import { getExplain } from '../data/exam/explainL10n';
import { explainJa } from '../data/exam/explainJa';

export default function ExplainL10n({ id, l1 }: { id: string; l1: string }) {
  const c = useColors();
  const s = makeStyles(c);
  const [txt, setTxt] = useState('');
  useEffect(() => {
    let alive = true;
    if (!id || l1 === 'ja') { setTxt(''); return; }
    getExplain(id, l1).then((t) => {
      if (!alive) return;
      setTxt(t && t !== explainJa(id) ? t : '');
    }).catch(() => { if (alive) setTxt(''); });
    return () => { alive = false; };
  }, [id, l1]);
  if (!txt) return null;
  return <Text style={s.txt}>{txt}</Text>;
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  txt: { fontSize: ty.small, color: c.blue, lineHeight: 20, marginTop: 4 },
});
