// 安定端末ID（再インストールでも変わらない匿名の識別子）。用途は「分析の名寄せ」＋「お試しの端末ロック」。
//  ・iOS    = Keychain(expo-secure-store)に保存したUUID。アプリ削除→再インストールでも残る（Apple標準の挙動）。
//  ・Android = ANDROID_ID(Settings.Secure)。同じ署名鍵なら再インストールで不変（工場出荷リセットで変わる）。
//  取得不可の端末は null → 呼び出し側は従来のローカルUUID(再インストールで変わる)へフォールバック。
// ※これは「不正防止・分析」目的の識別子。第三者トラッキングや広告(ATT対象)には使わない。プライバシー申告に開示すること。
// ※react-native / expo-* は node:test(単体テスト)で静的importするとクラッシュするため、すべて遅延require。

const KEY = 'safa-jlpt.deviceId';
let cached: string | null = null;

function platformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (require('react-native') as typeof import('react-native')).Platform.OS;
  } catch { return 'ios'; }
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** 端末に固定された匿名ID。取得できなければ null（呼び出し側でフォールバック）。 */
export async function getDeviceId(): Promise<string | null> {
  if (cached) return cached;
  try {
    if (platformOS() === 'android') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const App = require('expo-application') as typeof import('expo-application');
      const getAid = (App as unknown as { getAndroidId?: () => string }).getAndroidId;
      const aid = (typeof getAid === 'function' ? getAid() : (App as unknown as { androidId?: string }).androidId) ?? '';
      if (aid) { cached = `and_${aid}`; return cached; }
    }
    // iOS（および Android で ANDROID_ID を取得できない時）: Keychain の UUID（再インストール耐性）。
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Secure = require('expo-secure-store') as typeof import('expo-secure-store');
    let id = await Secure.getItemAsync(KEY);
    if (!id) {
      id = uuid();
      await Secure.setItemAsync(KEY, id, { keychainAccessible: Secure.AFTER_FIRST_UNLOCK });
    }
    cached = id;
    return id;
  } catch {
    return null;
  }
}
