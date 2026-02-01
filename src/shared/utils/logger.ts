/**
 * Simple logger utility for QAerx
 * Only logs in development mode to keep production clean
 */

// Check if we're in development mode
// In Chrome extensions, we can check for debug mode or use a flag
const isDev = typeof process !== 'undefined'
  ? process.env.NODE_ENV === 'development'
  : !('update_url' in chrome.runtime.getManifest()); // Extensions from store have update_url

const PREFIX = '[QAerx]';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(PREFIX, ...args);
    }
  },

  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(PREFIX, ...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(PREFIX, ...args);
    }
  },

  error: (...args: unknown[]) => {
    // Always log errors, even in production
    console.error(PREFIX, ...args);
  },

  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(PREFIX, ...args);
    }
  },

  // Group logging for related messages
  group: (label: string) => {
    if (isDev) {
      console.group(`${PREFIX} ${label}`);
    }
  },

  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  },

  // Time tracking
  time: (label: string) => {
    if (isDev) {
      console.time(`${PREFIX} ${label}`);
    }
  },

  timeEnd: (label: string) => {
    if (isDev) {
      console.timeEnd(`${PREFIX} ${label}`);
    }
  },
};

export default logger;
