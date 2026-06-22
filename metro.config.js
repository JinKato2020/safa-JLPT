// Metro 設定。現状は標準。
// 将来 §10 の共有デザインシステムを使うとき、ここに watchFolders で
//   ../../聞いて話せるシリーズ/packages/shared
// を追加し、@safa/shared を解決する(react/react-native は本アプリのものに固定)。
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
