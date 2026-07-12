// ソーシャルログイン(段階2: Google)。Supabase OAuth(Webフロー)＋端末ブラウザ＋ディープリンク復帰。
// 流れ: signInWithOAuth でGoogle認可URL取得 → openAuthSessionAsync でブラウザ認証 →
//        戻りURLの ?code= を exchangeCodeForSession でセッションに交換(PKCE)。
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

// ブラウザ認証セッションを正しく閉じるために必要(モジュール読込時に一度)。
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google';

/** Googleでログイン。成功時は空、失敗時は {error}(i18nキー or メッセージ)。ユーザーキャンセルは 'cancelled'。 */
export async function signInWithProvider(provider: OAuthProvider): Promise<{ error?: string }> {
  try {
    const redirectTo = Linking.createURL('auth-callback'); // 例 safajlpt://auth-callback
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) return { error: error?.message ?? 'account.err_oauth' };

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type === 'cancel' || res.type === 'dismiss') return { error: 'cancelled' };
    if (res.type !== 'success' || !res.url) return { error: 'account.err_oauth' };

    // 戻りURLからコード(PKCE)を取り出してセッションへ交換。
    const parsed = Linking.parse(res.url);
    const code = (parsed.queryParams?.code as string | undefined) ?? undefined;
    if (code) {
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      return exErr ? { error: exErr.message } : {};
    }

    // フォールバック: フラグメントにトークンが載る実装(implicit)への保険。
    const hashPart = res.url.includes('#') ? res.url.split('#')[1] : '';
    const hp = new URLSearchParams(hashPart);
    const access_token = hp.get('access_token');
    const refresh_token = hp.get('refresh_token');
    if (access_token && refresh_token) {
      const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
      return sErr ? { error: sErr.message } : {};
    }
    return { error: 'account.err_oauth' };
  } catch {
    return { error: 'account.err_oauth' };
  }
}

// Appleサインインは一時無効化(2026-07-12)。App IDに「Sign In with Apple」capabilityを付け、
// 配布用プロビジョニングプロファイル(J App Store CI)を再生成してCI secretを更新したら true に戻し、
// app.json plugins に "expo-apple-authentication" を再追加する。App Store提出前に有効化必須(ガイドライン4.8)。
const APPLE_SIGNIN_ENABLED = false;

/** Appleでサインイン(iOSのみ・ネイティブ)。identityTokenを signInWithIdToken でセッションへ。 */
export async function signInWithApple(): Promise<{ error?: string }> {
  if (!APPLE_SIGNIN_ENABLED) return { error: 'account.err_oauth' };
  if (Platform.OS !== 'ios') return { error: 'account.err_oauth' };
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) return { error: 'account.err_oauth' };
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    return error ? { error: error.message } : {};
  } catch (e) {
    // ユーザーがキャンセルした場合(ERR_REQUEST_CANCELED)はエラー表示しない。
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return { error: 'cancelled' };
    return { error: 'account.err_oauth' };
  }
}

/** Appleサインインがこの端末で使えるか(iOS + 対応OS)。 */
export async function isAppleAvailable(): Promise<boolean> {
  if (!APPLE_SIGNIN_ENABLED) return false; // 一時無効化中はボタンを出さない
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}
