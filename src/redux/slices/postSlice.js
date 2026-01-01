import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api'; // Assuming correct path to api.js

const initialState = {
  posts: [], // Array to hold the fetched posts (this will hold your 2 posts)
  isLoading: false,
  isError: false,
  message: '',
};

/**
 * Thunk to fetch the Global Feed posts from the backend.
 * This function uses the correct, non-personalized endpoint.
 */
export const fetchGlobalPosts = createAsyncThunk(
  'posts/fetchGlobalPosts',
  async (data, thunkAPI) => {
    try {
      // We use the /feed/global endpoint which fetches ALL public posts
      const response = await api.get('/feed/global');
      
      // Your backend uses 'data' property for array payloads
      return response.data.data; 
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to load feed.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);


const postSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    resetFeed: (state) => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Fetch Pending
      .addCase(fetchGlobalPosts.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = '';
      })
      // Fetch Fulfilled
      .addCase(fetchGlobalPosts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.posts = action.payload; // Set the fetched array of posts
      })
      // Fetch Rejected
      .addCase(fetchGlobalPosts.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.posts = [];
      });
  },
});

export const { resetFeed } = postSlice.actions;
export default postSlice.reducer;