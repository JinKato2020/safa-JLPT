// 招待を受けた人の画面(招待リンク safajlpt://invite?u=<ownerの user_id> から開く)。
// 「町に参加する / 断る」の2択。参加を選ぶと、招待を出した人(owner)の町にだけ自分が住人として現れる(片方向)。
// 参加にはログイン必須。参加時に自分の公開プロフィールを publish してから town_join する。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState } from '../store/store';
import { useSync } from '../auth/SyncProvider';
import { avatarOf } from '../plaza/avatars';
import { flagOf, countryLabel } from '../plaza/countries';
import { daimonMasteryCounts } from '../store/selectors';
import { townInviter, townJoin, friendPublish, type FriendProfile } from '../plaza/friendsClient';

export default function InviteScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Invite'>>();
  const owner = route.params?.u ?? '';
  const state = useAppState();
  const { session } = useSync();

  const [inviter, setInviter] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = owner ? await townInviter(owner) : null;
      if (!cancelled) { setInviter(p); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [owner]);

  const onJoin = async () => {
    if (!owner) return;
    if (!session) { nav.navigate('Account'); return; } // 参加にはログイン必須。ログイン後にリンクを開き直してもらう。
    setJoining(true);
    try {
      const st = state.settings;
      if (st.nickname) {
        const learned = daimonMasteryCounts(state, Date.now()).reduce((a, b) => a + b.learned, 0);
        await friendPublish({
          nickname: st.nickname, country: st.country ?? null, gender: st.gender ?? null,
          avatar: st.avatar ?? 'm_boy1', level: st.level, streak: state.streak?.current ?? 0,
          learned, weekLearned: 0, studying: st.studying ?? null, strong: null,
          personality: st.personality ?? null, moodMsg: st.moodMsg ?? null,
        });
      }
      if (await townJoin(owner)) setJoined(true);
    } finally { setJoining(false); }
  };

  const name = inviter ? `${flagOf(inviter.country ?? 'XX')} ${inviter.nickname}` : 'お友だち';
  const img = inviter ? avatarOf(inviter.avatar).image : null;

  return (
    <SafeAreaView style={s.c} edges={['top', 'bottom']}>
      <Pressable style={s.close} onPress={() => nav.goBack()} hitSlop={12}><Text style={s.closeTxt}>✕</Text></Pressable>
      <View style={s.body}>
        {loading ? (
          <ActivityIndicator color={c.blue} />
        ) : joined ? (
          <>
            <Text style={s.emoji}>🎉</Text>
            <Text style={s.title}>{name}の町に参加しました！</Text>
            <Text style={s.sub}>これからあなたは、{inviter?.nickname ?? '友だち'}さんの町に住人として現れます。</Text>
            <Pressable style={s.primary} onPress={() => nav.navigate('KotobaTown')}>
              <Text style={s.primaryT}>町を見にいく</Text>
            </Pressable>
          </>
        ) : (
          <>
            {img != null ? <Image source={img} style={s.av} resizeMode="contain" /> : <Text style={s.emoji}>🏘️</Text>}
            <Text style={s.title}>{name}が{'\n'}町にあなたを招待しています</Text>
            {inviter ? (
              <Text style={s.meta}>{inviter.level}・{countryLabel(inviter.country, 'ja')}・覚えた単語 {inviter.learned}語</Text>
            ) : (
              <Text style={s.meta}>この招待は少し前のものか、無効かもしれません。</Text>
            )}
            <Text style={s.sub}>参加すると、あなたが{inviter?.nickname ?? '相手'}さんの町に住人として現れます。{!session ? '\n(参加にはログインが必要です)' : ''}</Text>
            <Pressable style={[s.primary, (joining || !owner) && s.off]} disabled={joining || !owner} onPress={onJoin}>
              {joining ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryT}>{session ? '町に参加する' : 'ログインして参加'}</Text>}
            </Pressable>
            <Pressable style={s.ghost} onPress={() => nav.goBack()}>
              <Text style={s.ghostT}>断る</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    close: { alignSelf: 'flex-end', padding: spacing.lg },
    closeTxt: { fontSize: ty.h2, color: c.mute, fontWeight: '700' },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
    emoji: { fontSize: 56 },
    av: { width: 120, height: 130 },
    title: { fontSize: ty.h1, fontWeight: '900', color: c.ink, textAlign: 'center', lineHeight: 32 },
    meta: { fontSize: ty.body, color: c.ink2, fontWeight: '800', textAlign: 'center' },
    sub: { fontSize: ty.body, color: c.mute, textAlign: 'center', lineHeight: 22, marginBottom: spacing.sm },
    primary: { backgroundColor: c.blue, borderRadius: radius.pill, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, minWidth: 220, alignItems: 'center' },
    primaryT: { color: '#fff', fontWeight: '900', fontSize: ty.body },
    off: { opacity: 0.5 },
    ghost: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
    ghostT: { color: c.mute, fontWeight: '800', fontSize: ty.body },
  });
