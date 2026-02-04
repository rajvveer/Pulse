import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.1.4:3000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
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
// 1️⃣ REQUEST INTERCEPTOR (Attach Token)
// ============================================================
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// 2️⃣ RESPONSE INTERCEPTOR (Handle 401 & Refresh)
// ============================================================
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // IF 401 Unauthorized AND NOT ALREADY RETRIED
    if (error.response?.status === 401 && !originalRequest._retry) {

      console.log('⚠️ [API] 401 Unauthorized detected. Starting refresh flow...');

      if (isRefreshing) {
        console.log('⏳ [API] Refresh already in progress, queuing request...');
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
          console.error('❌ [API] No refresh token found in storage.');
          throw new Error('No refresh token available');
        }

        console.log('🔄 [API] Calling /auth/refresh-token...');

        // Call backend (Use axios.post to avoid circular loop)
        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refreshToken,
        });

        // 🔍 DEBUG: Log the exact structure backend sent
        console.log('📩 [API] Refresh Response Payload:', JSON.stringify(response.data, null, 2));

        // ✅ HANDLE YOUR BACKEND STRUCTURE
        // Pattern: { success: true, tokens: { accessToken: "...", refreshToken: "..." } }
        const dataSource = response.data.data || response.data;

        const accessToken =
          dataSource.tokens?.accessToken || // Nested in tokens object (Your Backend)
          dataSource.accessToken ||         // Flat
          dataSource.token;                 // Alternative

        const newRefreshToken =
          dataSource.tokens?.refreshToken ||
          dataSource.refreshToken;

        // Logging success
        if (accessToken) {
          console.log('✅ [API] NEW Access Token received!');
        } else {
          console.error('❌ [API] Critical: Access Token MISSING in response!');
          throw new Error("Backend didn't return access token");
        }

        if (newRefreshToken) {
          console.log('✅ [API] NEW Refresh Token received (Rotating).');
        } else {
          console.log('ℹ️ [API] No new Refresh Token sent (Reusing old one).');
        }

        // Save new tokens
        await AsyncStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) {
          await AsyncStorage.setItem('refreshToken', newRefreshToken);
        }

        // Process Queue
        processQueue(null, accessToken);

        // Retry Original Request
        console.log('🚀 [API] Retrying original failed request...');
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        console.error('💀 [API] Session expired completely:', refreshError.message);

        // Force logout to clean up bad state
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;