import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

const initialState = {
  posts: [],
  page: 1,           // Track current page
  hasMore: true,     // Track if there are more posts to load
  isLoading: false,
  isError: false,
  message: '',
};

/**
 * Thunk to fetch Global Feed posts.
 * Supports Pagination: Pass { page: 1 } to refresh, or { page: 2 } to load more.
 */
export const fetchGlobalPosts = createAsyncThunk(
  'posts/fetchGlobalPosts',
  async ({ page = 1, limit = 10 } = {}, thunkAPI) => {
    try {
      // Pass page and limit query params to backend
      const response = await api.get(`/feed/global?page=${page}&limit=${limit}`);
      
      // Return data AND the page number so the reducer knows how to handle it
      return { 
        data: response.data.data, // The array of posts
        page: page 
      }; 
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
    resetFeed: (state) => {
      state.posts = [];
      state.page = 1;
      state.hasMore = true;
      state.isError = false;
      state.message = '';
    },
    // ✅ OPTIMISTIC UPDATE: Updates UI immediately without waiting for API
    likePostOptimistic: (state, action) => {
      const { postId } = action.payload;
      const post = state.posts.find(p => p._id === postId);
      
      if (post) {
        if (post.isLiked) {
          // Unlike
          post.isLiked = false;
          post.stats.likes = Math.max(0, post.stats.likes - 1); // Prevent negative
        } else {
          // Like
          post.isLiked = true;
          post.stats.likes += 1;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // --- FETCH PENDING ---
      .addCase(fetchGlobalPosts.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
      })
      // --- FETCH FULFILLED ---
      .addCase(fetchGlobalPosts.fulfilled, (state, action) => {
        state.isLoading = false;
        const { data, page } = action.payload;

        if (page === 1) {
          // If refreshing (page 1), replace all posts
          state.posts = data;
        } else {
          // If loading more (page > 1), append new posts to the end
          state.posts = [...state.posts, ...data];
        }

        // Update Page Number
        state.page = page;

        // Determine if there are more posts to load
        // If we received fewer posts than requested (limit=10), we reached the end
        if (data.length < 10) {
          state.hasMore = false;
        } else {
          state.hasMore = true;
        }
      })
      // --- FETCH REJECTED ---
      .addCase(fetchGlobalPosts.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export const { resetFeed, likePostOptimistic } = postSlice.actions;
export default postSlice.reducer;