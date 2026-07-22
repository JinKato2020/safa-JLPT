// AIコーチの助言モーダル。全タブ共通の上部アイコン(✦)から開く=他の上部アイコンと同じ挙動。
//  ・現在の指標(合格率・各分野の到達度)から、いちばん弱い分野を優先して案内。
//  ・カード配色はテーマを反映: 面色(surface)地＋テーマ文字色(ink)＋テーマ別アクセント帯。
//    → ライト/ダーク/水彩のどれでも地色・文字色がテーマに追従する(旧: 常に青で非追従だった)。
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../theme';
import { useT } from '../i18n';
import { useAppState } from '../store/store';
import { homeStatus } from '../home/homeStatus';

// 水彩テーマ(桜/空/緑/藤/茜)の代表色。ライト/ダーク/autoは brand 青(c.blue)。カードのアクセントに使う。
const TINT: Record<string, string> = {
  sakura: '#d76b8c', sky: '#4a8fcf', green: '#42a066', fuji: '#7d68c6', akane: '#d97840',
};

export default function AICoachScreen() {
  const c = useColors();
  const t = useT();
  const nav = useNavigation();
  const state = useAppState();
  const accent = TINT[state.settings.theme ?? 'auto'] ?? c.blue;

  const advice = useMemo(() => {
    const status = homeStatus(state, Date.now());
    const subs = status.subjects;
    const weakest = subs.reduce((a, b) => (b.pct < a.pct ? b : a), subs[0]);
    const p = status.passPct;
    const hlKey = p >= 70 ? 'home.ai_hl_pass' : p >= 50 ? 'home.ai_hl_close' : p >= 20 ? 'home.ai_hl_build' : 'home.ai_hl_start';
    const cat = t(weakest.labelKey);
    return {
      title: t('home.ai_title'),
      hl: t(hlKey),
      lines: [t('home.ai_passprob', { n: p }), t('home.ai_weak', { cat, pct: weakest.pct }), t('home.ai_advice', { action: cat })],
    };
  }, [state, t]);

  return (
    <Pressable style={styles.backdrop} onPress={() => nav.goBack()}>
      {/* カード=テーマ面色地＋テーマ文字色。左にテーマ・アクセント帯。カード/背景どこをタップしても閉じる。 */}
      <Pressable
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
        onPress={() => nav.goBack()}
        accessibilityLabel={advice.title}
      >
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={16} color={accent} />
            <Text style={[styles.title, { color: accent }]}>{advice.title}</Text>
          </View>
          <Text style={[styles.hl, { color: c.ink }]}>{advice.hl}</Text>
          {advice.lines.map((ln, i) => (
            <Text key={i} style={[styles.line, { color: c.ink2 }]} numberOfLines={3}>・{ln}</Text>
          ))}
        </View>
        <Ionicons name="close" size={20} color={c.faint} style={styles.close} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    flexDirection: 'row', width: '100%', maxWidth: 360, borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  accentBar: { width: 6 },
  body: { flex: 1, paddingVertical: 16, paddingLeft: 16, paddingRight: 34 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  hl: { fontSize: 17, fontWeight: '900', marginTop: 6, lineHeight: 23 },
  line: { fontSize: 13.5, fontWeight: '600', marginTop: 6, lineHeight: 19 },
  close: { position: 'absolute', top: 10, right: 10 },
});
