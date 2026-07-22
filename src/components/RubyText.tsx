// 漢字の上に小さくふりがな(ルビ)を載せて表示する共通コンポーネント。
// 入力テキストは「漢字（かな）」形式(既存データと同じ)。漢字連(熟語)＋（読み）を1ルビセルにまとめる。
// target(語/文法点)にマッチする部分は下線(hitStyle)。〜を含む文法点(A〜B型)も両部分に下線。
import { View, Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
// 基底テキストは親の大きな lineHeight を引き継ぐと、グリフが行ボックス中央に来て
// ルビとの間が空き「ルビが高い位置に浮く」。ルビ列では lineHeight を fontSize に詰めて真上に寄せる。
import { highlightHits } from '../quiz/highlight';

// ふりがな区切りは全角（）・半角()の両方を受ける(sentenceFuri等はkuroshiro既定の半角、文法データは全角)。
// 第1群=漢字群＋読み(ルビ表示)。第2群=カタカナ群＋かな読み=カタカナに不要なひらがなルビは出さない(読みを捨てて素のカタカナだけ表示)。第3群=その他1文字。
// ※カタカナ後の（…）でも中身がかな以外(例: カレー（辛口）の説明)なら第2群に一致せず、注記としてそのまま残す。
const RUBY_RE = /([一-鿿㐀-䶿々〆〇ヶ]+)[（(]([^）)]*)[）)]|([ァ-ヴーヵヶ・]+)[（(][ぁ-んァ-ヴー]+[）)]|([\s\S])/gu;

interface Cell { base: string; ruby?: string; hit?: boolean; segs?: { text: string; hit: boolean }[]; }

function parseCells(text: string): Cell[] {
  const cells: Cell[] = [];
  let m: RegExpExecArray | null;
  RUBY_RE.lastIndex = 0;
  while ((m = RUBY_RE.exec(text))) {
    if (m[1] !== undefined) cells.push({ base: m[1], ruby: m[2] });
    else if (m[3] !== undefined) cells.push({ base: m[3] }); // カタカナ＋かな読み=読みを捨ててルビ無し(不要なひらがなルビを出さない)
    else cells.push({ base: m[4]! });
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
  // flex系プロパティは各文字の基底テキストに載せない。1文字ずつが伸縮対象になると
  // 列(col)の高さ計算が壊れ、折り返し時に2行目が大きく押し下げられて行間が異常に開く。
  // 幅は親(choiceRubyWrap 等の flex:1)が確保するので、基底テキストに flex は不要。
  let baseStyle: TextStyle | undefined = flat;
  if (flat && ('flex' in flat || 'flexGrow' in flat || 'flexBasis' in flat || 'flexShrink' in flat)) {
    baseStyle = { ...flat };
    delete baseStyle.flex; delete baseStyle.flexGrow; delete baseStyle.flexBasis; delete baseStyle.flexShrink;
  }
  // ルビの行高は必ずフォントサイズ以上を確保する。rubyStyleでfontSizeだけ上書きされ行高が9pxのまま
  // 残る画面があり(例: 本文ルビfontSize10×行高9)、ルビ字形が箱を下にはみ出して漢字の頭に被っていた。
  // 「漢字の上部がルビで隠れる」不具合を全画面共通でここで防ぐ(行高=フォントサイズの1.25倍を最低保証)。
  const rubyFlat = StyleSheet.flatten(rubyStyle) as TextStyle | undefined;
  const rubyFs = typeof rubyFlat?.fontSize === 'number' ? rubyFlat.fontSize : 9;
  const rubyLh = Math.max(typeof rubyFlat?.lineHeight === 'number' ? rubyFlat.lineHeight : 0, Math.ceil(rubyFs * 1.25));
  const plain = cells.map((c) => c.base).join('');
  const hits = target ? highlightHits(plain, target) : [];
  let off = 0;
  for (const c of cells) {
    // セル内を「対象文字/非対象文字」の連続ランに分割。多字1ルビセル(江戸時代 等)でも
    // 対象漢字(代 等)だけに下線が引けるようにする(セル全体下線=オーバースパンの修正)。
    const segs: { text: string; hit: boolean }[] = [];
    let anyHit = false;
    for (let i = 0; i < c.base.length; i++) {
      const hit = !!hits[off + i];
      if (hit) anyHit = true;
      const last = segs[segs.length - 1];
      if (last && last.hit === hit) last.text += c.base[i];
      else segs.push({ text: c.base[i], hit });
    }
    c.hit = anyHit; // ルビ抑止(noRubyOnHit)判定は従来どおりセル内に1つでもヒットがあるか
    c.segs = segs;
    off += c.base.length;
  }
  return (
    <View style={[styles.row, center && styles.center]}>
      {cells.map((c, i) => {
        // レベル適応: rubyGate が false の漢字群はルビを出さず素の漢字にする。①対象語(hit)はnoRubyOnHitでルビ抑止。
        const showRuby = c.ruby != null && (!rubyGate || rubyGate(c.base)) && !(noRubyOnHit && c.hit);
        return (
          <View key={i} style={styles.col}>
            <Text style={[styles.ruby, rubyStyle, { lineHeight: rubyLh }]} numberOfLines={1}>{showRuby ? c.ruby : ' '}</Text>
            <Text style={[baseStyle, styles.base, baseFs ? { lineHeight: baseFs } : null]}>
              {c.hit
                ? c.segs!.map((seg, j) => (seg.hit ? <Text key={j} style={hitStyle}>{seg.text}</Text> : <Text key={j}>{seg.text}</Text>))
                : c.base}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', rowGap: 2 },
  center: { justifyContent: 'center' },
  col: { alignItems: 'center', gap: 2 },
  ruby: { fontSize: 9, lineHeight: 9, textAlign: 'center', includeFontPadding: false },
  // 基底(漢字/かな)のフォント上下パディングを除去。これを付けないとAndroidで行ボックス内の
  // グリフが下がり、ルビと漢字の間が広く開いて「ルビが高い位置に浮く」ように見える。
  base: { includeFontPadding: false },
});
