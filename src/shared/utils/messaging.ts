/**
 * Reliable Chrome extension messaging utility
 * Handles content script injection and retry logic
 */

import { logger } from './logger';

interface MessageOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<MessageOptions> = {
  maxRetries: 3,
  retryDelay: 500,
  timeout: 15000,
};

// Track last injection error for better error messages
let lastInjectionError: string | null = null;

/**
 * Ensure content script is loaded on the tab
 * Returns true if content script is ready
 */
async function ensureContentScript(tabId: number): Promise<boolean> {
  lastInjectionError = null;

  // First try to ping the content script
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    if (response?.success) {
      return true;
    }
  } catch (e) {
    // Content script not loaded, need to inject it
    logger.log('Content script not responding, will inject...', e);
  }

  // Inject content script
  try {
    logger.log('Injecting content script into tab', tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    logger.log('Content script injection completed');

    // Wait a bit for the script to initialize
    await sleep(500);

    // Wait for content script to initialize with retries
    for (let i = 0; i < 6; i++) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
        if (response?.success) {
          logger.log('Content script ready after injection (attempt', i + 1, ')');
          return true;
        }
      } catch (pingError) {
        logger.log('Ping attempt', i + 1, 'failed:', pingError);
      }

      // Increasing delays: 300, 500, 700, 900, 1100, 1300ms
      await sleep(300 + i * 200);
    }

    lastInjectionError = 'Content script injected but not responding to ping';
    logger.warn(lastInjectionError);
    return false;
  } catch (error) {
    lastInjectionError = error instanceof Error ? error.message : String(error);
    logger.error('Failed to inject content script:', lastInjectionError);
    return false;
  }
}

/**
 * Send a message to the content script with retry logic
 * Automatically injects content script if needed
 */
export async function sendToContent<T = unknown>(
  message: { type: string; [key: string]: unknown },
  options: MessageOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found');
  }

  const tabId = tab.id;
  logger.log('sendToContent: tab', tabId, 'url:', tab.url?.substring(0, 50));

  // Check if we can access this tab (chrome://, edge://, etc. are restricted)
  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('edge://') || tab.url?.startsWith('about:')) {
    throw new Error('Cannot access browser internal pages. Please navigate to a regular web page.');
  }

  // Check for extension pages
  if (tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('moz-extension://')) {
    throw new Error('Cannot access extension pages. Please navigate to a regular web page.');
  }

  // Check for new tab page
  if (tab.url === 'chrome://newtab/' || tab.url === 'edge://newtab/' || !tab.url || tab.url === '') {
    throw new Error('Please navigate to a web page first.');
  }

  // Ensure content script is loaded
  const isReady = await ensureContentScript(tabId);
  if (!isReady) {
    const errorDetail = lastInjectionError ? ` (${lastInjectionError})` : '';
    throw new Error(`Could not establish connection with page${errorDetail}. Try refreshing the page.`);
  }

  // Send message with retry logic
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      logger.log(`sendToContent: sending ${message.type}, attempt ${attempt + 1}`);
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, message),
        timeout(opts.timeout),
      ]);

      logger.log('sendToContent: got response', response);
      return response as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = lastError.message.toLowerCase();

      // Check for page navigation error (message channel closed)
      // This happens when the content script context is destroyed due to navigation
      if (errorMsg.includes('message channel closed') ||
          errorMsg.includes('receiving end does not exist') ||
          errorMsg.includes('context invalidated')) {
        logger.warn('Page navigation detected during message:', message.type);
        // Return a special response indicating navigation occurred
        // The caller should handle this and retry after page load
        return {
          success: false,
          error: 'PAGE_NAVIGATED',
          navigated: true,
        } as T;
      }

      logger.warn(`Message attempt ${attempt + 1}/${opts.maxRetries} failed:`, lastError.message);

      if (attempt < opts.maxRetries - 1) {
        // Try to re-inject content script before retrying
        await ensureContentScript(tabId);
        await sleep(opts.retryDelay * (attempt + 1));
      }
    }
  }

  throw new Error(
    lastError?.message?.includes('Could not establish connection')
      ? 'Page connection lost. Please refresh the page and try again.'
      : lastError?.message || 'Failed to communicate with page'
  );
}

/**
 * Get the active tab info
 */
export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

/**
 * Check if the current tab can be accessed by the extension
 */
export async function canAccessTab(): Promise<{ canAccess: boolean; reason?: string }> {
  const tab = await getActiveTab();

  if (!tab) {
    return { canAccess: false, reason: 'No active tab found' };
  }

  if (!tab.url) {
    return { canAccess: false, reason: 'Cannot determine tab URL' };
  }

  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
    return { canAccess: false, reason: 'Cannot access browser internal pages' };
  }

  if (tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
    return { canAccess: false, reason: 'Cannot access extension pages' };
  }

  if (tab.url.startsWith('about:')) {
    return { canAccess: false, reason: 'Cannot access about: pages' };
  }

  return { canAccess: true };
}

// Helper functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), ms)
  );
}
