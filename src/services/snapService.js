import api from './api';

/**
 * Snap API helpers — ephemeral stories (rail) + direct disappearing snaps.
 * Thin wrappers over the /snaps backend so screens don't repeat axios calls.
 */

// Upload a snap. `file` = { uri, name, type }. audience: 'story' | 'direct'.
export const createSnap = async ({ file, audience = 'story', recipients = [], caption = '', durationMs }) => {
  const form = new FormData();
  form.append('file', file);
  form.append('audience', audience);
  if (audience === 'direct') form.append('recipients', JSON.stringify(recipients));
  if (caption) form.append('caption', caption);
  if (durationMs) form.append('durationMs', String(durationMs));

  const res = await api.post('/snaps', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.data;
};

// Story rail: array of author "rings" { authorId, user, snaps[], hasUnseen }.
export const getStoryRail = async () => {
  const res = await api.get('/snaps/rail');
  return res.data?.data || [];
};

// Direct snap inbox.
export const getDirectInbox = async () => {
  const res = await api.get('/snaps/direct');
  return res.data?.data || [];
};

export const markSnapViewed = (snapId) => api.post(`/snaps/${snapId}/view`).catch(() => {});

export const reactToSnap = (snapId, reaction) =>
  api.post(`/snaps/${snapId}/react`, { reaction }).then((r) => r.data?.data);

export const getSnapViewers = (snapId) =>
  api.get(`/snaps/${snapId}/viewers`).then((r) => r.data?.data);

export const deleteSnap = (snapId) => api.delete(`/snaps/${snapId}`);

export default {
  createSnap,
  getStoryRail,
  getDirectInbox,
  markSnapViewed,
  reactToSnap,
  getSnapViewers,
  deleteSnap,
};
