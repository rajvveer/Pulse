import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://pulse-backend-262s.onrender.com/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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

// ✅ Request Interceptor
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

// ✅ Response Interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // IF 401 Unauthorized AND NOT ALREADY RETRIED
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // 1. If already refreshing, queue this request
      if (isRefreshing) {
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
          throw new Error('No refresh token available');
        }

        // 2. Refresh Token Call
        // Note: We use axios.post (default instance) to avoid infinite loops with 'api' instance
        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refreshToken,
        });

        // ⚠️ CRITICAL FIX: Adjusted for your backend structure (res.data.data)
        // Assuming backend sends: { success: true, data: { accessToken: "...", refreshToken: "..." } }
        const { accessToken, refreshToken: newRefreshToken } = response.data.data || response.data;

        if (!accessToken) throw new Error("Backend didn't return access token");

        // 3. Save new tokens
        await AsyncStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) {
          await AsyncStorage.setItem('refreshToken', newRefreshToken);
        }

        // 4. Process the Queue (Retry all failed requests)
        processQueue(null, accessToken);
        
        // 5. Retry the original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // If refresh fails, kill the queue and logout
        processQueue(refreshError, null);
        
        console.error('❌ Session expired:', refreshError.message);
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        
        // Optional: Trigger a Redux action here or EventEmit to force UI to Login Screen
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;