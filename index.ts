import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';

// 起動ゲート: データ層(data/index=import時にrehydrate)より前に、OTAキャッシュを読んで
// コンテンツソースへ注入する。その後 App を動的importして登録する(=次回起動でPages更新が反映)。
// キャッシュ読込はローカルファイルの高速読みのみ。失敗/無キャッシュは baseline(同梱)で即起動。
async function boot() {
  try {
    const { loadCachedFiles, syncContent } = await import('./src/data/content/ota');
    const cached = await loadCachedFiles();
    if (Object.keys(cached).length) {
      const { setContentFiles } = await import('./src/data/content/source');
      setContentFiles(cached);
    }
    void syncContent(); // 次回起動用に最新を逐次DL(バックグラウンド・描画を待たせない)
  } catch { /* OTA不調は無害: 同梱baselineで起動 */ }
  const App = (await import('./App')).default;
  registerRootComponent(App);
}
void boot();
