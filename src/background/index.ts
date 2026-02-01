import type { UIStep } from '@/types/test';

interface RecordingState {
  isRecording: boolean;
  sessionId: string | null;
  tabId: number | null;
  steps: UIStep[];
}

const recordingState: RecordingState = {
  isRecording: false,
  sessionId: null,
  tabId: null,
  steps: [],
};

// Handle messages from content scripts and UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'content-script:ready':
      console.log('[QAerx] Content script ready in tab:', sender.tab?.id);
      sendResponse({ success: true });
      break;

    case 'recording:started':
      recordingState.isRecording = true;
      recordingState.sessionId = message.sessionId;
      recordingState.tabId = sender.tab?.id || null;
      recordingState.steps = [];
      notifyUI({ type: 'recording:state-changed', state: recordingState });
      sendResponse({ success: true });
      break;

    case 'recording:stopped':
      recordingState.isRecording = false;
      recordingState.steps = message.steps || [];
      notifyUI({
        type: 'recording:completed',
        sessionId: message.sessionId,
        steps: message.steps,
      });
      sendResponse({ success: true });
      break;

    case 'recording:step-added':
      recordingState.steps.push(message.step);
      notifyUI({ type: 'recording:step-added', step: message.step });
      sendResponse({ success: true });
      break;

    case 'recording:paused':
    case 'recording:resumed':
      notifyUI({ type: message.type });
      sendResponse({ success: true });
      break;

    // Commands from UI
    case 'command:start-recording':
      startRecording(message.tabId).then(sendResponse);
      return true;

    case 'command:stop-recording':
      stopRecording().then(sendResponse);
      return true;

    case 'command:get-state':
      sendResponse({ state: recordingState });
      break;

    case 'command:capture-screenshot':
      captureScreenshot(message.tabId)
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true;
});

function isRestrictedUrl(url: string): boolean {
  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'data:',
    'file://',
    'view-source:',
  ];
  return restrictedPrefixes.some((prefix) => url.startsWith(prefix));
}

async function ensureContentScriptInjected(tabId: number): Promise<{ success: boolean; error?: string }> {
  try {
    // Get tab info to check URL
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || isRestrictedUrl(tab.url)) {
      return { success: false, error: 'Cannot record on this page. Please navigate to a regular web page (http:// or https://).' };
    }

    // Try to ping the content script
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'ping' });
      console.log('[QAerx] Content script already loaded');
      return { success: true };
    } catch {
      // Content script not loaded, inject it
      console.log('[QAerx] Injecting content script...');
    }

    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });

    // Wait for script to initialize and retry ping
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'ping' });
        console.log('[QAerx] Content script injected successfully');
        return { success: true };
      } catch {
        console.log(`[QAerx] Ping attempt ${attempt + 1} failed, retrying...`);
      }
    }

    return { success: false, error: 'Content script failed to load. Try refreshing the page.' };
  } catch (error) {
    console.error('[QAerx] Failed to inject content script:', error);
    return { success: false, error: 'Failed to access tab. Make sure you are on a regular web page.' };
  }
}

async function startRecording(tabId?: number): Promise<{ success: boolean; error?: string }> {
  try {
    const targetTabId = tabId || (await getActiveTabId());
    if (!targetTabId) {
      return { success: false, error: 'No active tab found' };
    }

    // Ensure content script is loaded
    const injectionResult = await ensureContentScriptInjected(targetTabId);
    if (!injectionResult.success) {
      return { success: false, error: injectionResult.error };
    }

    const sessionId = crypto.randomUUID();

    // Send message to content script to start recording
    await chrome.tabs.sendMessage(targetTabId, {
      type: 'recording:start',
      sessionId,
    });

    recordingState.tabId = targetTabId;
    recordingState.isRecording = true;
    recordingState.sessionId = sessionId;
    recordingState.steps = [];

    return { success: true };
  } catch (error) {
    console.error('[QAerx] Failed to start recording:', error);
    return { success: false, error: 'Failed to start recording. Try refreshing the page.' };
  }
}

async function stopRecording(): Promise<{ success: boolean; steps?: UIStep[]; error?: string }> {
  try {
    if (!recordingState.tabId) {
      return { success: false, error: 'No recording in progress' };
    }

    // Ensure content script is still available
    const injectionResult = await ensureContentScriptInjected(recordingState.tabId);
    if (!injectionResult.success) {
      // Return whatever steps we have
      const steps = recordingState.steps;
      recordingState.isRecording = false;
      return { success: true, steps, error: 'Recording stopped but page was reloaded. Some steps may be missing.' };
    }

    const response = await chrome.tabs.sendMessage(recordingState.tabId, {
      type: 'recording:stop',
    });

    recordingState.isRecording = false;
    return { success: true, steps: response.steps };
  } catch (error) {
    console.error('[QAerx] Failed to stop recording:', error);
    recordingState.isRecording = false;
    return { success: true, steps: recordingState.steps, error: 'Recording stopped with errors.' };
  }
}

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

/**
 * Capture a screenshot of the visible tab
 * Used for capturing failure screenshots during test playback
 */
async function captureScreenshot(tabId?: number): Promise<{ success: boolean; screenshot?: string; error?: string }> {
  try {
    const targetTabId = tabId || (await getActiveTabId());
    if (!targetTabId) {
      return { success: false, error: 'No active tab found' };
    }

    // Get the tab to find its window
    const tab = await chrome.tabs.get(targetTabId);
    if (!tab.windowId) {
      return { success: false, error: 'Tab has no window' };
    }

    // Capture the visible tab as base64 PNG
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 80,
    });

    return { success: true, screenshot: dataUrl };
  } catch (error) {
    console.error('[QAerx] Failed to capture screenshot:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Screenshot capture failed' };
  }
}

function notifyUI(message: unknown): void {
  // Send to all extension pages (popup, side panel)
  chrome.runtime.sendMessage(message).catch(() => {
    // Ignore errors if no listeners
  });
}

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Enable side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

console.log('[QAerx] Background service worker initialized');
