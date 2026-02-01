/**
 * Debounce utility for content script
 * Local copy to avoid external chunk imports
 */

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (this: unknown, ...args: unknown[]) {
    const later = () => {
      timeoutId = null;
      func.apply(this, args);
    };

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(later, wait);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}
