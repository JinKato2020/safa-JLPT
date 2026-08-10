// AsyncStorage 永続化(Web では localStorage に自動マップ)。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AppState, STATE_VERSION, DEFAULT_HAIR_ID, DEFAULT_OWNED, DEFAULT_COMPANION_ID, COMPANION_IDS } from './state';
import { KANJI, VOCAB, GRAMMAR } from '../data';
import KB_ID_MIGRATION from '../data/exam/kbIdMigration.json';
import { migrateMastery } from '../review/migrateMastery';

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

// 不変id移行: 旧 bk:<lv>:<daimon>:<idx> 状態キーを新 kb-NNNNNN へ改名。冪等(既に kb- 等は保持)。
const KB_ID_MAP = KB_ID_MIGRATION as Record<string, string>;
export function migrateBankIds<T>(items: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key in items) {
    if (key.startsWith('bk:') && KB_ID_MAP[key]) { out[KB_ID_MAP[key]] = items[key]; continue; }
    out[key] = items[key];
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
    if (parsed.items) parsed.items = migrateBankIds(parsed.items);
    // 既定アイテム(ロング髪・筆なし・民族衣装なし)を既存ユーザーにも補完: 所持に無ければ追加(装備を外せるように)。
    // 髪型が未装備なら標準=ロングを装備(既にショート等を装備中なら本人の選択を尊重して上書きしない)。
    const own = new Set(parsed.owned ?? []);
    for (const id of DEFAULT_OWNED) own.add(id);
    parsed.owned = [...own];
    if (!parsed.equipped?.hair) parsed.equipped = { ...(parsed.equipped ?? {}), hair: DEFAULT_HAIR_ID };
    // 仲間: 未装備、または旧仮ペット等の無効IDなら「はじめの仲間(柴1)」を装備。有効な柴を装備中なら本人の選択を尊重。
    if (!COMPANION_IDS.includes(parsed.equipped?.companion ?? '')) parsed.equipped = { ...(parsed.equipped ?? {}), companion: DEFAULT_COMPANION_ID };
    // 面別マスタリー移行(一度きり・冪等)。キー正規化(daimon/bank)後の items/kakitori を面へ寄せる。
    return migrateMastery(parsed, Date.now());
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
    // 注意: TRIAL_KEY は消さない。お試し起点は端末で一度きり=退会/リセットでも保持し、再取得(荒稼ぎ)を防ぐ。
  } catch {
    /* noop */
  }
}

// 無料お試しの起点(epoch ms)を保持する「消えない別キー」。匿名ID(safa-jlpt:anonId)と同じ思想で、
// アプリ状態(KEY)とは別に持つ。clearState では消さない=退会/リセットしてもお試しは復活しない。
// 完全アンインストールでのみ消える(=新品端末扱い。これは匿名IDと同じ限界)。
const TRIAL_KEY = 'safa-jlpt:trialStart';

/** お試し起点を返す。未保存なら seed(既存ユーザーは installedAt、無ければ now)で確定して保存。 */
export async function ensureTrialStart(now: number, fallbackInstalledAt?: number): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(TRIAL_KEY);
    const saved = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(saved) && saved > 0) return saved;
    const seed = fallbackInstalledAt && fallbackInstalledAt > 0 ? fallbackInstalledAt : now;
    await AsyncStorage.setItem(TRIAL_KEY, String(seed));
    return seed;
  } catch {
    // 読み書き失敗時は now を起点扱い(お試しを不当に消さない安全側)。
    return fallbackInstalledAt && fallbackInstalledAt > 0 ? fallbackInstalledAt : now;
  }
}
