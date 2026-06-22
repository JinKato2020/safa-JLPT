// 学習リマインドのローカル通知(無料・expo-notifications)。Web/一部Expo Goは制限→try/catchで安全に。
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensurePermission(): Promise<boolean> {
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

/** 毎日 time("HH:MM") にリマインド。既存をクリアして1件だけ登録。成功で true。 */
export async function scheduleDailyReminder(time: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!(await ensurePermission())) return false;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminder', {
        name: '学習リマインド',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    const [h, m] = time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'まいにちJLPT', body: '今日の一手で到達度を伸ばそう 🔥' },
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
