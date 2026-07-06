// 漢字の上に小さくふりがな(ルビ)を載せて表示する共通コンポーネント。
// 入力テキストは「漢字（かな）」形式(既存データと同じ)。漢字連(熟語)＋（読み）を1ルビセルにまとめる。
// target(語/文法点)にマッチする部分は下線(hitStyle)。〜を含む文法点(A〜B型)も両部分に下線。
import { View, Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
// 基底テキストは親の大きな lineHeight を引き継ぐと、グリフが行ボックス中央に来て
// ルビとの間が空き「ルビが高い位置に浮く」。ルビ列では lineHeight を fontSize に詰めて真上に寄せる。
import { highlightHits } from '../quiz/highlight';

// ふりがな区切りは全角（）・半角()の両方を受ける(sentenceFuri等はkuroshiro既定の半角、文法データは全角)。
const RUBY_RE = /([一-鿿㐀-䶿々〆〇ヶ]+)[（(]([^）)]*)[）)]|([\s\S])/gu;

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
  text, target, style, hitStyle, rubyStyle, center, rubyGate, noRubyOnHit,
}: {
  text: string;
  target?: string;
  style?: StyleProp<TextStyle>; // 本文(漢字/かな)の文字スタイル
  hitStyle?: StyleProp<TextStyle>; // 下線部のスタイル
  rubyStyle?: StyleProp<TextStyle>; // ルビ(小さいかな)のスタイル
  center?: boolean; // 各行を中央寄せ(学習カード等)
  rubyGate?: (run: string) => boolean; // レベル適応: falseの漢字群はルビを出さず素の漢字にする
  noRubyOnHit?: boolean; // ①漢字読み: 出題対象語(=hit)にはふりがなを出さない(読みが問題のため)
}) {
  const cells = parseCells(text);
  // 基底のフォントサイズを取り出し、ルビ列の基底 lineHeight をそれに合わせて詰める(ルビを漢字の真上に)。
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const baseFs = typeof flat?.fontSize === 'number' ? flat.fontSize : undefined;
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
        // レベル適応: rubyGate が false の漢字群はルビを出さず素の漢字にする。①対象語(hit)はnoRubyOnHitでルビ抑止。
        const showRuby = c.ruby != null && (!rubyGate || rubyGate(c.base)) && !(noRubyOnHit && c.hit);
        return (
          <View key={i} style={styles.col}>
            <Text style={[styles.ruby, rubyStyle]} numberOfLines={1}>{showRuby ? c.ruby : ' '}</Text>
            <Text style={[style, styles.base, baseFs ? { lineHeight: baseFs } : null, c.hit ? hitStyle : undefined]}>{c.base}</Text>
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
  // 基底(漢字/かな)のフォント上下パディングを除去。これを付けないとAndroidで行ボックス内の
  // グリフが下がり、ルビと漢字の間が広く開いて「ルビが高い位置に浮く」ように見える。
  base: { includeFontPadding: false },
});
