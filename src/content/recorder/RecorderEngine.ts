import { EventCapture, type CapturedEvent } from './EventCapture';
import { SelectorGenerator } from './SelectorGenerator';
import { ActionFilter } from './ActionFilter';
import { debounce } from '../utils/contentDebounce';
import { contentLogger as logger } from '../utils/contentLogger';
import type { UIStep, UIAction, SelectorStrategy } from '@/types/test';

// Use native crypto.randomUUID() instead of uuid package to avoid external imports
const uuid = () => crypto.randomUUID();

interface RecordingSession {
  id: string;
  startedAt: number;
  isPaused: boolean;
  steps: UIStep[];
  pendingEvents: CapturedEvent[];
}

export class RecorderEngine {
  private session: RecordingSession | null = null;
  private eventCapture: EventCapture;
  private selectorGenerator: SelectorGenerator;
  private actionFilter: ActionFilter;
  private debouncedProcessEvents: () => void;

  constructor() {
    this.eventCapture = new EventCapture(this.handleEvent.bind(this));
    this.selectorGenerator = new SelectorGenerator();
    this.actionFilter = new ActionFilter();
    // Increased debounce to 500ms to better consolidate typing events
    this.debouncedProcessEvents = debounce(() => this.processPendingEvents(), 500);
  }

  start(sessionId: string): void {
    if (this.session) {
      throw new Error('Recording already in progress');
    }

    console.log('[QAerx RecorderEngine] Starting recording session:', sessionId);

    this.session = {
      id: sessionId,
      startedAt: Date.now(),
      isPaused: false,
      steps: [],
      pendingEvents: [],
    };

    this.eventCapture.attach();
    this.showRecordingIndicator();
    this.sendToBackground({ type: 'recording:started', sessionId });
    console.log('[QAerx RecorderEngine] Recording started successfully');
  }

  private showRecordingIndicator(): void {
    // Remove existing indicator if any
    const existing = document.getElementById('qaerx-recording-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'qaerx-recording-indicator';
    indicator.setAttribute('data-qaerx-extension', 'true');
    indicator.innerHTML = `
      <span style="width:10px;height:10px;background:#ef4444;border-radius:50%;display:inline-block;animation:qaerx-blink 1s infinite;"></span>
      <span>QAerx Recording</span>
    `;
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.85);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: none;
    `;

    // Add blink animation
    if (!document.getElementById('qaerx-recording-styles')) {
      const style = document.createElement('style');
      style.id = 'qaerx-recording-styles';
      style.textContent = `
        @keyframes qaerx-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(indicator);
  }

  private hideRecordingIndicator(): void {
    const indicator = document.getElementById('qaerx-recording-indicator');
    if (indicator) indicator.remove();
  }

  pause(): void {
    if (this.session) {
      this.session.isPaused = true;
      this.sendToBackground({ type: 'recording:paused' });
    }
  }

  resume(): void {
    if (this.session) {
      this.session.isPaused = false;
      this.sendToBackground({ type: 'recording:resumed' });
    }
  }

  stop(): UIStep[] {
    console.log('[QAerx RecorderEngine] Stop called');

    if (!this.session) {
      console.log('[QAerx RecorderEngine] No session to stop');
      return [];
    }

    this.eventCapture.detach();
    this.hideRecordingIndicator();
    this.processPendingEvents();

    const steps = this.session.steps;
    const sessionId = this.session.id;
    console.log('[QAerx RecorderEngine] Stopping with', steps.length, 'steps');

    this.session = null;

    this.sendToBackground({
      type: 'recording:stopped',
      sessionId,
      steps,
    });

    console.log('[QAerx RecorderEngine] Recording stopped, returning steps');
    return steps;
  }

  getSteps(): UIStep[] {
    return this.session?.steps || [];
  }

  isRecording(): boolean {
    return this.session !== null && !this.session.isPaused;
  }

  private handleEvent(event: CapturedEvent): void {
    console.log('[QAerx RecorderEngine] handleEvent called:', event.type);

    if (!this.session) {
      console.log('[QAerx RecorderEngine] No active session, ignoring event');
      return;
    }

    if (this.session.isPaused) {
      console.log('[QAerx RecorderEngine] Session paused, ignoring event');
      return;
    }

    this.session.pendingEvents.push(event);
    console.log('[QAerx RecorderEngine] Event added to pending queue, count:', this.session.pendingEvents.length);
    this.debouncedProcessEvents();
  }

  private processPendingEvents(): void {
    console.log('[QAerx RecorderEngine] processPendingEvents called');

    if (!this.session) {
      console.log('[QAerx RecorderEngine] No session, returning');
      return;
    }

    if (this.session.pendingEvents.length === 0) {
      console.log('[QAerx RecorderEngine] No pending events, returning');
      return;
    }

    const events = this.session.pendingEvents;
    console.log('[QAerx RecorderEngine] Processing', events.length, 'pending events');
    this.session.pendingEvents = [];

    const filteredEvents = this.actionFilter.filter(events);
    console.log('[QAerx RecorderEngine] After filtering:', filteredEvents.length, 'events');

    for (const event of filteredEvents) {
      // Check if this is an input event that should be merged with the last step
      if (event.type === 'input' && this.session.steps.length > 0) {
        const lastStep = this.session.steps[this.session.steps.length - 1];

        // If last step was a type action on the same element, update it instead of creating new
        if (lastStep.action.type === 'type' && this.isSameElement(lastStep, event)) {
          const newText = event.value || '';
          lastStep.action = { type: 'type', text: newText };
          lastStep.name = this.generateStepName(lastStep.action, lastStep.selectors[0]);
          console.log('[QAerx RecorderEngine] Merged input into existing step:', lastStep.name);

          // Notify background of the updated step
          this.sendToBackground({
            type: 'recording:step-updated',
            step: lastStep,
          });
          continue;
        }
      }

      const step = this.createStep(event);
      if (step) {
        this.session.steps.push(step);
        console.log('[QAerx RecorderEngine] Step created and added:', step.name, 'Total steps:', this.session.steps.length);
        this.sendToBackground({
          type: 'recording:step-added',
          step,
        });
      } else {
        console.log('[QAerx RecorderEngine] Could not create step for event:', event.type);
      }
    }
  }

  /**
   * Check if an event targets the same element as an existing step
   */
  private isSameElement(step: UIStep, event: CapturedEvent): boolean {
    // Compare using the primary selector
    const stepSelector = step.selectors[0]?.value;
    if (!stepSelector) return false;

    try {
      const stepElement = document.querySelector(stepSelector);
      return stepElement === event.target;
    } catch {
      return false;
    }
  }

  private createStep(event: CapturedEvent): UIStep | null {
    const selectors = this.selectorGenerator.generate(event.target);

    if (selectors.length === 0) {
      logger.warn('Could not generate selectors for element:', event.target);
      return null;
    }

    const action = this.mapEventToAction(event);
    if (!action) {
      return null;
    }

    const step: UIStep = {
      id: uuid(),
      type: 'ui',
      order: this.session!.steps.length,
      name: this.generateStepName(action, selectors[0]),
      enabled: true,
      continueOnFailure: false,
      action,
      selectors: event.frameSelector
        ? selectors.map((s) => ({ ...s, frameSelector: event.frameSelector }))
        : selectors,
    };

    return step;
  }

  private mapEventToAction(event: CapturedEvent): UIAction | null {
    switch (event.type) {
      case 'click':
        return { type: 'click', button: event.button };
      case 'dblclick':
        return { type: 'dblclick' };
      case 'input':
        return { type: 'type', text: event.value || '' };
      case 'change':
        if (event.target.tagName === 'SELECT') {
          return { type: 'select', value: event.value || '' };
        }
        if (
          event.target instanceof HTMLInputElement &&
          (event.target.type === 'checkbox' || event.target.type === 'radio')
        ) {
          return event.checked ? { type: 'check' } : { type: 'uncheck' };
        }
        return null;
      case 'scroll':
        return { type: 'scroll', x: event.scrollX, y: event.scrollY };
      case 'keydown':
        if (event.key) {
          return { type: 'press', key: event.key, modifiers: event.modifiers };
        }
        return null;
      default:
        return null;
    }
  }

  private generateStepName(action: UIAction, selector: SelectorStrategy): string {
    const elementDesc = this.selectorGenerator.getElementDescription(selector);

    switch (action.type) {
      case 'click':
        return `Click ${elementDesc}`;
      case 'dblclick':
        return `Double-click ${elementDesc}`;
      case 'type':
        const text = action.text.length > 20 ? action.text.substring(0, 20) + '...' : action.text;
        return `Type "${text}" into ${elementDesc}`;
      case 'select':
        return `Select "${action.value}" in ${elementDesc}`;
      case 'check':
        return `Check ${elementDesc}`;
      case 'uncheck':
        return `Uncheck ${elementDesc}`;
      case 'scroll':
        return `Scroll page`;
      case 'press':
        const mods = action.modifiers?.join('+') || '';
        return `Press ${mods ? mods + '+' : ''}${action.key}`;
      default:
        return `${action.type} on ${elementDesc}`;
    }
  }

  private sendToBackground(message: unknown): void {
    try {
      chrome.runtime.sendMessage(message);
    } catch (e) {
      logger.error('Failed to send message to background:', e);
    }
  }
}

// Singleton instance for content script
let recorderInstance: RecorderEngine | null = null;

export function getRecorder(): RecorderEngine {
  if (!recorderInstance) {
    recorderInstance = new RecorderEngine();
  }
  return recorderInstance;
}
