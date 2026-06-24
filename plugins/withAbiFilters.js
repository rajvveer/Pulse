const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Adds an `ndk { abiFilters ... }` block to `defaultConfig` in
 * `android/app/build.gradle`. This is what actually filters native `.so`
 * files at packaging time — INCLUDING the ones bundled inside third-party
 * native modules (socket.io, expo-image, sharp, reanimated, etc.).
 *
 * The standard `reactNativeArchitectures` gradle property only filters
 * React Native's own libs. The Expo `expo-build-properties` plugin does
 * not expose `abiFilters`. So in a prebuild / CNG workflow this custom
 * plugin is the only reliable way to ship a single-ABI APK.
 *
 * Usage in app.json:
 *   ["./plugins/withAbiFilters", { "abis": ["arm64-v8a"] }]
 */
module.exports = function withAbiFilters(config, { abis = ['arm64-v8a'] } = {}) {
  return withAppBuildGradle(config, (cfg) => {
    const list = abis.map((a) => `"${a}"`).join(', ');
    const ndkBlock = `        ndk {\n            abiFilters ${list}\n        }`;

    let contents = cfg.modResults.contents;

    if (/ndk\s*\{[^}]*abiFilters[^}]*\}/.test(contents)) {
      // Replace any existing ndk { abiFilters ... } block.
      contents = contents.replace(/ndk\s*\{[^}]*abiFilters[^}]*\}/, ndkBlock.trim());
    } else {
      // Inject at the start of defaultConfig { ... }.
      contents = contents.replace(
        /(defaultConfig\s*\{\s*\n)/,
        `$1${ndkBlock}\n`
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
