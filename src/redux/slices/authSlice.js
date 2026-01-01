// redux/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Create async logout thunk
export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
      console.log('✅ AsyncStorage cleared');
      return true;
    } catch (error) {
      console.error('❌ Logout error:', error);
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    loginFailure: (state) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
    },
    rehydrateAuth: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    setAuthLoading: (state, action) => {
      state.loading = action.payload;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setMockUser: (state) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = { id: 1, name: 'Test User', avatar: null };
      state.token = 'mock-token';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logoutAsync.fulfilled, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
      })
      .addCase(logoutAsync.rejected, (state) => {
        // Still logout even if AsyncStorage clear fails
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
      });
  },
});

export const { 
  loginStart, 
  loginSuccess, 
  loginFailure, 
  rehydrateAuth,
  setAuthLoading,
  setUser,
  setMockUser 
} = authSlice.actions;

export default authSlice.reducer;
