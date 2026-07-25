// ソーシャルログイン(段階2: Google)。Supabase OAuth(Webフロー)＋端末ブラウザ＋ディープリンク復帰。
// 流れ: signInWithOAuth でGoogle認可URL取得 → openAuthSessionAsync でブラウザ認証 →
//        戻りURLの ?code= を exchangeCodeForSession でセッションに交換(PKCE)。
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../config/supabase';
// Apple は Google と同じ Supabase の Web OAuth フローで実装(ネイティブ expo-apple-authentication は使わない)。
// 理由: ネイティブ版はインストールだけで applesignin entitlement が自動付与され、現行の配布プロファイルでは
// 署名が通らずビルドが落ちた(build 1392/1393 ARCHIVE FAILED)。Web フローはこの権限を要求しないため署名を壊さない。
// ネイティブUI(iOSの標準シート)にしたい場合は、App IDに Sign In with Apple 付与→プロファイル再生成→CI secret更新
// のうえで expo-apple-authentication を再導入する(別途)。Web フローには Apple の「サービスID」設定が必要。

// ブラウザ認証セッションを正しく閉じるために必要(モジュール読込時に一度)。
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

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

/** Appleでサインイン。Google と同じ Web OAuth フロー(署名を壊さない)。成功時は空、キャンセルは 'cancelled'。 */
export async function signInWithApple(): Promise<{ error?: string }> {
  return signInWithProvider('apple');
}

/** Apple ボタンを出すか。iOS のみ表示(Apple の要件＝他社ログインを出すなら Apple も出す、に対応)。 */
export async function isAppleAvailable(): Promise<boolean> {
  return Platform.OS === 'ios';
}
