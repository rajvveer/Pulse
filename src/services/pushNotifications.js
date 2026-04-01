/**
 * Push Notifications Service
 * Handles registration, permission requests, and notification listeners
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/**
 * Get unique device identifier
 */
const getDeviceId = async () => {
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

/**
 * Request notification permissions
 */
export const requestPermissions = async () => {
    if (!Device.isDevice) {
        console.log('⚠️ Push notifications require a physical device');
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('❌ Push notification permission denied');
        return false;
    }

    return true;
};

/**
 * Get the Expo push token (which wraps FCM token)
 */
export const getExpoPushToken = async () => {
    try {
        if (!Device.isDevice) {
            console.log('⚠️ Must use physical device for push notifications');
            return null;
        }

        // Get project ID from app config
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;

        if (!projectId) {
            console.log('⚠️ EAS project ID not found in app.json');
            return null;
        }

        const token = await Notifications.getExpoPushTokenAsync({
            projectId,
        });

        console.log('✅ Expo push token:', token.data);
        return token.data;
    } catch (error) {
        console.error('❌ Failed to get push token:', error);
        return null;
    }
};

/**
 * Get native FCM/APNs token
 */
export const getDevicePushToken = async () => {
    try {
        const token = await Notifications.getDevicePushTokenAsync();
        console.log('✅ Device push token:', token.data);
        return token.data;
    } catch (error) {
        console.error('❌ Failed to get device push token:', error);
        return null;
    }
};

/**
 * Register push token with backend
 */
export const registerPushToken = async () => {
    try {
        const hasPermission = await requestPermissions();
        if (!hasPermission) {
            return { success: false, reason: 'Permission denied' };
        }

        // Use Expo push token — works without google-services.json
        // Expo's servers handle the FCM forwarding automatically
        const token = await getExpoPushToken();
        if (!token) {
            console.log('⚠️ Could not get Expo push token');
            return { success: false, reason: 'Could not get push token' };
        }

        const deviceId = await getDeviceId();

        // Send to backend
        const response = await api.post('/push/register', {
            token,
            deviceId,
            platform: Platform.OS
        });

        console.log('✅ Push token registered with backend:', token);
        await AsyncStorage.setItem('pushTokenRegistered', 'true');

        return { success: true, token };
    } catch (error) {
        console.error('❌ Failed to register push token:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Unregister push token (call on logout)
 */
export const unregisterPushToken = async () => {
    try {
        const deviceId = await getDeviceId();

        await api.delete('/push/unregister', {
            data: { deviceId }
        });

        await AsyncStorage.removeItem('pushTokenRegistered');
        console.log('✅ Push token unregistered');
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to unregister push token:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Set up Android notification channel
 */
export const setupNotificationChannel = async () => {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('pulse_notifications', {
            name: 'Pulse Notifications',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#1E88E5',
            sound: 'default',
        });
    }
};

/**
 * Add notification received listener (foreground)
 */
export const addNotificationReceivedListener = (callback) => {
    return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Add notification response listener (user tapped notification)
 */
export const addNotificationResponseListener = (callback) => {
    return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Get the last notification response (if app was opened via notification)
 */
export const getLastNotificationResponse = async () => {
    return Notifications.getLastNotificationResponseAsync();
};

/**
 * Clear badge count
 */
export const clearBadge = async () => {
    await Notifications.setBadgeCountAsync(0);
};

/**
 * Initialize push notifications
 * Call this after user login
 */
export const initializePushNotifications = async () => {
    try {
        // Set up Android channel
        await setupNotificationChannel();

        // Register token with backend
        const result = await registerPushToken();

        return result;
    } catch (error) {
        console.error('❌ Push notification initialization failed:', error);
        return { success: false, error: error.message };
    }
};

export default {
    requestPermissions,
    getExpoPushToken,
    getDevicePushToken,
    registerPushToken,
    unregisterPushToken,
    setupNotificationChannel,
    addNotificationReceivedListener,
    addNotificationResponseListener,
    getLastNotificationResponse,
    clearBadge,
    initializePushNotifications,
};
