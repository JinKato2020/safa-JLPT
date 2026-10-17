// 下から出るボトムシート共通部品。閉じ方をアプリ全体で統一する:
//  ・スライドイン(animationType=slide) ・つまみを掴んで「下スワイプで閉じる」
//  ・本文が最上部にある時は、本文を下スワイプしても閉じる(スクロール可能でも一番上ならそのまま離脱)
//  ・背景タップで閉じる ・×ボタン(iOSは戻るボタンが無いため確実な逃げ道) ・高さ上限で背景を必ず残す。
// 中身(children)はそのまま差し込む=各シートの見た目は不変。子がScrollViewなら onScroll を差し込んで「最上部か」を追跡する。
import { useEffect, useMemo, useRef, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import { Modal, View, Text, Pressable, Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { useColors, type ThemeColors } from '../theme';

export default function SwipeSheet({ visible, onClose, children, maxHeightRatio = 0.85 }: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeightRatio?: number;
}) {
  const { height } = useWindowDimensions();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]); // ダーク時もシート地/つまみ/×をテーマ色に
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose; // 常に最新のonCloseを参照(PanResponderは初回生成のため)
  const atTop = useRef(true);   // 子ScrollViewが最上部にあるか(=下スワイプでシートごと閉じてよいか)

  // 開くたびに位置と「最上部」状態を初期化(前回ドラッグ/スクロールの残りを消す)。
  useEffect(() => { if (visible) { translateY.setValue(0); atTop.current = true; } }, [visible, translateY]);

  const springBack = () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 2 }).start();

  // つまみ帯=スクロール位置に関係なく常にドラッグで閉じられる(確実な逃げ道)。
  const handlePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_e, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_e, g) => { if (g.dy > 90 || g.vy > 0.8) onCloseRef.current(); else springBack(); },
      onPanResponderTerminate: springBack,
    })
  ).current;

  // 本文=「最上部で下方向」の明確なドラッグの時だけ横取り(capture)して閉じる。
  //  それ以外(上方向/途中スクロール)は横取りせず子のScrollViewに委ねる=通常スクロールは阻害しない。
  const sheetPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => atTop.current && g.dy > 6 && g.dy > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_e, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_e, g) => { if (g.dy > 90 || g.vy > 0.8) onCloseRef.current(); else springBack(); },
      onPanResponderTerminate: springBack,
    })
  ).current;

  // 子がScrollViewなら onScroll を差し込み、最上部(offsetY<=0)かを追跡。既存の onScroll があれば保持。
  const content = isValidElement(children)
    ? cloneElement(children as ReactElement<any>, {
        scrollEventThrottle: 16,
        onScroll: (e: any) => {
          atTop.current = (e?.nativeEvent?.contentOffset?.y ?? 0) <= 0;
          (children as ReactElement<any>).props.onScroll?.(e);
        },
      })
    : children;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[styles.sheet, { maxHeight: Math.round(height * maxHeightRatio), transform: [{ translateY }] }]}
        {...sheetPan.panHandlers}
      >
        <View style={styles.handleZone} {...handlePan.panHandlers}>
          <View style={styles.handle} />
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
          <Text style={styles.closeTxt}>×</Text>
        </Pressable>
        {content}
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  handleZone: { alignItems: 'center', paddingTop: 10, paddingBottom: 12 }, // 掴みやすいドラッグ帯
  handle: { height: 4, width: 40, borderRadius: 2, backgroundColor: c.trace },
  close: { position: 'absolute', top: 6, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: c.bgSoft, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  closeTxt: { fontSize: 19, lineHeight: 19, color: c.mute, fontWeight: '800', marginTop: -1 },
});
