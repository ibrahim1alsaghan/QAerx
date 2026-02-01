/**
 * Simple logger for content script
 * Uses console.log directly to avoid external chunk imports
 */

const PREFIX = '[QAerx]';

export const contentLogger = {
  log: (...args: unknown[]) => console.log(PREFIX, ...args),
  info: (...args: unknown[]) => console.info(PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
  error: (...args: unknown[]) => console.error(PREFIX, ...args),
  debug: (...args: unknown[]) => console.debug(PREFIX, ...args),
};
