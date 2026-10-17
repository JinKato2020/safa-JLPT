// 汎用スライダー(ネイティブ依存なし = PanResponder + onLayout)。追加パッケージ不要なので OTA で配信できる。
// ドラッグ中は内部 state だけ更新し、指を離した時に一度だけ onChange を呼ぶ
// (毎フレーム setSettings すると全 state 永続化+telemetry が多発するため)。
import { useRef, useState } from 'react';
import {
  View, Text, PanResponder, StyleSheet,
  type LayoutChangeEvent, type GestureResponderEvent, type PanResponderGestureState,
} from 'react-native';

const THUMB = 26;
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;        // 指を離した時に確定値で1回だけ呼ぶ
  trackColor: string;                   // 未通過トラック
  fillColor: string;                    // 通過トラック＋つまみ
  formatValue?: (v: number) => string;  // 値ラベル(既定 = 小数1桁)
}

export default function Slider({
  value, min, max, step = 0.1, onChange, trackColor, fillColor, formatValue,
}: Props) {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null); // ドラッグ中の表示値(離すと null)
  const widthRef = useRef(0);
  const trackXRef = useRef(0);       // トラック左端のページX(grant時に確定=ScrollView内でも正確)
  const valueRef = useRef(value);
  valueRef.current = value;

  const disp = drag ?? value;
  const fmt = formatValue ?? ((v: number) => v.toFixed(1));

  const snap = (v: number) => {
    const n = Math.round((v - min) / step) * step + min;
    return clampN(Math.round(n * 100) / 100, min, max);
  };
  const xToValue = (x: number) => {
    const usable = widthRef.current - THUMB;
    if (usable <= 0) return valueRef.current;
    const ratio = clampN((x - THUMB / 2) / usable, 0, 1);
    return snap(min + ratio * (max - min));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        trackXRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        setDrag(xToValue(e.nativeEvent.locationX));
      },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        setDrag(xToValue(g.moveX - trackXRef.current));
      },
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const v = xToValue(g.moveX - trackXRef.current);
        setDrag(null);
        onChange(v);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;

  const usable = Math.max(0, width - THUMB);
  const ratio = max > min ? clampN((disp - min) / (max - min), 0, 1) : 0;
  const thumbLeft = ratio * usable;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  return (
    <View style={st.row}>
      <View style={st.area} onLayout={onLayout} {...pan.panHandlers}>
        <View pointerEvents="none" style={[st.track, { backgroundColor: trackColor }]} />
        <View pointerEvents="none" style={[st.fill, { backgroundColor: fillColor, width: Math.max(0, thumbLeft) }]} />
        <View pointerEvents="none" style={[st.thumb, { backgroundColor: fillColor, left: thumbLeft }]} />
      </View>
      <Text style={[st.val, { color: fillColor }]}>{fmt(disp)}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  area: { flex: 1, height: 40, justifyContent: 'center' },
  track: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 5, borderRadius: 3 },
  fill: { position: 'absolute', left: THUMB / 2, height: 5, borderRadius: 3 },
  thumb: {
    position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  val: { minWidth: 46, textAlign: 'right', fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] },
});
