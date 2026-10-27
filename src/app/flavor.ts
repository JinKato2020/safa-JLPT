// アプリの"殻"(フレーバー)判定。1コードベースから没入版/ミニマル版を焼き分ける土台。
// 判定は bundle id / package 名から導出(ミニマル殻アプリは別bundle id= '….minimal' で出す想定)。
// → ビルド時フラグの配線なしで、アプリごとに自動で flavor が決まる。
// 2アプリ戦略の詳細はメモリ two-app-strategy-shared-backend-minimal-shell を参照。
import * as Application from 'expo-application';
import type { Settings } from '../store/state';

export type AppFlavor = 'immersive' | 'minimal';

// ミニマル殻アプリの bundle id / package 名。追加の殻を出す時はここに足す。
// 没入版 = com.safa.english / ミニマル殻 = com.safa.jlpt2(アプリ名 "Mainichi JLPT lite")。
const MINIMAL_BUNDLE_IDS = ['com.safa.jlpt2'];
export const APP_FLAVOR: AppFlavor =
  MINIMAL_BUNDLE_IDS.includes(Application.applicationId ?? '') ? 'minimal' : 'immersive';

// ミニマル殻アプリでは simpleMode を既定ON＋固定(ユーザー設定より優先)。
export const FLAVOR_FORCES_SIMPLE = APP_FLAVOR === 'minimal';

/** シンプルモードが有効か。ミニマル殻は常にtrue、没入版は設定のトグルに従う。 */
export function isSimpleMode(settings: Pick<Settings, 'simpleMode'>): boolean {
  return FLAVOR_FORCES_SIMPLE || settings.simpleMode === true;
}
