// 例文を表示し、対象部分(語/漢字/文法点)に下線を引く共通コンポーネント。全画面で統一使用。
import { Text, type TextStyle, type StyleProp } from 'react-native';
import { highlightSegments } from '../quiz/highlight';

export default function HighlightedText({
  text, target, style, hitStyle,
}: {
  text: string;
  target: string;
  style?: StyleProp<TextStyle>;
  hitStyle?: StyleProp<TextStyle>;
}) {
  const segs = highlightSegments(text, target);
  return (
    <Text style={style}>
      {segs.map((sg, i) => (
        <Text key={i} style={sg.hit ? hitStyle : undefined}>{sg.text}</Text>
      ))}
    </Text>
  );
}
