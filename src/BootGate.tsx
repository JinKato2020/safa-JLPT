// 起動ゲート。ルートは同期登録し(=スプラッシュで固まらない)、OTAキャッシュの読込→注入は
// React内で非同期に行う。キャッシュ適用が済んでから App を動的importして描画する
// (data/index は import時に rehydrate するため、setContentFiles より後に読む必要がある)。
// 失敗/オフライン/無キャッシュでも必ず App へ進む(同梱baselineで起動)。
import { useEffect, useState, type ComponentType } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function BootGate() {
  const [App, setApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { loadCachedFiles, syncContent } = await import('./data/content/ota');
        const cached = await loadCachedFiles();
        if (Object.keys(cached).length) {
          const { setContentFiles } = await import('./data/content/source');
          setContentFiles(cached);
        }
        void syncContent(); // 次回用に最新を逐次DL(背景・待たない)
      } catch { /* OTA不調は無害 */ }
      try {
        const mod = await import('../App');
        if (alive) setApp(() => mod.default);
      } catch {
        // App読込失敗は致命だが、ここで握って無限スピナーは避ける(再起動を促す想定)。
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!App) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b1220', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }
  return <App />;
}
