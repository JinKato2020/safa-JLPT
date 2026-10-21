// 学校ライセンスPro（導出型）の端末キャッシュ層。schoolFlag(純ストア)と AsyncStorage をつなぐ。
//  ・initSchoolFlag: 起動時にキャッシュで即反映（ログイン同期が終わるまでの“Pro空白”を防ぐ）。
//  ・applySchoolLicense: 同期で得た license をフラグへ反映＋キャッシュ更新（null=未所属でキャッシュ削除）。
// 正本は member_status()（サーバ・メール導出）。ここはその結果を端末に映すだけ＝クラウドに保存しない。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSchoolLicenseUntil } from './schoolFlag';

const CACHE_KEY = 'school_license_until_v1';

/** 起動時に1回: キャッシュから即反映。未キャッシュ/不正値は null 扱い。 */
export async function initSchoolFlag(): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached != null) {
      const n = Number(cached);
      setSchoolLicenseUntil(Number.isFinite(n) && n > 0 ? n : null);
    }
  } catch { /* 無視=フラグは現状維持 */ }
}

/** 同期結果を反映。licenseUntil=null（未所属/失効）ならフラグもキャッシュも消す＝即PRO終了。 */
export async function applySchoolLicense(licenseUntil: number | null): Promise<void> {
  setSchoolLicenseUntil(licenseUntil);
  try {
    if (licenseUntil == null) await AsyncStorage.removeItem(CACHE_KEY);
    else await AsyncStorage.setItem(CACHE_KEY, String(licenseUntil));
  } catch { /* 無視=次回同期で再反映 */ }
}
