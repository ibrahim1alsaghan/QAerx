import { getRecorder } from './recorder/RecorderEngine';
import { getPlayback } from './playback/PlaybackEngine';
import { getElementPicker } from './picker/ElementPicker';
import { getElementHighlighter } from './highlighter/ElementHighlighter';
import { getSimplifiedPageContext, analyzeCurrentPage } from './helpers/PageAnalyzer';

// Log immediately when script starts executing
console.log('[QAerx] Content script starting...');

// Initialize engines with error handling
let recorder: ReturnType<typeof getRecorder> | null = null;
let playback: ReturnType<typeof getPlayback> | null = null;
let elementPicker: ReturnType<typeof getElementPicker> | null = null;
let highlighter: ReturnType<typeof getElementHighlighter> | null = null;
let initError: string | null = null;

try {
  recorder = getRecorder();
  playback = getPlayback();
  elementPicker = getElementPicker();
  highlighter = getElementHighlighter();
  console.log('[QAerx] Engines initialized successfully');
} catch (error) {
  initError = String(error);
  console.error('[QAerx] Failed to initialize engines:', error);
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[QAerx] Received message:', message.type);

  switch (message.type) {
    case 'ping':
      console.log('[QAerx] Ping received, responding...');
      sendResponse({ success: true, loaded: true });
      return false;

    // Recording commands
    case 'recording:start':
      try {
        if (!recorder) {
          throw new Error('Recorder not initialized: ' + (initError || 'unknown error'));
        }
        console.log('[QAerx] Starting recorder with sessionId:', message.sessionId);
        recorder.start(message.sessionId);
        console.log('[QAerx] Recorder started successfully');
        sendResponse({ success: true });
      } catch (error) {
        console.error('[QAerx] Failed to start recording:', error);
        sendResponse({ success: false, error: String(error) });
      }
      return false;

    case 'recording:stop':
      try {
        if (!recorder) {
          throw new Error('Recorder not initialized: ' + (initError || 'unknown error'));
        }
        console.log('[QAerx] Stopping recorder...');
        const steps = recorder.stop();
        console.log('[QAerx] Recorder stopped, steps:', steps.length);
        sendResponse({ success: true, steps });
      } catch (error) {
        console.error('[QAerx] Failed to stop recording:', error);
        sendResponse({ success: false, steps: [], error: String(error) });
      }
      return false;

    case 'recording:pause':
      try {
        if (!recorder) {
          throw new Error('Recorder not initialized: ' + (initError || 'unknown error'));
        }
        recorder.pause();
        sendResponse({ success: true });
      } catch (error) {
        console.error('[QAerx] Failed to pause recording:', error);
        sendResponse({ success: false, error: String(error) });
      }
      return false;

    case 'recording:resume':
      try {
        if (!recorder) {
          throw new Error('Recorder not initialized: ' + (initError || 'unknown error'));
        }
        recorder.resume();
        sendResponse({ success: true });
      } catch (error) {
        console.error('[QAerx] Failed to resume recording:', error);
        sendResponse({ success: false, error: String(error) });
      }
      return false;

    case 'recording:status':
      try {
        if (!recorder) {
          sendResponse({ isRecording: false, steps: [], error: initError || 'Recorder not initialized' });
          return false;
        }
        sendResponse({
          isRecording: recorder.isRecording(),
          steps: recorder.getSteps(),
        });
      } catch (error) {
        console.error('[QAerx] Failed to get recording status:', error);
        sendResponse({ isRecording: false, steps: [], error: String(error) });
      }
      return false;

    // Playback commands
    case 'playback:execute':
      if (!playback) {
        sendResponse({ success: false, error: 'Playback not initialized: ' + (initError || 'unknown error') });
        return false;
      }
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
      if (!playback) {
        sendResponse({ success: false, error: 'Playback not initialized' });
        return false;
      }
      playback.stop();
      sendResponse({ success: true });
      return false;

    // Element picker commands
    case 'picker:start':
      if (!elementPicker) {
        sendResponse({ success: false, error: 'Element picker not initialized' });
        return false;
      }
      elementPicker.start((selectors) => {
        chrome.runtime.sendMessage({
          type: 'picker:element-selected',
          selectors,
        }).catch(() => {});
      });
      sendResponse({ success: true });
      return false;

    case 'picker:stop':
      if (!elementPicker) {
        sendResponse({ success: false, error: 'Element picker not initialized' });
        return false;
      }
      elementPicker.stop();
      sendResponse({ success: true });
      return false;

    // Selector validation
    case 'selector:validate':
      try {
        const elements = document.querySelectorAll(message.selector);
        sendResponse({
          success: true,
          isValid: elements.length > 0,
          count: elements.length,
          element: elements.length === 1 ? {
            tag: elements[0].tagName.toLowerCase(),
            text: elements[0].textContent?.trim().substring(0, 50),
          } : null,
        });
      } catch (error) {
        sendResponse({ success: false, isValid: false, count: 0, error: String(error) });
      }
      return false;

    // Element highlighting
    case 'element:highlight':
      if (!highlighter) {
        sendResponse({ success: false, error: 'Highlighter not initialized' });
        return false;
      }
      highlighter.highlight(message.selector);
      sendResponse({ success: true });
      return false;

    case 'element:clear-highlight':
      if (!highlighter) {
        sendResponse({ success: false, error: 'Highlighter not initialized' });
        return false;
      }
      highlighter.clear();
      sendResponse({ success: true });
      return false;

    // Page analyzer
    case 'analyzer:getPageContext':
      try {
        const context = getSimplifiedPageContext();
        sendResponse({ success: true, context });
      } catch (error) {
        sendResponse({ success: false, error: String(error) });
      }
      return false;

    case 'analyzer:getFullAnalysis':
      try {
        const analysis = analyzeCurrentPage();
        sendResponse({ success: true, analysis });
      } catch (error) {
        sendResponse({ success: false, error: String(error) });
      }
      return false;

    default:
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'content-script:ready' }).catch(() => {
  // Ignore errors if background is not ready yet
});

console.log('[QAerx] Content script fully initialized and ready for messages');
