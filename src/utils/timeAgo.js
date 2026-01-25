/**
 * Converts a timestamp to a human-readable "time ago" format
 * @param {string|Date} timestamp - The timestamp to convert
 * @returns {string} Formatted time ago string (e.g., "2h", "3d", "just now")
 */
export const getTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  
  // Handle invalid dates or future dates
  if (isNaN(diffMs) || diffMs < 0) return 'just now';
  
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 5) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s`;
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffWeeks < 4) return `${diffWeeks}w`;
  if (diffMonths < 12) return `${diffMonths}mo`;
  return `${diffYears}y`;
};

/**
 * Formats a full date for older comments (alternative function)
 */
export const formatCommentDate = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return getTimeAgo(timestamp);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // Format as "Jan 24" for older dates
  const options = { month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
};
