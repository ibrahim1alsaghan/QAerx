import { getRecorder } from './recorder/RecorderEngine';
import { getPlayback } from './playback/PlaybackEngine';
import { getElementPicker } from './picker/ElementPicker';
import { getElementHighlighter } from './highlighter/ElementHighlighter';
import { getSimplifiedPageContext } from './helpers/PageAnalyzer';

// Initialize engines
const recorder = getRecorder();
const playback = getPlayback();
const elementPicker = getElementPicker();
const highlighter = getElementHighlighter();

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'ping':
      sendResponse({ success: true, loaded: true });
      return false;

    // Recording commands
    case 'recording:start':
      recorder.start(message.sessionId);
      sendResponse({ success: true });
      return false;

    case 'recording:stop':
      const steps = recorder.stop();
      sendResponse({ success: true, steps });
      return false;

    case 'recording:pause':
      recorder.pause();
      sendResponse({ success: true });
      return false;

    case 'recording:resume':
      recorder.resume();
      sendResponse({ success: true });
      return false;

    case 'recording:status':
      sendResponse({
        isRecording: recorder.isRecording(),
        steps: recorder.getSteps(),
      });
      return false;

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
      return false;

    // Element picker commands
    case 'picker:start':
      elementPicker.start((selectors) => {
        chrome.runtime.sendMessage({
          type: 'picker:element-selected',
          selectors,
        }).catch(() => {});
      });
      sendResponse({ success: true });
      return false;

    case 'picker:stop':
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
      highlighter.highlight(message.selector);
      sendResponse({ success: true });
      return false;

    case 'element:clear-highlight':
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

    default:
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'content-script:ready' }).catch(() => {
  // Ignore errors if background is not ready yet
});

console.log('[QAerx] Content script initialized');
