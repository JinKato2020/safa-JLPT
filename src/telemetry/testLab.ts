// Firebase Test Lab（Google Playのテスト前レポート等の自動試験）判定。Androidのみ。
// 該当時は App.tsx でテレメトリを無効化＋trialClientでお試し要求をスキップ＝ダッシュボード/生データ/device_trials を汚さない。
// ※ネイティブ modules/test-lab（Androidのみ）。未リンク/iOS/失敗は false（＝通常動作）に安全フォールバック。
//   react-native / expo-modules-core を静的importすると node:test でクラッシュするため、すべて遅延require。
let cached: boolean | null = null;
export function isTestLab(): boolean {
  if (cached !== null) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native') as typeof import('react-native');
    if (Platform.OS !== 'android') { cached = false; return false; }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
    const mod = requireNativeModule('TestLab') as { isTestLab: () => boolean };
    cached = !!mod.isTestLab();
    return cached;
  } catch {
    cached = false; // モジュール未リンク/iOS/例外＝通常動作（抑止しない）
    return false;
  }
}
