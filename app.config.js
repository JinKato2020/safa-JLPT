// =============================================================================
// 1コードベースから「没入版」と「ミニマル殻(Mainichi JLPT lite)」を焼き分ける動的設定。
//  ・既定(APP_VARIANT 未設定 or 'immersive') = app.json を【そのまま】返す ＝ 現行の没入版を一切変えない(安全)。
//  ・APP_VARIANT='minimal' = iOS専用のミニマル殻(com.safa.jlpt2 / "Mainichi JLPT lite")に差し替える。
//      - EAS/OTA(extra.eas.projectId・updates.url・slug)は【共有】=同じ配信で両アプリに届く(実行時に flavor.ts が描き分け)。
//      - アイコンだけ差し替え(assets/icon-lite.png)。
//      - Firebase/広告は「同じ基盤・新バンドル用の値」を環境変数で差し込む(下の MINIMAL_* ＝差し込み口)。
//        ※ com.safa.jlpt2 用の GoogleService-Info.plist / AdMob iosAppId を登録後に CI が立てる。
//  戦略の詳細はメモリ two-app-strategy-shared-backend-minimal-shell を参照。
// =============================================================================
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'minimal') return config; // 没入版=現行のまま

  // 広告(AdMob): com.safa.jlpt2 用の iosAppId を差し込む(同じAdMobアカウントに新規登録して取得)。
  //   ★差し込み口: MINIMAL_ADMOB_IOS_APP_ID。未設定なら没入版の値を仮置き=実配信前に必ず差し替えること。
  const plugins = (config.plugins || []).map((p) => {
    if (Array.isArray(p) && p[0] === 'react-native-google-mobile-ads') {
      const iosAppId = process.env.MINIMAL_ADMOB_IOS_APP_ID || p[1].iosAppId;
      return ['react-native-google-mobile-ads', { ...p[1], iosAppId }];
    }
    return p;
  });

  return {
    ...config,
    name: 'Mainichi JLPT lite',
    icon: './assets/icon-lite.png',
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.safa.jlpt2',
      // Firebase: com.safa.jlpt2 用の GoogleService-Info.plist(同じFirebaseプロジェクトに新規追加して取得)。
      //   ★差し込み口: MINIMAL_GS_PLIST(CIが secret から復元して置くパス)。未設定なら仮パス。
      googleServicesFile: process.env.MINIMAL_GS_PLIST || './GoogleService-Info-lite.plist',
    },
    plugins,
  };
};
