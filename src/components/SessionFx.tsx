// 学習後の「花吹雪＋柴犬が数秒で消える」小演出(P1・純コード=RN Animated・現金¥0・OTA・依存追加なし)。
//  ・全画面の山場(合格ムービー)はAI動画で別途。ここは「日常の重ね演出」=透過が要るのでコードで描く。
//  ・頻度は減衰レイヤー 'session_fx' で自動で絞る(初期full=花吹雪+犬 / 慣れたらshort=花びら控えめ / やがてnone)。
//  ・付与(桜貝)には一切触れない。演出が none でも報酬は呼び出し側が別途付与済(§6-1)。数秒で自動的に消える。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppState, useAppActions } from '../store/store';
import { intensityFor } from '../story/decay';
import { SHOP_BY_ID } from '../data/shop';

const FX = 'session_fx';
const PETAL_COLORS = ['#f8c8dc', '#f6b6cf', '#fcd6e8', '#f4a9c4']; // 桜色の濃淡
const DURATION = 2600; // 1枚が落ちきる時間
const LINGER = 700;    // 最後の余韻(全部消えるまでの猶予)

interface PetalSpec { x: number; size: number; delay: number; sway: number; spin: number; color: string }

// 花びら1枚。progress(0→1)で上から下へ落ち、途中で最大不透明→最後に消える。useNativeDriverで軽量。
function Petal({ spec, height }: { spec: PetalSpec; height: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: DURATION, delay: spec.delay, easing: Easing.linear, useNativeDriver: true }).start();
  }, [p]);
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [-24, height + 24] });
  const translateX = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, spec.sway, 0] });
  const rotate = p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spec.spin}deg`] });
  const opacity = p.interpolate({ inputRange: [0, 0.12, 0.82, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View
      style={[
        styles.petal,
        {
          left: `${spec.x}%`,
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size,
          backgroundColor: spec.color,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
}

export default function SessionFx() {
  const state = useAppState();
  const { markStoryShown } = useAppActions();
  const { width } = useWindowDimensions();
  const H = Math.min(360, Math.round(width * 0.9));

  // マウント時に一度だけ強さを確定し「見せた」と記録(減衰=次第に控えめ/やがて出ない)。
  const [intensity] = useState(() => intensityFor(state.storyDecay, FX, { now: Date.now() }));
  const [done, setDone] = useState(false);

  // 花びらの本数=強さで変える(full=華やか / short=控えめ)。位置・揺れ・回転はランダムに。
  const petals = useMemo<PetalSpec[]>(() => {
    if (intensity === 'none') return [];
    const n = intensity === 'full' ? 16 : 7;
    return Array.from({ length: n }, () => ({
      x: Math.round(Math.random() * 92),
      size: 9 + Math.round(Math.random() * 8),
      delay: Math.round(Math.random() * 900),
      sway: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.round(Math.random() * 22)),
      spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.round(Math.random() * 360)),
      color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
    }));
  }, [intensity]);

  // full のときだけ、装備中の柴犬が下からぴょこっと現れて引っ込む(未装備なら犬なし)。
  const dog = intensity === 'full' && state.equipped?.companion ? SHOP_BY_ID[state.equipped.companion]?.asset : undefined;
  const dogY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (intensity === 'none') return;
    markStoryShown(FX);
    if (dog) {
      Animated.sequence([
        Animated.spring(dogY, { toValue: 1, delay: 250, friction: 5, tension: 90, useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(dogY, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
    const t = setTimeout(() => setDone(true), DURATION + 900 + LINGER);
    return () => clearTimeout(t);
  }, [intensity]); // eslint-disable-line react-hooks/exhaustive-deps

  if (intensity === 'none' || done) return null;

  const dogTranslate = dogY.interpolate({ inputRange: [0, 1], outputRange: [90, 0] });
  const dogOpacity = dogY.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] });

  return (
    <View style={[styles.wrap, { height: H }]} pointerEvents="none">
      {petals.map((sp, i) => <Petal key={i} spec={sp} height={H} />)}
      {dog && (
        <Animated.Image
          source={dog}
          resizeMode="contain"
          style={[styles.dog, { opacity: dogOpacity, transform: [{ translateY: dogTranslate }] }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 演出は結果カードの上に重ねる(触れない=pointerEvents none・数秒で消える)。
  wrap: { position: 'absolute', top: -300, left: 0, right: 0, overflow: 'visible', zIndex: 10 },
  petal: { position: 'absolute', top: 0 },
  dog: { position: 'absolute', bottom: 0, alignSelf: 'center', width: 84, height: 84 },
});
