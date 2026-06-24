import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

const initialState = {
  // For You feed state
  posts: [],
  page: 1,
  hasMore: true,
  isLoading: false,
  isError: false,
  message: '',

  // Following feed state
  followingPosts: [],
  followingPage: 1,
  followingHasMore: true,
  followingIsLoading: false,
  followingIsError: false,
  followingMessage: '',
};

/**
 * Thunk to fetch For You / Home Feed posts (algorithm-ranked).
 */
export const fetchGlobalPosts = createAsyncThunk(
  'posts/fetchGlobalPosts',
  async ({ page = 1, limit = 10, vibe = 'auto' } = {}, thunkAPI) => {
    try {
      const response = await api.get(`/feed/home?page=${page}&limit=${limit}&vibe=${vibe}`);
      return {
        data: response.data.data,
        page: page,
        vibe: response.data.vibe || vibe
      };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to load feed.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

/**
 * Thunk to fetch Following Feed posts (chronological from followed users).
 */
export const fetchFollowingPosts = createAsyncThunk(
  'posts/fetchFollowingPosts',
  async ({ page = 1, limit = 10 } = {}, thunkAPI) => {
    try {
      const response = await api.get(`/feed/following?page=${page}&limit=${limit}`);
      return {
        data: response.data.data,
        page: page,
      };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to load following feed.';
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
    resetFollowingFeed: (state) => {
      state.followingPosts = [];
      state.followingPage = 1;
      state.followingHasMore = true;
      state.followingIsError = false;
      state.followingMessage = '';
    },
    // ✅ OPTIMISTIC UPDATE: Updates UI immediately without waiting for API
    likePostOptimistic: (state, action) => {
      const { postId } = action.payload;

      // Update in both feeds
      const updatePost = (post) => {
        if (post._id === postId) {
          if (!post.stats) post.stats = { likes: 0 };
          const current = post.stats.likes || 0;
          if (post.isLiked) {
            post.isLiked = false;
            post.stats.likes = Math.max(0, current - 1);
          } else {
            post.isLiked = true;
            post.stats.likes = current + 1;
          }
        }
      };

      const forYouPost = state.posts.find(p => p._id === postId);
      if (forYouPost) updatePost(forYouPost);

      const followingPost = state.followingPosts.find(p => p._id === postId);
      if (followingPost) updatePost(followingPost);
    },
  },
  extraReducers: (builder) => {
    builder
      // --- FOR YOU FEED ---
      .addCase(fetchGlobalPosts.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
      })
      .addCase(fetchGlobalPosts.fulfilled, (state, action) => {
        state.isLoading = false;
        const { data, page } = action.payload;

        if (page === 1) {
          state.posts = data;
        } else {
          state.posts = [...state.posts, ...data];
        }
        state.page = page;
        state.hasMore = data.length >= 10;
      })
      .addCase(fetchGlobalPosts.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })

      // --- FOLLOWING FEED ---
      .addCase(fetchFollowingPosts.pending, (state) => {
        state.followingIsLoading = true;
        state.followingIsError = false;
      })
      .addCase(fetchFollowingPosts.fulfilled, (state, action) => {
        state.followingIsLoading = false;
        const { data, page } = action.payload;

        if (page === 1) {
          state.followingPosts = data;
        } else {
          state.followingPosts = [...state.followingPosts, ...data];
        }
        state.followingPage = page;
        state.followingHasMore = data.length >= 10;
      })
      .addCase(fetchFollowingPosts.rejected, (state, action) => {
        state.followingIsLoading = false;
        state.followingIsError = true;
        state.followingMessage = action.payload;
      });
  },
});

export const { resetFeed, resetFollowingFeed, likePostOptimistic } = postSlice.actions;
export default postSlice.reducer;