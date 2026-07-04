// 漢字の上に小さくふりがな(ルビ)を載せて表示する共通コンポーネント。
// 入力テキストは「漢字（かな）」形式(既存データと同じ)。漢字連(熟語)＋（読み）を1ルビセルにまとめる。
// target(語/文法点)にマッチする部分は下線(hitStyle)。〜を含む文法点(A〜B型)も両部分に下線。
import { View, Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { highlightHits } from '../quiz/highlight';

const RUBY_RE = /([一-鿿㐀-䶿々〆〇ヶ]+)（([^）]*)）|([\s\S])/gu;

interface Cell { base: string; ruby?: string; hit?: boolean; }

function parseCells(text: string): Cell[] {
  const cells: Cell[] = [];
  let m: RegExpExecArray | null;
  RUBY_RE.lastIndex = 0;
  while ((m = RUBY_RE.exec(text))) {
    if (m[1] !== undefined) cells.push({ base: m[1], ruby: m[2] });
    else cells.push({ base: m[3]! });
  }
  return cells;
}

export default function RubyText({
  text, target, style, hitStyle, rubyStyle, center, rubyGate,
}: {
  text: string;
  target?: string;
  style?: StyleProp<TextStyle>; // 本文(漢字/かな)の文字スタイル
  hitStyle?: StyleProp<TextStyle>; // 下線部のスタイル
  rubyStyle?: StyleProp<TextStyle>; // ルビ(小さいかな)のスタイル
  center?: boolean; // 各行を中央寄せ(学習カード等)
  rubyGate?: (run: string) => boolean; // レベル適応: falseの漢字群はルビを出さず素の漢字にする
}) {
  const cells = parseCells(text);
  const plain = cells.map((c) => c.base).join('');
  const hits = target ? highlightHits(plain, target) : [];
  let off = 0;
  for (const c of cells) {
    let h = false;
    for (let i = 0; i < c.base.length; i++) if (hits[off + i]) h = true;
    c.hit = h;
    off += c.base.length;
  }
  return (
    <View style={[styles.row, center && styles.center]}>
      {cells.map((c, i) => {
        // レベル適応: rubyGate が false の漢字群はルビを出さず素の漢字にする。
        const showRuby = c.ruby != null && (!rubyGate || rubyGate(c.base));
        return (
          <View key={i} style={styles.col}>
            <Text style={[styles.ruby, rubyStyle]} numberOfLines={1}>{showRuby ? c.ruby : ' '}</Text>
            <Text style={[style, c.hit ? hitStyle : undefined]}>{c.base}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', rowGap: 2 },
  center: { justifyContent: 'center' },
  col: { alignItems: 'center' },
  ruby: { fontSize: 9, lineHeight: 11, textAlign: 'center', includeFontPadding: false },
});
