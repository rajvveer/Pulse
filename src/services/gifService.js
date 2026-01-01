import api from './api';

class GifService {
  // Search GIFs
  async searchGifs(query, limit = 20) {
    try {
      const response = await api.get('/gifs/search', {
        params: { q: query, limit }
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Search GIFs error:', error);
      return [];
    }
  }

  // Get trending GIFs
  async getTrendingGifs(limit = 20) {
    try {
      const response = await api.get('/gifs/trending', {
        params: { limit }
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Trending GIFs error:', error);
      return [];
    }
  }

  // Get categories
  async getCategories() {
    try {
      const response = await api.get('/gifs/categories');
      return response.data.data || [];
    } catch (error) {
      console.error('Categories error:', error);
      return [];
    }
  }
}

export default new GifService();
