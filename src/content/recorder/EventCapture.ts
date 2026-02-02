export interface CapturedEvent {
  type: 'click' | 'dblclick' | 'input' | 'change' | 'scroll' | 'keydown' | 'focus' | 'blur';
  timestamp: number;
  target: Element;
  value?: string;
  checked?: boolean;
  button?: 'left' | 'right' | 'middle';
  key?: string;
  modifiers?: string[];
  scrollX?: number;
  scrollY?: number;
  frameSelector?: string;
}

export type EventHandler = (event: CapturedEvent) => void;

export class EventCapture {
  private handler: EventHandler;
  private isAttached = false;
  private boundHandlers: Map<string, EventListener> = new Map();

  constructor(handler: EventHandler) {
    this.handler = handler;
  }

  attach(): void {
    if (this.isAttached) return;

    const events = ['click', 'dblclick', 'input', 'change', 'keydown', 'scroll'];
    console.log('[QAerx EventCapture] Attaching event listeners for:', events);

    for (const eventType of events) {
      const boundHandler = this.createHandler(eventType);
      this.boundHandlers.set(eventType, boundHandler);
      document.addEventListener(eventType, boundHandler, { capture: true, passive: true });
    }

    this.isAttached = true;
    console.log('[QAerx EventCapture] Event listeners attached successfully');
  }

  detach(): void {
    if (!this.isAttached) return;

    for (const [eventType, handler] of this.boundHandlers) {
      document.removeEventListener(eventType, handler, { capture: true });
    }
    this.boundHandlers.clear();
    this.isAttached = false;
  }

  private createHandler(eventType: string): EventListener {
    return (e: Event) => {
      console.log(`[QAerx EventCapture] Event detected: ${eventType}`, e.target);
      const captured = this.captureEvent(eventType, e);
      if (captured) {
        console.log(`[QAerx EventCapture] Event captured:`, captured.type, captured.target);
        this.handler(captured);
      } else {
        console.log(`[QAerx EventCapture] Event filtered out: ${eventType}`);
      }
    };
  }

  private captureEvent(type: string, e: Event): CapturedEvent | null {
    const target = e.target as Element;
    if (!target || !(target instanceof Element)) return null;

    // Skip if target is part of extension UI
    if (target.closest('[data-qaerx-extension]')) return null;

    const base: Partial<CapturedEvent> = {
      timestamp: Date.now(),
      target,
      frameSelector: this.getFrameSelector(target),
    };

    switch (type) {
      case 'click':
      case 'dblclick': {
        const mouseEvent = e as MouseEvent;
        return {
          ...base,
          type: type as 'click' | 'dblclick',
          target,
          timestamp: base.timestamp!,
          button: this.getMouseButton(mouseEvent.button),
        };
      }

      case 'input': {
        const inputTarget = target as HTMLInputElement | HTMLTextAreaElement;
        if (!('value' in inputTarget)) return null;
        return {
          ...base,
          type: 'input',
          target,
          timestamp: base.timestamp!,
          value: inputTarget.value,
        };
      }

      case 'change': {
        const changeTarget = target as HTMLInputElement | HTMLSelectElement;
        if (changeTarget.tagName === 'SELECT') {
          return {
            ...base,
            type: 'change',
            target,
            timestamp: base.timestamp!,
            value: (changeTarget as HTMLSelectElement).value,
          };
        }
        if (changeTarget.type === 'checkbox' || changeTarget.type === 'radio') {
          return {
            ...base,
            type: 'change',
            target,
            timestamp: base.timestamp!,
            checked: (changeTarget as HTMLInputElement).checked,
          };
        }
        return null;
      }

      case 'keydown': {
        const keyEvent = e as KeyboardEvent;
        // Only capture special keys, not regular typing
        if (this.isSpecialKey(keyEvent.key)) {
          return {
            ...base,
            type: 'keydown',
            target,
            timestamp: base.timestamp!,
            key: keyEvent.key,
            modifiers: this.getModifiers(keyEvent),
          };
        }
        return null;
      }

      case 'scroll': {
        return {
          ...base,
          type: 'scroll',
          target,
          timestamp: base.timestamp!,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        };
      }

      default:
        return null;
    }
  }

  private getMouseButton(button: number): 'left' | 'right' | 'middle' {
    switch (button) {
      case 0:
        return 'left';
      case 1:
        return 'middle';
      case 2:
        return 'right';
      default:
        return 'left';
    }
  }

  private isSpecialKey(key: string): boolean {
    const specialKeys = [
      'Enter',
      'Tab',
      'Escape',
      'Backspace',
      'Delete',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'F1',
      'F2',
      'F3',
      'F4',
      'F5',
      'F6',
      'F7',
      'F8',
      'F9',
      'F10',
      'F11',
      'F12',
    ];
    return specialKeys.includes(key);
  }

  private getModifiers(e: KeyboardEvent): string[] {
    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.altKey) modifiers.push('Alt');
    if (e.metaKey) modifiers.push('Meta');
    return modifiers;
  }

  private getFrameSelector(target: Element): string | undefined {
    // Check if element is in an iframe
    const win = target.ownerDocument.defaultView;
    if (win === window) return undefined;

    // Find the iframe element
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.contentWindow === win) {
        // Generate selector for the iframe
        const id = iframe.id ? `#${iframe.id}` : '';
        const name = iframe.name ? `[name="${iframe.name}"]` : '';
        if (id) return `iframe${id}`;
        if (name) return `iframe${name}`;
        return `iframe[src="${iframe.src}"]`;
      }
    }
    return undefined;
  }
}
