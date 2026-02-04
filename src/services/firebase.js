/**
 * Google Sign-In for Expo using expo-auth-session
 * Works with Expo Go without native module requirements
 */

import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Complete auth session for web browser
WebBrowser.maybeCompleteAuthSession();

// TODO: Replace with your actual OAuth Client IDs from Google Cloud Console
// Go to: https://console.cloud.google.com/apis/credentials
// Create OAuth 2.0 Client IDs for:
// - Web application (for Expo Go)
// - Android (for standalone build)
// - iOS (for standalone build)
const GOOGLE_CLIENT_IDS = {
    expoClientId: 'YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
};

/**
 * Hook for Google Sign-In
 * Use this in your component:
 * const [request, response, promptAsync] = useGoogleAuth();
 */
export const useGoogleAuth = () => {
    return Google.useAuthRequest({
        expoClientId: GOOGLE_CLIENT_IDS.expoClientId,
        webClientId: GOOGLE_CLIENT_IDS.webClientId,
        androidClientId: GOOGLE_CLIENT_IDS.androidClientId,
        iosClientId: GOOGLE_CLIENT_IDS.iosClientId,
    });
};

/**
 * Get user info from Google using access token
 */
export const getGoogleUserInfo = async (accessToken) => {
    try {
        const response = await fetch('https://www.googleapis.com/userinfo/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to get Google user info:', error);
        throw error;
    }
};

/**
 * Get ID token from access token (for backend verification)
 * Note: expo-auth-session returns access_token, not id_token
 * You may need to adjust your backend to accept access_token
 */
export const getGoogleIdToken = async (accessToken) => {
    try {
        // For Expo, we use access_token to get user info
        // Then send user info to backend for verification
        const userInfo = await getGoogleUserInfo(accessToken);
        return {
            accessToken,
            userInfo,
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Get device ID for authentication
 */
export const getDeviceId = async () => {
    try {
        let deviceId = await AsyncStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            await AsyncStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    } catch {
        return `session-${Date.now()}`;
    }
};

export default {
    useGoogleAuth,
    getGoogleUserInfo,
    getGoogleIdToken,
    getDeviceId,
    GOOGLE_CLIENT_IDS,
};
