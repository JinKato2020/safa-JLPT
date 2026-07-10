// 音声配信元(GitHub Pages)の共通定数＋URL解決。ネイティブ依存を持たない=node테스트可。
// repo/移行時はこの1行だけ差し替え。既存聴解=<base>/<id>.mp3、語彙=<base>vocab/<id>.mp3。
export const AUDIO_BASE_URL = 'https://jinkato2020.github.io/safa-JLPT/assets/audio/';

/** 語彙読み上げ音声のURL。id=vocab.jsonのid(例 n5-v-1)。 */
export function vocabAudioUrl(id: string): string {
  return `${AUDIO_BASE_URL}vocab/${id}.mp3`;
}

/** 漢字代表音声のURL。char=漢字1字(例 川)。事前生成158字分・無ければ語彙mp3/TTSにフォールバック。 */
export function kanjiAudioUrl(char: string): string {
  return `${AUDIO_BASE_URL}kanji/${encodeURIComponent(char)}.mp3`;
}

/** 解説L10n配信元(GitHub Pages)。非日本語解説を言語別JSONで配信。 */
export const L10N_BASE_URL = 'https://jinkato2020.github.io/safa-JLPT/assets/l10n/';

/** 言語別解説JSONのURL。lang=en/zh/ko/vi/th/id/my/bn/ne 等。 */
export function explainL10nUrl(lang: string): string {
  return `${L10N_BASE_URL}explain.${lang}.json`;
}
