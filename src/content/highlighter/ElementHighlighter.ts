export class ElementHighlighter {
  private highlightBox: HTMLDivElement | null = null;

  highlight(selector: string): void {
    this.clear();

    try {
      const element = document.querySelector(selector);
      if (!element) return;

      this.createHighlightBox(element);
    } catch (error) {
      // Invalid selector, ignore
    }
  }

  clear(): void {
    if (this.highlightBox) {
      this.highlightBox.remove();
      this.highlightBox = null;
    }
  }

  private createHighlightBox(element: Element): void {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    this.highlightBox = document.createElement('div');
    this.highlightBox.id = 'qaerx-highlight-box';
    this.highlightBox.style.cssText = `
      position: absolute;
      top: ${rect.top + scrollY}px;
      left: ${rect.left + scrollX}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      pointer-events: none;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      border-radius: 4px;
      z-index: 999999;
      animation: qaerx-pulse 2s ease-in-out infinite;
    `;

    // Add animation
    if (!document.getElementById('qaerx-highlight-styles')) {
      const style = document.createElement('style');
      style.id = 'qaerx-highlight-styles';
      style.textContent = `
        @keyframes qaerx-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(this.highlightBox);

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Auto-clear after 3 seconds
    setTimeout(() => this.clear(), 3000);
  }
}

// Singleton
let highlighterInstance: ElementHighlighter | null = null;

export function getElementHighlighter(): ElementHighlighter {
  if (!highlighterInstance) {
    highlighterInstance = new ElementHighlighter();
  }
  return highlighterInstance;
}
