// リモートプッシュ通知の端末登録。ログイン確立時に「通知許可があれば」端末のExpoプッシュトークンを取得し、
// push_tokens に本人ぶんを直接保存(geoと同じ直書き方式・RLSで本人の行のみ)。トークンはサーバー内だけで使う。
// 実配信には EAS 側の APNs(iOS)/FCM(Android) 資格情報が必要(手動設定)。未設定でもアプリは無害に動く(トークン取得が失敗しても握る)。
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { ensureNotificationPermission } from '../store/notifications';

// app.json の expo.extra.eas.projectId と一致させる(Expoプッシュトークン取得に必要)。
const PROJECT_ID = '3590a434-66c9-4282-be7e-1f1c9d021c79';

/** ログイン確立時に呼ぶ。通知許可を得てExpoプッシュトークンを取得→push_tokensへupsert。失敗は握る(次回再試行)。 */
export async function registerPushToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    if (!(await ensureNotificationPermission())) return; // 許可されなければ登録しない(プッシュ無しで通常動作)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const res = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    const token = res?.data;
    if (!token) return;
    await supabase.from('push_tokens').upsert(
      { token, user_id: user.id, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
  } catch { /* 失敗は無視 */ }
}
