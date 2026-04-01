/**
 * Production-safe logger utility
 * Disables console.log in production to prevent UI thread blocking
 */

const isDev = __DEV__;

const logger = {
    log: (...args) => {
        if (isDev) console.log(...args);
    },
    warn: (...args) => {
        if (isDev) console.warn(...args);
    },
    error: (...args) => {
        // Always log errors
        console.error(...args);
    },
    debug: (...args) => {
        if (isDev) console.debug(...args);
    },
};

export default logger;
