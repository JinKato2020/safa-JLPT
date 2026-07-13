// ホーム下部の案内キャラ(桜の巫女)。ふわふわ＋瞬き(6秒に2回)＋AIコーチの吹き出し。
// 吹き出しは時々自動で出る／消えている時はキャラをタップで出す。目だけ差し替えの重ね替えで瞬き。
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Animated, Easing, StyleSheet } from 'react-native';
import { GUIDE } from '../data/mywordsArt';

const RATIO = 670 / 600; // アセット縦横比

export type GuideAdvice = { title: string; hl: string; lines: string[] };

export default function HomeGuide({ advice, width = 150 }: { advice: GuideAdvice; width?: number }) {
  const floatY = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current; // 1=目を閉じた絵を重ねる
  const [visible, setVisible] = useState(false);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const f = Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: -8, duration: 2300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(floatY, { toValue: 0, duration: 2300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    // 6秒周期で2回瞬き
    const once = () => Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]);
    const b = Animated.loop(Animated.sequence([
      Animated.delay(2500), once(), Animated.delay(180), once(), Animated.delay(2870),
    ]));
    f.start(); b.start();
    return () => { f.stop(); b.stop(); };
  }, []);

  const showBubble = () => {
    setVisible(true);
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => setVisible(false), 8000);
  };
  useEffect(() => {
    const first = setTimeout(showBubble, 2600);
    const iv = setInterval(showBubble, 22000);
    return () => { clearTimeout(first); clearInterval(iv); if (hideRef.current) clearTimeout(hideRef.current); };
  }, []);
  const onTap = () => {
    if (visible) { setVisible(false); if (hideRef.current) clearTimeout(hideRef.current); }
    else showBubble();
  };

  const h = width * RATIO;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {visible ? (
        <View style={styles.bubbleWrap} pointerEvents="box-none">
          <Pressable style={styles.bubble} onPress={onTap}>
            <Text style={styles.bTitle}>{advice.title}</Text>
            <Text style={styles.bHl}>{advice.hl}</Text>
            {advice.lines.slice(0, 3).map((ln, i) => (
              <Text key={i} style={styles.bLine} numberOfLines={2}>・{ln}</Text>
            ))}
            <View style={styles.tail} />
          </Pressable>
        </View>
      ) : null}
      <Pressable onPress={onTap} accessibilityLabel={advice.title}>
        <Animated.View style={{ width, height: h, transform: [{ translateY: floatY }] }}>
          <Image source={GUIDE.open} style={{ width, height: h }} resizeMode="contain" />
          <Animated.Image source={GUIDE.blink} style={{ position: 'absolute', width, height: h, opacity: blink }} resizeMode="contain" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // 吹き出しはキャラの上に絶対配置=表示時にキャラを押し出さない(前に出ない)。
  bubbleWrap: { position: 'absolute', bottom: '100%', left: 0, right: 0, alignItems: 'center', paddingBottom: 4 },
  bubble: {
    maxWidth: 250, backgroundColor: 'rgba(255,253,248,0.97)', borderRadius: 16, borderBottomRightRadius: 5,
    paddingVertical: 9, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(184,146,74,0.5)',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  bTitle: { fontSize: 10.5, fontWeight: '800', color: '#b8924a', letterSpacing: 0.5 },
  bHl: { fontSize: 13.5, fontWeight: '900', color: '#5b3b45', marginTop: 1, lineHeight: 19 },
  bLine: { fontSize: 11.5, fontWeight: '600', color: '#6b5a48', marginTop: 2, lineHeight: 16 },
  tail: { position: 'absolute', bottom: -8, right: 26, width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'rgba(255,253,248,0.97)' },
});
