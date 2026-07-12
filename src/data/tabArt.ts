// 単語/試験/辞書タブの全画面背景イラスト(ユーザー提供・縦長853x1844≒スマホ比)。
// 各タブに昼/夜の2枚があり、端末の時刻に合わせて自動で切り替える。
// 背景の上に半透明の没入UI(和紙/ガラス調カード・透明タップ領域)を重ねる。
import { useEffect, useState } from 'react';
import { AppState, type ImageSourcePropType } from 'react-native';
import { daylightAt, type Daylight } from './daylight';

export type TabKey = 'word' | 'exam' | 'dict';
export { daylightAt, type Daylight };

// ホーム背景(ユーザー提供 HOME.png)。昼夜なしの単一画像。
export const HOME_BG: ImageSourcePropType = require('../../assets/tabs/home_bg.jpg');

// 各タブの全画面背景(昼/夜)。word=単語タブ, exam=試験タブ, dict=辞書タブ。
export const TAB_BG: Record<TabKey, Record<Daylight, ImageSourcePropType>> = {
  word: { day: require('../../assets/tabs/word_bg_day.jpg'), night: require('../../assets/tabs/word_bg_night.jpg') },
  exam: { day: require('../../assets/tabs/exam_bg_day.jpg'), night: require('../../assets/tabs/exam_bg_night.jpg') },
  dict: { day: require('../../assets/tabs/dict_bg_day.jpg'), night: require('../../assets/tabs/dict_bg_night.jpg') },
};

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

// 指定タブの、いまの時刻に応じた「閉じ目版」を返す(未登録なら undefined=まばたきなし)。
export function useTabBlink(key: TabKey): ImageSourcePropType | undefined {
  return TAB_BLINK[key]?.[useDaylight()];
}
