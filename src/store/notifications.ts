// 学習リマインドのローカル通知(無料・expo-notifications)。Web/一部Expo Goは制限→try/catchで安全に。
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { translate } from '../i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** 通知許可を確認し、無ければ一度だけ要求。許可されたら true。リマインドとプッシュで共用。 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/** 毎日 time("HH:MM") にリマインド。既存をクリアして1件だけ登録。成功で true。lang=登録時のUI言語で本文を母語化。 */
export async function scheduleDailyReminder(time: string, lang = 'ja'): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!(await ensureNotificationPermission())) return false;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminder', {
        name: translate(lang, 'notif.channel'),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    const [h, m] = time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'まいにちJLPT', body: translate(lang, 'notif.body') },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h, minute: m },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // noop
  }
}
