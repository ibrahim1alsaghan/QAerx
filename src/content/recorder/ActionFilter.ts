import type { CapturedEvent } from './EventCapture';

export class ActionFilter {
  private readonly SCROLL_DEBOUNCE_MS = 300;

  filter(events: CapturedEvent[]): CapturedEvent[] {
    let filtered = events;

    // 1. Remove duplicate scroll events (keep last in sequence)
    filtered = this.dedupeScrolls(filtered);

    // 2. Collapse rapid input events into single type action
    filtered = this.collapseInputs(filtered);

    // 3. Remove hover events (noise)
    filtered = filtered.filter(
      (e) => e.type !== 'focus' && e.type !== 'blur'
    );

    // 4. Ignore events on extension UI elements
    filtered = filtered.filter((e) => !this.isExtensionElement(e.target));

    return filtered;
  }

  private dedupeScrolls(events: CapturedEvent[]): CapturedEvent[] {
    const result: CapturedEvent[] = [];
    let lastScroll: CapturedEvent | null = null;
    let lastScrollTime = 0;

    for (const event of events) {
      if (event.type === 'scroll') {
        if (lastScroll && event.timestamp - lastScrollTime < this.SCROLL_DEBOUNCE_MS) {
          // Replace previous scroll with this one
          result[result.length - 1] = event;
        } else {
          result.push(event);
        }
        lastScroll = event;
        lastScrollTime = event.timestamp;
      } else {
        result.push(event);
        lastScroll = null;
      }
    }

    return result;
  }

  private collapseInputs(events: CapturedEvent[]): CapturedEvent[] {
    const result: CapturedEvent[] = [];
    let inputBuffer: CapturedEvent[] = [];
    let currentTarget: Element | null = null;

    const flushBuffer = () => {
      if (inputBuffer.length > 0) {
        // Keep only the last input event (has final value)
        const last = inputBuffer[inputBuffer.length - 1];
        result.push(last);
        inputBuffer = [];
      }
    };

    for (const event of events) {
      if (event.type === 'input') {
        if (currentTarget !== event.target) {
          flushBuffer();
          currentTarget = event.target;
        }
        inputBuffer.push(event);
      } else {
        flushBuffer();
        currentTarget = null;
        result.push(event);
      }
    }

    flushBuffer();
    return result;
  }

  private isExtensionElement(element: Element): boolean {
    return element.closest('[data-qaerx-extension]') !== null;
  }
}
