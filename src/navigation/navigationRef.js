// navigationRef.js — a global navigation handle so non-React code (the call
// service, push handlers) can navigate imperatively. Attach `navigationRef` to
// the <NavigationContainer ref={navigationRef}> in App.js.
//
// Incoming calls arrive over the websocket (callService) or a data push while
// the user is anywhere in the app (or the app is cold-launched). None of those
// have a `navigation` prop, so they route through this ref.
import { createNavigationContainerRef, StackActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

// Navigate if the container is mounted; otherwise no-op (caller should retry
// once navigation is ready, e.g. on a cold launch).
export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
    return true;
  }
  return false;
}

// Replace the top of the stack — used to swap Outgoing/Incoming for the live
// CallScreen without leaving a back-stack entry that re-opens a dead call.
export function replace(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(StackActions.replace(name, params));
    return true;
  }
  return false;
}

// Pop back to whatever was under the call screens (used on hangup/decline).
export function goBackFromCall() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
    return true;
  }
  return false;
}
