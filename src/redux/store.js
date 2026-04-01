import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import uiSlice from './slices/uiSlice';
import postSlice from './slices/postSlice';

console.log('🔵 [Redux Store] Configuring store...');

export const store = configureStore({
  reducer: {
    auth: authSlice,
    ui: uiSlice,
    posts: postSlice,
  },
});

console.log('✅ [Redux Store] Store configured successfully!');
