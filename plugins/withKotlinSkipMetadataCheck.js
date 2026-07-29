// Expo config plugin: 全KotlinCompileに -Xskip-metadata-version-check を付与。
// 目的: AdMob(play-services-ads 25.4.0)がKotlin 2.3.0のmetadataで配布されるが、Expo SDK54の
//   ツールチェーン(KSP上限2.2.20)ではそのmetadata版を読めず compileReleaseKotlin が失敗する。
//   このフラグでmetadata版チェックを無視し、新しいmetadataでもコンパイルを通す。
// androidフォルダはprebuild生成(未コミット)なので、ここでroot build.gradleへ追記する。
const { withProjectBuildGradle } = require('@expo/config-plugins');

const MARKER = '-Xskip-metadata-version-check';
const SNIPPET = `
// [withKotlinSkipMetadataCheck] AdMobのKotlin2.3.0 metadataを読むためversionチェックを無視
allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        compilerOptions {
            freeCompilerArgs.add("${MARKER}")
        }
    }
}
`;

module.exports = function withKotlinSkipMetadataCheck(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
