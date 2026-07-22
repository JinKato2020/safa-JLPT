// 下から出るボトムシート共通部品。閉じ方をアプリ全体で統一する:
//  ・スライドイン(animationType=slide) ・つまみを掴んで「下スワイプで閉じる」
//  ・背景タップで閉じる ・×ボタン(iOSは戻るボタンが無いため確実な逃げ道) ・高さ上限で背景を必ず残す。
// 中身(children)はそのまま差し込む=各シートの見た目は不変。
import { useEffect, useRef, type ReactNode } from 'react';
import { Modal, View, Text, Pressable, Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';

export default function SwipeSheet({ visible, onClose, children, maxHeightRatio = 0.85 }: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeightRatio?: number;
}) {
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose; // 常に最新のonCloseを参照(PanResponderは初回生成のため)

  // 開くたびに位置を初期化(前回ドラッグの残りを消す)。
  useEffect(() => { if (visible) translateY.setValue(0); }, [visible, translateY]);

  const springBack = () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 2 }).start();

  // つまみ帯だけをドラッグ対象にする(中のScrollViewと競合させない)。下へ一定量/勢いで閉じる。
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_e, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_e, g) => { if (g.dy > 90 || g.vy > 0.8) onCloseRef.current(); else springBack(); },
      onPanResponderTerminate: springBack,
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { maxHeight: Math.round(height * maxHeightRatio), transform: [{ translateY }] }]}>
        <View style={styles.handleZone} {...pan.panHandlers}>
          <View style={styles.handle} />
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
          <Text style={styles.closeTxt}>×</Text>
        </Pressable>
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  handleZone: { alignItems: 'center', paddingTop: 10, paddingBottom: 12 }, // 掴みやすいドラッグ帯
  handle: { height: 4, width: 40, borderRadius: 2, backgroundColor: '#ccc' },
  close: { position: 'absolute', top: 6, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: '#f1efe9', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  closeTxt: { fontSize: 19, lineHeight: 19, color: '#8a7a63', fontWeight: '800', marginTop: -1 },
});
