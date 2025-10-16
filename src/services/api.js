import axios from 'axios';
import { store } from '../redux/store'; 


const API_URL = 'http://192.168.1.3:3000/api/v1';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  // Get the token from the Redux store
  const token = store.getState().auth.token;
  if (token) {
    // If a token exists, add it to the 'Authorization' header
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
