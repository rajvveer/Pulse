import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const GOOGLE_CLIENT_IDS = {
    webClientId: '756729713296-kqo8tvibtvs8s4jkv391nnnfsia9gij8.apps.googleusercontent.com',
    androidClientId: '756729713296-lfn8817evb1gk9noln0svvqn2cot2g8u.apps.googleusercontent.com',
};

// Initialize Native Google Sign-In
GoogleSignin.configure({
    // webClientId is absolutely required even on Android to get the idToken for your backend
    webClientId: GOOGLE_CLIENT_IDS.webClientId,
    offlineAccess: false,
});

export const signInWithGoogle = async () => {
    try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        
        console.log('📱 Google Sign-In raw response:', JSON.stringify(response, null, 2));
        
        // v12+ returns { type: 'success', data: { user, idToken } }
        // v11 and below returns { user: { email, name, photo, id }, idToken, ... }
        let user, idToken;
        
        if (response.type === 'success' || response.data) {
            // v12+ format
            user = response.data?.user || response.data;
            idToken = response.data?.idToken;
        } else if (response.user) {
            // Legacy format (v11 and below)
            user = response.user;
            idToken = response.idToken;
        } else {
            // Direct user object (some versions)
            user = response;
            idToken = response.idToken;
        }
        
        if (!user || !user.email) {
            console.error('❌ No user data in Google Sign-In response:', response);
            throw new Error('Google Sign-In did not return user information');
        }
        
        // Get access token via getTokens()
        let accessToken = null;
        try {
            const tokens = await GoogleSignin.getTokens();
            accessToken = tokens.accessToken;
            if (!idToken) idToken = tokens.idToken;
        } catch (tokenErr) {
            console.log('⚠️ getTokens() failed, using idToken from signIn:', tokenErr.message);
        }
        
        console.log('✅ Google user:', user.email, '| Has idToken:', !!idToken, '| Has accessToken:', !!accessToken);
        
        return {
            userInfo: user,
            idToken: idToken,
            accessToken: accessToken
        };
    } catch (error) {
        console.error('Google Sign-In Native Error:', error);
        throw error;
    }
};

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
    signInWithGoogle,
    getDeviceId,
    GOOGLE_CLIENT_IDS,
};
