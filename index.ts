import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';
import * as Sentry from '@sentry/react-native';
import BootGate from './src/BootGate';

// クラッシュ/エラー検知(Sentry)。init は起動の最初に同期で行う(登録より前)。
// enabled: 本番のみ送信(開発中のエラーは送らない)。tracesSampleRate 0 = パフォーマンス計測なし(無料枠を消費しない)。
Sentry.init({
  dsn: 'https://910d913082aa3643622ce83e86d73b6f@o4512090895155201.ingest.de.sentry.io/4512090941816912',
  enabled: !__DEV__,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});

// ルートは同期登録(=スプラッシュで固まらない)。OTAキャッシュの読込→注入→App描画は
// BootGate内で非同期に行う(前ビルドはここを非同期にして起動固着を起こしたため回帰させない)。
registerRootComponent(Sentry.wrap(BootGate));
