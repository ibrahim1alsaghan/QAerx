import { getRecorder } from './recorder/RecorderEngine';

// Initialize recorder engine
const recorder = getRecorder();

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'recording:start':
      recorder.start(message.sessionId);
      sendResponse({ success: true });
      break;

    case 'recording:stop':
      const steps = recorder.stop();
      sendResponse({ success: true, steps });
      break;

    case 'recording:pause':
      recorder.pause();
      sendResponse({ success: true });
      break;

    case 'recording:resume':
      recorder.resume();
      sendResponse({ success: true });
      break;

    case 'recording:status':
      sendResponse({
        isRecording: recorder.isRecording(),
        steps: recorder.getSteps(),
      });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep channel open for async response
});

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'content-script:ready' });

console.log('[QAerx] Content script initialized');
