import { registerRootComponent } from 'expo';

import App from './App';

// Strip noisy/sensitive console output from production builds. This kills
// every console.log/info/debug/warn across the app at once (request bodies,
// auth tokens, raw API responses) and avoids blocking the JS thread.
// console.error is kept for crash diagnostics / Play Console pre-launch reports.
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = () => {};
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
