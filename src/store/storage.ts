// AsyncStorage 永続化(Web では localStorage に自動マップ)。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AppState, STATE_VERSION } from './state';
import { KANJI, VOCAB, GRAMMAR } from '../data';

const KEY = 'safa-jlpt:state:v1';

// 大問化移行: 旧「項目id」状態を「項目#大問」キーへ。語彙→文脈規定/文法→文法形式、単体漢字は破棄、
// 読解/聴解の設問idはそのまま。冪等(既に#付きは保持)。ユーザー指定(A)＋既定の移行方針。
const KANJI_IDS = new Set(KANJI.map((k) => k.id));
const VOCAB_IDS = new Set(VOCAB.map((v) => v.id));
const GRAMMAR_IDS = new Set(GRAMMAR.map((g) => g.id));
function migrateDaimonKeys<T>(items: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key in items) {
    if (key.includes('#')) { out[key] = items[key]; continue; } // 既に大問化済
    if (KANJI_IDS.has(key)) continue;                            // 単体漢字は廃止＝破棄
    if (VOCAB_IDS.has(key)) { out[`${key}#context`] = items[key]; continue; }        // 語彙→文脈規定
    if (GRAMMAR_IDS.has(key)) { out[`${key}#grammar_form`] = items[key]; continue; } // 文法→文法形式
    out[key] = items[key]; // 読解/聴解の設問id 等はそのまま
  }
  return out;
}

export async function loadState(): Promise<AppState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== STATE_VERSION) return null; // 将来のマイグレーション地点
    if (parsed.items) parsed.items = migrateDaimonKeys(parsed.items);
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
