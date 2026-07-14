import { registerRootComponent } from 'expo';

// Install the WebRTC globals LiveKit needs, once, before anything constructs a
// Room. Wrapped in try/catch so the JS bundle still loads in plain Expo Go
// (where the native @livekit/react-native module isn't present) — calling code
// degrades to a "needs a dev build" message instead of crashing at startup.
try {
  // eslint-disable-next-line global-require
  const { registerGlobals } = require('@livekit/react-native');
  registerGlobals?.();
} catch (e) {
  if (__DEV__) console.warn('LiveKit registerGlobals skipped:', e?.message);
}

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
