import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';
import BootGate from './src/BootGate';

// ルートは同期登録(=スプラッシュで固まらない)。OTAキャッシュの読込→注入→App描画は
// BootGate内で非同期に行う(前ビルドはここを非同期にして起動固着を起こしたため回帰させない)。
registerRootComponent(BootGate);
