import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const bookmarks = new Set();
const listeners = new Set();

const notify = () => listeners.forEach(fn => fn());

export const isBookmarked = (id) => bookmarks.has(String(id));

export const setBookmarked = (id, value) => {
  const key = String(id);
  const had = bookmarks.has(key);
  if (value && !had) {
    bookmarks.add(key);
    notify();
  } else if (!value && had) {
    bookmarks.delete(key);
    notify();
  }
};

export const seedBookmarks = (ids) => {
  let changed = false;
  for (const id of ids) {
    const key = String(id);
    if (!bookmarks.has(key)) {
      bookmarks.add(key);
      changed = true;
    }
  }
  if (changed) notify();
};

/**
 * Subscribe to the bookmark status of a single post.
 * `initial` seeds the store on first mount (e.g. when backend returns
 * isBookmarked on the post object).
 */
export const useBookmark = (postId, initial) => {
  const key = postId == null ? null : String(postId);

  if (key && initial && !bookmarks.has(key)) {
    bookmarks.add(key);
  }

  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force(n => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const toggle = useCallback(async () => {
    if (!key) return;
    const next = !bookmarks.has(key);
    setBookmarked(key, next);
    try {
      const res = await api.post('/bookmarks', { itemId: key, itemType: 'post' });
      const serverValue = res?.data?.data?.isBookmarked;
      if (typeof serverValue === 'boolean') {
        setBookmarked(key, serverValue);
      }
    } catch (err) {
      setBookmarked(key, !next);
      console.error('Bookmark toggle failed:', err?.message);
    }
  }, [key]);

  return [key ? bookmarks.has(key) : false, toggle];
};
