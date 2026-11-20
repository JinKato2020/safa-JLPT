const { withAndroidManifest } = require('expo/config-plugins');

const portraitFeature = 'android.hardware.screen.portrait';

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    // A portrait activity implies this Play device filter unless the feature is explicitly optional.
    const features = manifest['uses-feature'] ?? [];
    const portrait = features.find(feature => feature.$['android:name'] === portraitFeature);
    if (portrait) {
      portrait.$['android:required'] = 'false';
    } else {
      features.push({ $: { 'android:name': portraitFeature, 'android:required': 'false' } });
    }
    manifest['uses-feature'] = features;
    return config;
  });
};
