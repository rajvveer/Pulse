/**
 * Push Notification Handler Component
 * Handles notification tap navigation and foreground notification display
 */
import React, { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import pushNotifications from '../../services/pushNotifications';

const PushNotificationHandler = () => {
    const navigation = useNavigation();
    const notificationListener = useRef();
    const responseListener = useRef();

    useEffect(() => {
        // Register Expo push token with backend
        pushNotifications.initializePushNotifications().then(result => {
            console.log('🔔 Push notification init:', result);
        });

        // Handle notification received while app is in foreground
        notificationListener.current = pushNotifications.addNotificationReceivedListener(notification => {
            console.log('📥 Notification received in foreground:', notification);
            // Notification will be shown automatically based on notification handler settings
        });

        // Handle user tapping on a notification
        responseListener.current = pushNotifications.addNotificationResponseListener(response => {
            console.log('👆 User tapped notification:', response);

            const data = response.notification.request.content.data;
            handleNotificationNavigation(data);
        });

        // Check if app was opened from a notification
        pushNotifications.getLastNotificationResponse().then(response => {
            if (response) {
                console.log('🚀 App opened from notification:', response);
                const data = response.notification.request.content.data;
                handleNotificationNavigation(data);
            }
        });

        // Clear badge count when app is opened
        pushNotifications.clearBadge();

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, []);

    const handleNotificationNavigation = (data) => {
        if (!data || !data.type) return;

        try {
            switch (data.type) {
                case 'like':
                case 'comment':
                case 'mention':
                    if (data.postId) {
                        navigation.navigate('PostDetail', { postId: data.postId });
                    }
                    break;

                case 'reel_like':
                case 'reel_comment':
                    navigation.navigate('Reels');
                    break;

                case 'follow':
                    if (data.username) {
                        navigation.navigate('UserProfile', { username: data.username });
                    } else {
                        navigation.navigate('Notifications');
                    }
                    break;

                case 'chat':
                    if (data.conversationId) {
                        navigation.navigate('Chat', { conversationId: data.conversationId });
                    } else {
                        navigation.navigate('Chat');
                    }
                    break;

                case 'whisper':
                    navigation.navigate('Whisper');
                    break;

                default:
                    // Navigate to notifications screen by default
                    navigation.navigate('Notifications');
            }
        } catch (error) {
            console.error('Navigation error from notification:', error);
            // Fallback to notifications screen
            try {
                navigation.navigate('Notifications');
            } catch {
                // Navigation not ready
            }
        }
    };

    // This component doesn't render anything
    return null;
};

export default PushNotificationHandler;
