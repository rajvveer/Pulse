/**
 * Checks if an avatar URL is valid and usable.
 * Returns the URL if valid, or null if it should fallback to the initial letter.
 */
export const getValidAvatarUrl = (user) => {
    const url = user?.profile?.avatar || user?.avatar;

    // No URL at all
    if (!url || typeof url !== 'string') return null;

    // Known default/placeholder URLs that don't actually exist
    const invalidUrls = [
        'https://res.cloudinary.com/pulse/image/upload/v1/defaults/avatar.png',
        'https://res.cloudinary.com/pulse/image/upload/v1/defaults/cover.png',
    ];

    if (invalidUrls.includes(url)) return null;

    // Empty or whitespace-only
    if (url.trim() === '') return null;

    return url;
};

/**
 * Gets a display name from a user object.
 */
export const getDisplayName = (user) => {
    return user?.profile?.displayName || user?.name || user?.username || 'Unknown';
};

/**
 * Gets the initial letter for the avatar fallback.
 */
export const getAvatarInitial = (user) => {
    const name = getDisplayName(user);
    return name.charAt(0).toUpperCase();
};
