import type { UIStep, UIAction, SelectorStrategy } from '@/types/test';
import type { AIValidationData } from '@/types/validation';

export interface StepExecutionContext {
  urlBefore: string;
  urlAfter: string;
  titleBefore: string;
  titleAfter: string;
}

export interface StepResult {
  stepId: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';  // 'pending' = needs AI validation
  duration: number;
  error?: string;
  screenshot?: string;
  pageResponse?: string; // Captured page feedback (success/error messages)
  context?: StepExecutionContext; // Rich context for AI validation
  aiValidation?: AIValidationData; // AI validation result (added after execution)
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
  private currentHighlight: HTMLElement | null = null;

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

      // Only stop on execution errors (status='failed'), not on 'pending' status
      // 'pending' means execution succeeded but needs AI validation to determine pass/fail
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
    this.hideLiveHighlight(); // Clean up any active highlight
  }

  private async executeStep(
    step: UIStep,
    timeout: number,
    variables: Record<string, string>
  ): Promise<StepResult> {
    const action = this.substituteVariables(step.action, variables);

    // Capture state before execution
    const urlBefore = window.location.href;
    const titleBefore = document.title;

    try {
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

        case 'waitTime':
          await this.waitTime((action as { duration: number }).duration);
          break;

        case 'scroll':
          await this.scroll((action as { x?: number; y?: number }).x || 0, (action as { x?: number; y?: number }).y || 0);
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      // Wait a bit for page to update after action
      await this.sleep(500);

      // Capture page response/feedback
      const pageResponse = this.capturePageResponse(action.type);

      // Capture state after execution
      const urlAfter = window.location.href;
      const titleAfter = document.title;

      // Return result with 'pending' status - AI validation will determine final pass/fail
      // This replaces the fragile `pageResponse.startsWith('Error:')` check
      return {
        stepId: step.id,
        status: 'pending',  // Final status determined by AI validation in sidepanel
        duration: 0,
        pageResponse,
        context: {
          urlBefore,
          urlAfter,
          titleBefore,
          titleAfter,
        },
      };
    } catch (error) {
      // Execution error (element not found, timeout, etc.) - this is a definite failure
      const pageResponse = this.capturePageResponse(action.type, true);
      const urlAfter = window.location.href;
      const titleAfter = document.title;

      // Try to highlight the failed element and capture a screenshot
      let screenshot: string | undefined;
      try {
        // Try to find and highlight the element that failed
        const failedElement = this.tryFindFailedElement(step.selectors);
        if (failedElement) {
          this.highlightElement(failedElement);
        }

        // Capture screenshot with highlighted element
        screenshot = await this.captureScreenshot();

        // Remove highlight after capture
        if (failedElement) {
          this.removeHighlight(failedElement);
        }
      } catch (screenshotError) {
        console.warn('[PlaybackEngine] Failed to capture screenshot:', screenshotError);
      }

      return {
        stepId: step.id,
        status: 'failed',  // Execution errors are always failures
        duration: 0,
        error: error instanceof Error ? error.message : String(error),
        screenshot,
        pageResponse,
        context: {
          urlBefore,
          urlAfter,
          titleBefore,
          titleAfter,
        },
      };
    }
  }

  /**
   * Capture page response/feedback after an action
   * Looks for success messages, error alerts, toasts, etc.
   */
  private capturePageResponse(actionType: string, isError = false): string | undefined {
    try {
      // Common error message selectors - expanded list
      const errorSelectors = [
        // Generic error classes
        '.error', '.error-message', '.alert-error', '.alert-danger', '.alert-warning',
        '[role="alert"]', '.toast-error', '.notification-error',
        '.invalid-feedback', '.form-error', '.validation-error', '.field-error',
        '.text-red-500', '.text-red-600', '.text-danger', '.text-error',
        '[class*="error"]', '[class*="invalid"]', '[class*="danger"]',
        // Framework-specific
        '.MuiAlert-standardError', '.ant-alert-error', '.chakra-alert--error',
        '.Toastify__toast--error', '.swal2-error',
        // Form validation
        '.help-block', '.error-text', '.error-msg', '.errormsg',
        // Snackbar/toast messages
        '.snackbar-error', '.notification.error', '.message-error',
      ];

      // Common success message selectors - expanded list
      const successSelectors = [
        '.success', '.success-message', '.alert-success',
        '.toast-success', '.notification-success',
        '.text-green-500', '.text-green-600', '.text-success',
        '[class*="success"]',
        // Framework-specific
        '.MuiAlert-standardSuccess', '.ant-alert-success', '.chakra-alert--success',
        '.Toastify__toast--success', '.swal2-success',
        // Snackbar/toast messages
        '.snackbar-success', '.notification.success', '.message-success',
      ];

      // Error keywords to detect
      const errorKeywords = [
        'invalid', 'error', 'failed', 'incorrect', 'wrong', 'not found',
        'denied', 'unauthorized', 'forbidden', 'required', 'missing',
        'unable', 'cannot', 'couldn\'t', 'can\'t', 'problem',
        'please try', 'try again', 'not valid', 'does not match',
        'already exists', 'not exist', 'expired', 'timeout',
      ];

      // Success keywords to detect
      const successKeywords = [
        'success', 'logged in', 'welcome', 'created', 'saved', 'completed',
        'submitted', 'updated', 'deleted', 'confirmed', 'verified',
        'thank you', 'thanks', 'done', 'successful', 'approved',
      ];

      // Check for error messages first
      for (const selector of errorSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent?.trim();
            if (text && text.length > 2 && text.length < 300 && this.isElementVisible(el)) {
              const lowerText = text.toLowerCase();
              // Check if it contains any error keyword
              if (errorKeywords.some(keyword => lowerText.includes(keyword))) {
                return `Error: ${text.substring(0, 150)}`;
              }
              // Even if no keyword, if it's in an error-classed element, capture it
              if (selector.includes('error') || selector.includes('danger') || selector.includes('invalid')) {
                return `Error: ${text.substring(0, 150)}`;
              }
            }
          }
        } catch { /* ignore */ }
      }

      // Also scan for any visible text that looks like an error (even without special class)
      try {
        const allElements = document.querySelectorAll('p, span, div, li');
        for (const el of allElements) {
          const text = el.textContent?.trim();
          if (text && text.length > 5 && text.length < 150 && this.isElementVisible(el)) {
            const lowerText = text.toLowerCase();
            // Strong error indicators
            if ((lowerText.includes('invalid') && (lowerText.includes('password') || lowerText.includes('email') || lowerText.includes('credentials'))) ||
                (lowerText.includes('incorrect') && (lowerText.includes('password') || lowerText.includes('email'))) ||
                lowerText.includes('login failed') || lowerText.includes('authentication failed')) {
              return `Error: ${text}`;
            }
          }
        }
      } catch { /* ignore */ }

      // Check for success messages
      if (!isError) {
        for (const selector of successSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              const text = el.textContent?.trim();
              if (text && text.length > 2 && text.length < 300 && this.isElementVisible(el)) {
                const lowerText = text.toLowerCase();
                if (successKeywords.some(keyword => lowerText.includes(keyword))) {
                  return `Success: ${text.substring(0, 150)}`;
                }
                // If it's in a success-classed element, capture it
                if (selector.includes('success')) {
                  return `Success: ${text.substring(0, 150)}`;
                }
              }
            }
          } catch { /* ignore */ }
        }
      }

      // Check URL change for login/navigation actions
      if (actionType === 'click') {
        const path = window.location.pathname;
        const search = window.location.search.toLowerCase();

        // Detect successful login by URL change
        if (path.includes('dashboard') || path.includes('home') || path.includes('main') ||
            path.includes('profile') || path.includes('account') || path.includes('admin')) {
          return 'Success: Redirected to dashboard';
        }
        // Detect error in URL
        if (path.includes('error') || search.includes('error') || search.includes('failed')) {
          return 'Error: Redirected to error page';
        }
        // Still on login page with error params
        if ((path.includes('login') || path.includes('signin')) &&
            (search.includes('error') || search.includes('failed') || search.includes('invalid'))) {
          return 'Error: Login failed - redirected back to login';
        }
      }

      // Check page title for hints
      const title = document.title.toLowerCase();
      if (title.includes('error') || title.includes('404') || title.includes('denied') || title.includes('failed')) {
        return `Error: Page shows "${document.title}"`;
      }
      if (title.includes('dashboard') || title.includes('welcome') || title.includes('home') || title.includes('success')) {
        return `Success: Page shows "${document.title}"`;
      }

      return undefined;
    } catch {
      return undefined;
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
    this.showLiveHighlight(element);
    (element as HTMLElement).click();
    await this.sleep(100);
    this.hideLiveHighlight();
  }

  private async dblclick(selectors: SelectorStrategy[], timeout: number): Promise<void> {
    const element = await this.findElement(selectors, timeout);
    this.scrollIntoView(element);
    this.showLiveHighlight(element);
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await this.sleep(100);
    this.hideLiveHighlight();
  }

  private async type(selectors: SelectorStrategy[], text: string, timeout: number): Promise<void> {
    const element = await this.findElement(selectors, timeout);
    this.scrollIntoView(element);
    this.showLiveHighlight(element);

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
      this.hideLiveHighlight();
    } else {
      this.hideLiveHighlight();
      throw new Error('Element is not an input or textarea');
    }
  }

  private async select(selectors: SelectorStrategy[], value: string, timeout: number): Promise<void> {
    const element = await this.findElement(selectors, timeout);
    this.scrollIntoView(element);
    this.showLiveHighlight(element);

    if (element instanceof HTMLSelectElement) {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      await this.sleep(100);
      this.hideLiveHighlight();
    } else {
      this.hideLiveHighlight();
      throw new Error('Element is not a select');
    }
  }

  private async check(selectors: SelectorStrategy[], checked: boolean, timeout: number): Promise<void> {
    const element = await this.findElement(selectors, timeout);
    this.scrollIntoView(element);
    this.showLiveHighlight(element);

    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      if (element.checked !== checked) {
        element.click();
      }
      await this.sleep(100);
      this.hideLiveHighlight();
    } else {
      this.hideLiveHighlight();
      throw new Error('Element is not a checkbox or radio');
    }
  }

  private async waitForElement(selectors: SelectorStrategy[], timeout: number): Promise<void> {
    await this.findElement(selectors, timeout);
  }

  private async waitTime(duration: number): Promise<void> {
    await this.sleep(duration);
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

  /**
   * Show live highlight on the element being interacted with (blue/green glow)
   */
  private showLiveHighlight(element: Element): void {
    this.hideLiveHighlight(); // Remove any existing highlight

    const htmlEl = element as HTMLElement;
    this.currentHighlight = htmlEl;

    // Store original styles
    htmlEl.dataset.liveOutline = htmlEl.style.outline;
    htmlEl.dataset.liveBoxShadow = htmlEl.style.boxShadow;
    htmlEl.dataset.liveTransition = htmlEl.style.transition;

    // Apply live highlight (blue glow)
    htmlEl.style.transition = 'outline 0.2s, box-shadow 0.2s';
    htmlEl.style.outline = '2px solid #3b82f6';
    htmlEl.style.boxShadow = '0 0 12px 4px rgba(59, 130, 246, 0.4)';
  }

  /**
   * Remove the live highlight from the current element
   */
  private hideLiveHighlight(): void {
    if (this.currentHighlight) {
      const htmlEl = this.currentHighlight;
      htmlEl.style.outline = htmlEl.dataset.liveOutline || '';
      htmlEl.style.boxShadow = htmlEl.dataset.liveBoxShadow || '';
      htmlEl.style.transition = htmlEl.dataset.liveTransition || '';
      delete htmlEl.dataset.liveOutline;
      delete htmlEl.dataset.liveBoxShadow;
      delete htmlEl.dataset.liveTransition;
      this.currentHighlight = null;
    }
  }

  /**
   * Try to find the element that failed (for highlighting)
   * This is a best-effort attempt that doesn't throw
   */
  private tryFindFailedElement(selectors: SelectorStrategy[]): Element | null {
    if (!selectors || selectors.length === 0) return null;

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
        }

        if (element) {
          return element;
        }
      } catch {
        // Continue to next selector
      }
    }

    return null;
  }

  /**
   * Highlight an element with a red border to indicate failure
   */
  private highlightElement(element: Element): void {
    const htmlEl = element as HTMLElement;
    // Store original styles
    htmlEl.dataset.originalOutline = htmlEl.style.outline;
    htmlEl.dataset.originalBoxShadow = htmlEl.style.boxShadow;

    // Apply failure highlight
    htmlEl.style.outline = '3px solid #ef4444';
    htmlEl.style.boxShadow = '0 0 10px 3px rgba(239, 68, 68, 0.5)';
  }

  /**
   * Remove the failure highlight from an element
   */
  private removeHighlight(element: Element): void {
    const htmlEl = element as HTMLElement;
    htmlEl.style.outline = htmlEl.dataset.originalOutline || '';
    htmlEl.style.boxShadow = htmlEl.dataset.originalBoxShadow || '';
    delete htmlEl.dataset.originalOutline;
    delete htmlEl.dataset.originalBoxShadow;
  }

  /**
   * Capture a screenshot of the current page via the background script
   */
  private async captureScreenshot(): Promise<string | undefined> {
    try {
      // Small delay to ensure highlight is rendered
      await this.sleep(100);

      // Request screenshot from background script
      const response = await chrome.runtime.sendMessage({
        type: 'command:capture-screenshot',
      });

      if (response.success && response.screenshot) {
        return response.screenshot;
      }

      console.warn('[PlaybackEngine] Screenshot capture failed:', response.error);
      return undefined;
    } catch (error) {
      console.warn('[PlaybackEngine] Failed to request screenshot:', error);
      return undefined;
    }
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
