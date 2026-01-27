import type { UIStep, UIAction, SelectorStrategy } from '@/types/test';

export interface StepResult {
  stepId: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

export interface PlaybackResult {
  status: 'passed' | 'failed';
  startedAt: number;
  completedAt: number;
  stepResults: StepResult[];
}

interface PlaybackOptions {
  timeout: number;
  variables: Record<string, string>;
  onStepStart?: (step: UIStep, index: number) => void;
  onStepComplete?: (step: UIStep, result: StepResult) => void;
}

const DEFAULT_TIMEOUT = 30000;

export class PlaybackEngine {
  private shouldStop = false;

  async execute(steps: UIStep[], options: Partial<PlaybackOptions> = {}): Promise<PlaybackResult> {
    const { timeout = DEFAULT_TIMEOUT, variables = {}, onStepStart, onStepComplete } = options;

    this.shouldStop = false;

    const result: PlaybackResult = {
      status: 'passed',
      startedAt: Date.now(),
      completedAt: 0,
      stepResults: [],
    };

    for (let i = 0; i < steps.length; i++) {
      if (this.shouldStop) {
        break;
      }

      const step = steps[i];
      if (!step.enabled) {
        result.stepResults.push({
          stepId: step.id,
          status: 'skipped',
          duration: 0,
        });
        continue;
      }

      onStepStart?.(step, i);

      const stepStart = Date.now();
      const stepResult = await this.executeStep(step, timeout, variables);
      stepResult.duration = Date.now() - stepStart;

      result.stepResults.push(stepResult);
      onStepComplete?.(step, stepResult);

      if (stepResult.status === 'failed' && !step.continueOnFailure) {
        result.status = 'failed';
        break;
      }
    }

    result.completedAt = Date.now();

    return result;
  }

  stop(): void {
    this.shouldStop = true;
  }

  private async executeStep(
    step: UIStep,
    timeout: number,
    variables: Record<string, string>
  ): Promise<StepResult> {
    try {
      const action = this.substituteVariables(step.action, variables);

      switch (action.type) {
        case 'navigate':
          await this.navigate((action as { url: string }).url, timeout);
          break;

        case 'click':
          await this.click(step.selectors, timeout);
          break;

        case 'dblclick':
          await this.dblclick(step.selectors, timeout);
          break;

        case 'type':
          await this.type(step.selectors, (action as { text: string }).text, timeout);
          break;

        case 'select':
          await this.select(step.selectors, (action as { value: string }).value, timeout);
          break;

        case 'check':
          await this.check(step.selectors, true, timeout);
          break;

        case 'uncheck':
          await this.check(step.selectors, false, timeout);
          break;

        case 'waitForElement':
          await this.waitForElement(step.selectors, timeout);
          break;

        case 'scroll':
          await this.scroll((action as { x?: number; y?: number }).x || 0, (action as { x?: number; y?: number }).y || 0);
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      return { stepId: step.id, status: 'passed', duration: 0 };
    } catch (error) {
      return {
        stepId: step.id,
        status: 'failed',
        duration: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private substituteVariables(action: UIAction, variables: Record<string, string>): UIAction {
    const substitute = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
    };

    const result = { ...action };

    if ('url' in result && typeof result.url === 'string') {
      result.url = substitute(result.url);
    }
    if ('text' in result && typeof result.text === 'string') {
      result.text = substitute(result.text);
    }
    if ('value' in result && typeof result.value === 'string') {
      result.value = substitute(result.value);
    }

    return result;
  }

  private async navigate(url: string, timeout: number): Promise<void> {
    window.location.href = url;
    await this.waitForLoad(timeout);
  }

  private async waitForLoad(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Page load timeout')), timeout);

      if (document.readyState === 'complete') {
        clearTimeout(timer);
        resolve();
        return;
      }

      window.addEventListener(
        'load',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    });
  }

  private async findElement(selectors: SelectorStrategy[], timeout: number): Promise<Element> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      for (const selector of selectors) {
        try {
          let element: Element | null = null;

          switch (selector.type) {
            case 'css':
            case 'data-testid':
            case 'data-cy':
            case 'aria':
              element = document.querySelector(selector.value);
              break;
            case 'xpath':
              const result = document.evaluate(
                selector.value,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              element = result.singleNodeValue as Element;
              break;
            case 'text':
              element = this.findByText(selector.value);
              break;
          }

          if (element && this.isElementVisible(element)) {
            return element;
          }
        } catch {
          // Try next selector
        }
      }

      await this.sleep(100);
    }

    throw new Error(`Element not found with selectors: ${selectors.map((s) => s.value).join(', ')}`);
  }

  private findByText(text: string): Element | null {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const element = node as Element;
      if (element.textContent?.trim() === text) {
        return element;
      }
    }

    return null;
  }

  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  }

  private async click(selectors: SelectorStrategy[], timeout: number): Promise<void> {
    const element = await this.findElement(selectors, timeout);
    this.scrollIntoView(element);
    (element as HTMLElement).click();
  }

  private async dblclick(selectors: SelectorStrategy[], timeout: number): Promise<void> {
    const element = await this.findElement(selectors, timeout);
    this.scrollIntoView(element);
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  }

  private async type(selectors: SelectorStrategy[], text: string, timeout: number): Promise<void> {
    const element = await this.findElement(selectors, timeout);
    this.scrollIntoView(element);

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.focus();
      element.value = '';

      // Type character by character for realistic behavior
      for (const char of text) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await this.sleep(10);
      }

      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      throw new Error('Element is not an input or textarea');
    }
  }

  private async select(selectors: SelectorStrategy[], value: string, timeout: number): Promise<void> {
    const element = await this.findElement(selectors, timeout);

    if (element instanceof HTMLSelectElement) {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      throw new Error('Element is not a select');
    }
  }

  private async check(selectors: SelectorStrategy[], checked: boolean, timeout: number): Promise<void> {
    const element = await this.findElement(selectors, timeout);

    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      if (element.checked !== checked) {
        element.click();
      }
    } else {
      throw new Error('Element is not a checkbox or radio');
    }
  }

  private async waitForElement(selectors: SelectorStrategy[], timeout: number): Promise<void> {
    await this.findElement(selectors, timeout);
  }

  private async scroll(x: number, y: number): Promise<void> {
    window.scrollTo(x, y);
  }

  private scrollIntoView(element: Element): void {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton
let playbackInstance: PlaybackEngine | null = null;

export function getPlayback(): PlaybackEngine {
  if (!playbackInstance) {
    playbackInstance = new PlaybackEngine();
  }
  return playbackInstance;
}
