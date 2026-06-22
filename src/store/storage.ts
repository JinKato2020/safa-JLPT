// AsyncStorage 永続化(Web では localStorage に自動マップ)。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AppState, STATE_VERSION } from './state';

const KEY = 'safa-jlpt:state:v1';

export async function loadState(): Promise<AppState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== STATE_VERSION) return null; // 将来のマイグレーション地点
    return parsed;
  } catch {
    return null;
  }
}

export async function saveState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 永続化失敗は致命ではない(次回保存で回復)
  }
}

export async function clearState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
