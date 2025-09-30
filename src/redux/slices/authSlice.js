import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
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
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
    },
    // For testing - remove in production
    setMockUser: (state) => {
      state.isAuthenticated = true;
      state.user = { id: 1, name: 'Test User', avatar: null };
      state.token = 'mock-token';
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, setMockUser } = authSlice.actions;
export default authSlice.reducer;
