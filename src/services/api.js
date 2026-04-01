import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from './socket';

// ============================================================
// API CONFIGURATION
// ============================================================
// Primary: Railway backend (production)
// Fallback: Your Vercel proxy (deploy pulse-proxy folder to Vercel)
// const LOCAL_URL = 'http://192.168.1.5:3000/api/v1'; // For local WiFi testing only
const PRIMARY_URL = 'https://pulsebackendd-production-1d87.up.railway.app/api/v1';

// TODO: After deploying proxy, update this URL:
// const PROXY_URL = 'https://pulse-api-proxy.vercel.app/api/v1';

let API_URL = PRIMARY_URL;

console.log('🌐 [API] Using URL:', API_URL);

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
    console.log('📤 [API] Request:', config.method?.toUpperCase(), config.url);
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
    console.log('📥 [API] Response:', response.status, response.config.url);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 🔄 NETWORK ERROR RETRY LOGIC
    if (isNetworkError(error) && originalRequest._retryCount < MAX_RETRIES) {
      originalRequest._retryCount += 1;
      console.log(`🔄 [API] Network error, retry ${originalRequest._retryCount}/${MAX_RETRIES}...`);

      const delay = RETRY_DELAY * Math.pow(2, originalRequest._retryCount - 1);
      console.log(`⏳ [API] Waiting ${delay}ms...`);
      await sleep(delay);

      return api(originalRequest);
    }

    if (isNetworkError(error)) {
      console.error('❌ [API] All retries failed:', error.message);
    }

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

        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refreshToken,
        });

        console.log('📩 [API] Refresh Response Payload:', JSON.stringify(response.data, null, 2));

        const dataSource = response.data.data || response.data;

        const accessToken =
          dataSource.tokens?.accessToken ||
          dataSource.accessToken ||
          dataSource.token;

        const newRefreshToken =
          dataSource.tokens?.refreshToken ||
          dataSource.refreshToken;

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

        await AsyncStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) {
          await AsyncStorage.setItem('refreshToken', newRefreshToken);
        }

        processQueue(null, accessToken);

        console.log('🚀 [API] Retrying original failed request...');
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // ✅ Also update socket token so it doesn't get auth errors
        socketService.updateToken(accessToken);

        return api(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        console.error('💀 [API] Session expired completely:', refreshError.message);

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