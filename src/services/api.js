import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import socketService from './socket';

// ============================================================
// API CONFIGURATION — reads from app.json > extra > apiUrl
// ============================================================
const getExpoHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri;

  return hostUri?.split(':')[0];
};

const resolveLocalUrl = (url) => {
  if (!__DEV__) return url;

  const expoHost = getExpoHost();
  if (!expoHost || expoHost === 'localhost' || expoHost === '127.0.0.1') {
    return url;
  }

  return url
    .replace('localhost', expoHost)
    .replace('127.0.0.1', expoHost);
};

export const API_URL = resolveLocalUrl(
  Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.4:3000/api/v1'
);

// Dev-only logger — no-op in production builds so we never leak
// request/response data (including auth tokens) to device logs.
const log = (...args) => {
  if (__DEV__) console.log(...args);
};
const logError = (...args) => {
  if (__DEV__) console.error(...args);
};

log('🌐 [API] Using URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Increased timeout for mobile data (60 seconds)
  timeout: 60000,
});

// --- CONCURRENCY HANDLERS ---
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ============================================================
// 🔄 NETWORK RETRY LOGIC (For Mobile Data Reliability)
// ============================================================
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isNetworkError = (error) => {
  return (
    !error.response &&
    (error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK' ||
      error.message?.includes('timeout') ||
      error.message?.includes('Network Error'))
  );
};

// ============================================================
// 1️⃣ REQUEST INTERCEPTOR (Attach Token + Retry Count)
// ============================================================
api.interceptors.request.use(
  async (config) => {
    log('📤 [API] Request:', config.method?.toUpperCase(), config.url);
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config._retryCount = config._retryCount || 0;
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// 2️⃣ RESPONSE INTERCEPTOR (Network Retry + 401 Refresh)
// ============================================================
api.interceptors.response.use(
  (response) => {
    log('📥 [API] Response:', response.status, response.config.url);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 🔄 NETWORK ERROR RETRY LOGIC
    if (isNetworkError(error) && originalRequest._retryCount < MAX_RETRIES) {
      originalRequest._retryCount += 1;
      log(`🔄 [API] Network error, retry ${originalRequest._retryCount}/${MAX_RETRIES}...`);

      const delay = RETRY_DELAY * Math.pow(2, originalRequest._retryCount - 1);
      log(`⏳ [API] Waiting ${delay}ms...`);
      await sleep(delay);

      return api(originalRequest);
    }

    if (isNetworkError(error)) {
      logError('❌ [API] All retries failed:', error.message);
    }

    // IF 401 Unauthorized AND NOT ALREADY RETRIED
    if (error.response?.status === 401 && !originalRequest._retry) {

      log('⚠️ [API] 401 Unauthorized detected. Starting refresh flow...');

      if (isRefreshing) {
        log('⏳ [API] Refresh already in progress, queuing request...');
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');

        if (!refreshToken) {
          logError('❌ [API] No refresh token found in storage.');
          throw new Error('No refresh token available');
        }

        log('🔄 [API] Calling /auth/refresh-token...');

        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const dataSource = response.data.data || response.data;

        const accessToken =
          dataSource.tokens?.accessToken ||
          dataSource.accessToken ||
          dataSource.token;

        const newRefreshToken =
          dataSource.tokens?.refreshToken ||
          dataSource.refreshToken;

        if (accessToken) {
          log('✅ [API] NEW Access Token received!');
        } else {
          logError('❌ [API] Critical: Access Token MISSING in response!');
          throw new Error("Backend didn't return access token");
        }

        if (newRefreshToken) {
          log('✅ [API] NEW Refresh Token received (Rotating).');
        } else {
          log('ℹ️ [API] No new Refresh Token sent (Reusing old one).');
        }

        await AsyncStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) {
          await AsyncStorage.setItem('refreshToken', newRefreshToken);
        }

        processQueue(null, accessToken);

        log('🚀 [API] Retrying original failed request...');
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // ✅ Also update socket token so it doesn't get auth errors
        socketService.updateToken(accessToken);

        return api(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        logError('💀 [API] Session expired completely:', refreshError.message);

        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);

        // Force the app back to the auth flow. Lazy require avoids a
        // circular import (store → postSlice → api).
        try {
          const { store } = require('../redux/store');
          const { logoutAsync } = require('../redux/slices/authSlice');
          store.dispatch(logoutAsync());
        } catch (e) {
          logError('❌ [API] Failed to dispatch logout:', e?.message);
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
