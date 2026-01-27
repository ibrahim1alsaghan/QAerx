import { getRecorder } from './recorder/RecorderEngine';
import { getPlayback } from './playback/PlaybackEngine';

// Initialize engines
const recorder = getRecorder();
const playback = getPlayback();

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'ping':
      sendResponse({ success: true, loaded: true });
      break;

    // Recording commands
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

    // Playback commands
    case 'playback:execute':
      playback
        .execute(message.steps, {
          timeout: message.timeout || 30000,
          variables: message.variables || {},
          onStepStart: (step, index) => {
            chrome.runtime.sendMessage({
              type: 'playback:step-start',
              stepId: step.id,
              index,
            }).catch(() => {});
          },
          onStepComplete: (step, result) => {
            chrome.runtime.sendMessage({
              type: 'playback:step-complete',
              stepId: step.id,
              result,
            }).catch(() => {});
          },
        })
        .then((result) => {
          sendResponse({ success: true, result });
        })
        .catch((error) => {
          sendResponse({ success: false, error: String(error) });
        });
      return true; // Keep channel open for async

    case 'playback:stop':
      playback.stop();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep channel open for async response
});

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'content-script:ready' }).catch(() => {
  // Ignore errors if background is not ready yet
});

console.log('[QAerx] Content script initialized');
