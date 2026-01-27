import { EventCapture, type CapturedEvent } from './EventCapture';
import { SelectorGenerator } from './SelectorGenerator';
import { ActionFilter } from './ActionFilter';
import type { UIStep, UIAction, SelectorStrategy } from '@/types/test';
import { v4 as uuid } from 'uuid';

interface RecordingSession {
  id: string;
  startedAt: number;
  isPaused: boolean;
  steps: UIStep[];
  pendingEvents: CapturedEvent[];
}

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
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
    this.debouncedProcessEvents = debounce(() => this.processPendingEvents(), 100);
  }

  start(sessionId: string): void {
    if (this.session) {
      throw new Error('Recording already in progress');
    }

    this.session = {
      id: sessionId,
      startedAt: Date.now(),
      isPaused: false,
      steps: [],
      pendingEvents: [],
    };

    this.eventCapture.attach();
    this.sendToBackground({ type: 'recording:started', sessionId });
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
    if (!this.session) {
      return [];
    }

    this.eventCapture.detach();
    this.processPendingEvents();

    const steps = this.session.steps;
    const sessionId = this.session.id;
    this.session = null;

    this.sendToBackground({
      type: 'recording:stopped',
      sessionId,
      steps,
    });

    return steps;
  }

  getSteps(): UIStep[] {
    return this.session?.steps || [];
  }

  isRecording(): boolean {
    return this.session !== null && !this.session.isPaused;
  }

  private handleEvent(event: CapturedEvent): void {
    if (!this.session || this.session.isPaused) {
      return;
    }

    this.session.pendingEvents.push(event);
    this.debouncedProcessEvents();
  }

  private processPendingEvents(): void {
    if (!this.session || this.session.pendingEvents.length === 0) {
      return;
    }

    const events = this.session.pendingEvents;
    this.session.pendingEvents = [];

    const filteredEvents = this.actionFilter.filter(events);

    for (const event of filteredEvents) {
      const step = this.createStep(event);
      if (step) {
        this.session.steps.push(step);
        this.sendToBackground({
          type: 'recording:step-added',
          step,
        });
      }
    }
  }

  private createStep(event: CapturedEvent): UIStep | null {
    const selectors = this.selectorGenerator.generate(event.target);

    if (selectors.length === 0) {
      console.warn('Could not generate selectors for element:', event.target);
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
      console.error('Failed to send message to background:', e);
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
