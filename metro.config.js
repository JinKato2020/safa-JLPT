// Metro 設定。現状は標準。
// 将来 §10 の共有デザインシステムを使うとき、ここに watchFolders で
//   ../../聞いて話せるシリーズ/packages/shared
// を追加し、@safa/shared を解決する(react/react-native は本アプリのものに固定)。
// Sentry のソースマップ対応のため getDefaultConfig を getSentryExpoConfig でラップ(挙動は標準のまま)。
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
