// 単語/試験/辞書タブの全画面背景イラスト(ユーザー提供・縦長853x1844≒スマホ比)。
// 各タブに昼/夜の2枚があり、端末の時刻に合わせて自動で切り替える。
// 背景の上に半透明の没入UI(和紙/ガラス調カード・透明タップ領域)を重ねる。
import { useEffect, useState } from 'react';
import { AppState, type ImageSourcePropType } from 'react-native';
import { daylightAt, type Daylight } from './daylight';

export type TabKey = 'word' | 'exam' | 'dict';
export { daylightAt, type Daylight };

// ホーム背景(ユーザー提供 HOME.png)。昼=home_bg.jpg / 夜=home_bg_night.jpg を時刻で切替。
export const HOME_BG_BY: Record<Daylight, ImageSourcePropType> = {
  day: require('../../assets/tabs/home_bg.jpg'),
  night: require('../../assets/tabs/home_bg_night.jpg'),
};
// 後方互換(昼)。現行の参照が残っていても壊れないように。
export const HOME_BG: ImageSourcePropType = HOME_BG_BY.day;

// 各タブの全画面背景(昼/夜)。word=単語タブ, exam=試験タブ, dict=辞書タブ。
export const TAB_BG: Record<TabKey, Record<Daylight, ImageSourcePropType>> = {
  word: { day: require('../../assets/tabs/word_bg_day.jpg'), night: require('../../assets/tabs/word_bg_night.jpg') },
  exam: { day: require('../../assets/tabs/exam_bg_day.jpg'), night: require('../../assets/tabs/exam_bg_night.jpg') },
  dict: { day: require('../../assets/tabs/dict_bg_day.jpg'), night: require('../../assets/tabs/dict_bg_night.jpg') },
};

// 辞書タブの書庫は、予想得点に応じて“復元されていく”5段階(昼夜の区別なし=常にこの5枚を使う・ユーザー指定2026-07-31)。
// しきい値T=合格点(passTotal)×1.1。予想得点がT以上でs5。それ未満は[0,T]を4分割してs1..s4。
export const DICT_DAY_STAGES: ImageSourcePropType[] = [
  require('../../assets/tabs/dict_bg_day_s1.jpg'),
  require('../../assets/tabs/dict_bg_day_s2.jpg'),
  require('../../assets/tabs/dict_bg_day_s3.jpg'),
  require('../../assets/tabs/dict_bg_day_s4.jpg'),
  require('../../assets/tabs/dict_bg_day_s5.jpg'),
];

// 予想得点(predScore)＋合格点(passTotal)→段階インデックス(0-4)。
// T=passTotal×1.1。predScore≥T→s5(4)。未満は[0,T]を4等分し s1..s4(0..3)。passTotalが未確定(≤0)ならs1。
export function dictStageIndex(predScore: number, passTotal: number): number {
  const T = (passTotal || 0) * 1.1;
  if (T <= 0) return 0;
  if ((predScore || 0) >= T) return 4;
  const i = Math.floor((predScore || 0) / (T / 4));
  return i < 0 ? 0 : i > 3 ? 3 : i;
}

// 「閉じ目版」全画面画像(元絵と目以外は完全同一のもの)。単語/辞書タブのキャラのまばたき用。
// アセットを受領したら下にrequireを追加(例: word: { day: require('../../assets/tabs/word_bg_day_blink.png'), night: ... })。
// 未登録のタブ/変種は blink なし(undefined)。
export const TAB_BLINK: Partial<Record<TabKey, Partial<Record<Daylight, ImageSourcePropType>>>> = {
  // word: { day: require('../../assets/tabs/word_bg_day_blink.png'), night: require('../../assets/tabs/word_bg_night_blink.png') },
  // dict: { day: require('../../assets/tabs/dict_bg_day_blink.png'), night: require('../../assets/tabs/dict_bg_night_blink.png') },
};

// 現在の昼/夜を返し、境界跨ぎ(60秒間隔)とフォアグラウンド復帰で自動更新するフック。
export function useDaylight(): Daylight {
  const [dl, setDl] = useState<Daylight>(() => daylightAt(new Date()));
  useEffect(() => {
    const update = () => setDl(daylightAt(new Date()));
    update();
    const id = setInterval(update, 60_000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') update(); });
    return () => { clearInterval(id); sub.remove(); };
  }, []);
  return dl;
}

// 指定タブの、いまの時刻に応じた背景を返す。
export function useTabBg(key: TabKey): ImageSourcePropType {
  return TAB_BG[key][useDaylight()];
}

// 辞書タブ背景: 予想得点で復元段階(s1..s5)を切替。昼夜の区別なし(常に同じ5枚・ユーザー指定)。
export function useDictBg(predScore: number, passTotal: number): ImageSourcePropType {
  return DICT_DAY_STAGES[dictStageIndex(predScore, passTotal)];
}

// ホーム背景の、いまの時刻に応じた昼/夜を返す。
export function useHomeBg(): ImageSourcePropType {
  return HOME_BG_BY[useDaylight()];
}

// 指定タブの、いまの時刻に応じた「閉じ目版」を返す(未登録なら undefined=まばたきなし)。
export function useTabBlink(key: TabKey): ImageSourcePropType | undefined {
  return TAB_BLINK[key]?.[useDaylight()];
}
