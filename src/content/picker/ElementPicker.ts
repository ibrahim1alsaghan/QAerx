import { SelectorGenerator } from '../recorder/SelectorGenerator';
import type { SelectorStrategy } from '@/types/test';

export class ElementPicker {
  private isActive = false;
  private overlay: HTMLDivElement | null = null;
  private highlightBox: HTMLDivElement | null = null;
  private tooltip: HTMLDivElement | null = null;
  private currentElement: Element | null = null;
  private selectorGenerator = new SelectorGenerator();
  private onElementSelected?: (selectors: SelectorStrategy[]) => void;

  start(onSelect: (selectors: SelectorStrategy[]) => void): void {
    if (this.isActive) return;

    this.isActive = true;
    this.onElementSelected = onSelect;
    this.createUI();
    this.attachListeners();
    document.body.style.cursor = 'crosshair';
  }

  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.removeUI();
    this.detachListeners();
    document.body.style.cursor = '';
  }

  private createUI(): void {
    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'qaerx-picker-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999998;
      pointer-events: none;
    `;
    document.body.appendChild(this.overlay);

    // Highlight box
    this.highlightBox = document.createElement('div');
    this.highlightBox.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid #10b981;
      background: rgba(16, 185, 129, 0.1);
      border-radius: 4px;
      transition: all 0.1s ease;
      z-index: 999999;
    `;
    document.body.appendChild(this.highlightBox);

    // Tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = `
      position: absolute;
      pointer-events: none;
      background: #1f2937;
      color: #f9fafb;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
      z-index: 1000000;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    document.body.appendChild(this.tooltip);

    // Instructions banner
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      color: #f9fafb;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      z-index: 1000001;
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    banner.innerHTML = `
      <span>🎯 Click on any element to select it</span>
      <button style="
        background: #ef4444;
        color: white;
        border: none;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      " id="qaerx-picker-cancel">Cancel (ESC)</button>
    `;
    document.body.appendChild(banner);

    // Cancel button handler
    const cancelBtn = banner.querySelector('#qaerx-picker-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.stop());
    }

    // Store banner for cleanup
    this.overlay.dataset.banner = 'true';
    this.overlay.appendChild(banner);
  }

  private removeUI(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.highlightBox) {
      this.highlightBox.remove();
      this.highlightBox = null;
    }
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  private attachListeners(): void {
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private detachListeners(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleMouseMove = (e: MouseEvent): void => {
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element || element.id?.startsWith('qaerx-picker')) return;

    this.currentElement = element;
    this.highlightElement(element, e.clientX, e.clientY);
  };

  private handleClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    if (!this.currentElement) return;

    // Ignore clicks on picker UI
    const target = e.target as Element;
    if (target.id?.startsWith('qaerx-picker')) return;

    const selectors = this.selectorGenerator.generate(this.currentElement);
    this.stop();

    if (this.onElementSelected) {
      this.onElementSelected(selectors);
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.stop();
    }
  };

  private highlightElement(element: Element, mouseX: number, mouseY: number): void {
    if (!this.highlightBox || !this.tooltip) return;

    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Position highlight box
    this.highlightBox.style.top = `${rect.top + scrollY}px`;
    this.highlightBox.style.left = `${rect.left + scrollX}px`;
    this.highlightBox.style.width = `${rect.width}px`;
    this.highlightBox.style.height = `${rect.height}px`;

    // Generate selector preview
    const selectors = this.selectorGenerator.generate(element);
    const bestSelector = selectors[0];
    const selectorText = this.formatSelectorForDisplay(bestSelector);

    // Position tooltip
    const tooltipX = mouseX + 15;
    const tooltipY = mouseY + 15;

    this.tooltip.textContent = selectorText;
    this.tooltip.style.left = `${tooltipX}px`;
    this.tooltip.style.top = `${tooltipY}px`;
  }

  private formatSelectorForDisplay(selector: SelectorStrategy): string {
    const tag = this.currentElement?.tagName.toLowerCase() || '';
    const type = this.currentElement?.getAttribute('type') || '';
    const name = this.currentElement?.getAttribute('name') || '';

    let display = `${tag}`;
    if (type) display += `[type="${type}"]`;
    if (name) display += ` (name="${name}")`;

    // Check for dynamic selector warning
    const warning = this.selectorGenerator.isDynamicSelector(selector.value);
    if (warning) {
      return `⚠️ ${display} → ${selector.value}\n${warning}`;
    }

    // Show stability indicator
    const stability = this.selectorGenerator.getSelectorStability(selector);
    const stabilityIcon = stability >= 0.8 ? '✓' : stability >= 0.5 ? '~' : '⚠️';

    return `${stabilityIcon} ${display} → ${selector.value}`;
  }
}

// Singleton
let pickerInstance: ElementPicker | null = null;

export function getElementPicker(): ElementPicker {
  if (!pickerInstance) {
    pickerInstance = new ElementPicker();
  }
  return pickerInstance;
}
