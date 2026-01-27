import type { SelectorStrategy } from '@/types/test';

export class SelectorGenerator {
  generate(element: Element): SelectorStrategy[] {
    const strategies: SelectorStrategy[] = [];
    let priority = 0;

    // 1. data-testid (highest priority)
    const testId = element.getAttribute('data-testid');
    if (testId) {
      strategies.push({
        type: 'data-testid',
        value: `[data-testid="${testId}"]`,
        priority: priority++,
        confidence: 0.95,
      });
    }

    // 2. data-cy (Cypress convention)
    const dataCy = element.getAttribute('data-cy');
    if (dataCy) {
      strategies.push({
        type: 'data-cy',
        value: `[data-cy="${dataCy}"]`,
        priority: priority++,
        confidence: 0.95,
      });
    }

    // 3. ARIA labels and roles
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      strategies.push({
        type: 'aria',
        value: `[aria-label="${ariaLabel}"]`,
        priority: priority++,
        confidence: 0.85,
      });
    }

    const role = element.getAttribute('role');
    if (role && element.id && this.isStableId(element.id)) {
      strategies.push({
        type: 'aria',
        value: `[role="${role}"]#${element.id}`,
        priority: priority++,
        confidence: 0.8,
      });
    }

    // 4. ID (if stable-looking) - HIGHEST PRIORITY FOR FORMS
    if (element.id && this.isStableId(element.id)) {
      strategies.push({
        type: 'css',
        value: `#${CSS.escape(element.id)}`,
        priority: priority++,
        confidence: 0.95, // Increased confidence for stable IDs
      });
    }

    // 4.5. Name attribute (very useful for forms)
    const name = element.getAttribute('name');
    if (name && this.isStableName(name)) {
      strategies.push({
        type: 'css',
        value: `[name="${CSS.escape(name)}"]`,
        priority: priority++,
        confidence: 0.9,
      });
    }

    // 4.6. Type + Name combination (best for inputs)
    const type = element.getAttribute('type');
    if (type && name && this.isStableName(name)) {
      strategies.push({
        type: 'css',
        value: `input[type="${type}"][name="${CSS.escape(name)}"]`,
        priority: priority++,
        confidence: 0.92,
      });
    }

    // 4.7. Placeholder (useful for inputs without IDs)
    const placeholder = element.getAttribute('placeholder');
    if (placeholder && placeholder.length < 50) {
      strategies.push({
        type: 'css',
        value: `[placeholder="${CSS.escape(placeholder)}"]`,
        priority: priority++,
        confidence: 0.75,
      });
    }

    // 5. Semantic CSS selectors
    const cssSelector = this.generateSemanticCSS(element);
    if (cssSelector) {
      strategies.push({
        type: 'css',
        value: cssSelector,
        priority: priority++,
        confidence: 0.7,
      });
    }

    // 6. Text content (lowest priority)
    const textContent = this.getUniqueTextContent(element);
    if (textContent) {
      strategies.push({
        type: 'text',
        value: textContent,
        priority: priority++,
        confidence: 0.5,
      });
    }

    // 7. Full CSS path (fallback)
    const fullPath = this.generateFullCSSPath(element);
    strategies.push({
      type: 'css',
      value: fullPath,
      priority: priority++,
      confidence: 0.4,
    });

    return strategies;
  }

  private isStableId(id: string): boolean {
    const unstablePatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}/i, // UUID
      /^:r[0-9]+:/, // React auto-generated
      /^ember\d+$/, // Ember auto-generated
      /^ng-\d+$/, // Angular auto-generated
      /^\d+$/, // Pure numbers
      /^[a-z]+_[a-f0-9]{6,}$/i, // Common hash patterns
      /^mui-\d+$/, // MUI auto-generated
      /^headlessui-/, // Headless UI auto-generated
    ];
    return !unstablePatterns.some((p) => p.test(id));
  }

  private isStableName(name: string): boolean {
    // Names are generally stable if they're meaningful
    const unstablePatterns = [
      /^[a-f0-9]{8,}$/i, // Hash-like
      /^\d+$/, // Pure numbers
    ];
    return name.length > 0 && !unstablePatterns.some((p) => p.test(name));
  }

  private generateSemanticCSS(element: Element): string | null {
    const tag = element.tagName.toLowerCase();
    const classes = Array.from(element.classList)
      .filter((c) => this.isSemanticClass(c))
      .slice(0, 2);

    if (classes.length === 0) {
      return null;
    }

    const selector = `${tag}.${classes.join('.')}`;

    // Verify uniqueness
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }

    // Add parent context
    const parent = element.parentElement;
    if (parent && parent.tagName !== 'BODY') {
      const parentTag = parent.tagName.toLowerCase();
      const parentClasses = Array.from(parent.classList)
        .filter((c) => this.isSemanticClass(c))
        .slice(0, 1);

      if (parentClasses.length > 0) {
        const contextSelector = `${parentTag}.${parentClasses[0]} > ${selector}`;
        if (document.querySelectorAll(contextSelector).length === 1) {
          return contextSelector;
        }
      }
    }

    return null;
  }

  private isSemanticClass(className: string): boolean {
    const nonSemanticPatterns = [
      /^[a-z]{1,2}-\d+$/, // Tailwind utility (e.g., p-4, m-2)
      /^[a-f0-9]{6,}$/i, // Hash classes
      /^css-[a-z0-9]+$/i, // CSS-in-JS
      /^sc-[a-zA-Z]+$/, // Styled components
      /^emotion-[0-9]+$/, // Emotion
      /^_[a-zA-Z0-9]+$/, // CSS modules
      /^[a-z]+__[a-z]+--/, // BEM modifier noise
    ];
    return className.length > 2 && !nonSemanticPatterns.some((p) => p.test(className));
  }

  private generateFullCSSPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current.tagName !== 'HTML') {
      let selector = current.tagName.toLowerCase();

      if (current.id && this.isStableId(current.id)) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }

      // Add nth-child if needed
      const parent: Element | null = current.parentElement;
      if (parent) {
        const currentTagName = current.tagName;
        const children = parent.children;
        const siblings: Element[] = [];
        for (let i = 0; i < children.length; i++) {
          if (children[i].tagName === currentTagName) {
            siblings.push(children[i]);
          }
        }
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
        path.unshift(selector);
        current = parent;
      } else {
        path.unshift(selector);
        break;
      }
    }

    return path.join(' > ');
  }

  private getUniqueTextContent(element: Element): string | null {
    // Only use text for buttons, links, and labels
    const textElements = ['BUTTON', 'A', 'LABEL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    if (!textElements.includes(element.tagName)) {
      return null;
    }

    const text = element.textContent?.trim();
    if (!text || text.length < 2 || text.length > 50) {
      return null;
    }

    return text;
  }

  getElementDescription(selector: SelectorStrategy): string {
    if (selector.type === 'text') {
      return `"${selector.value.substring(0, 20)}${selector.value.length > 20 ? '...' : ''}"`;
    }

    if (selector.type === 'data-testid' || selector.type === 'data-cy') {
      const match = selector.value.match(/\[data-(?:testid|cy)="([^"]+)"\]/);
      return match ? match[1] : selector.value;
    }

    if (selector.type === 'aria') {
      const match = selector.value.match(/\[aria-label="([^"]+)"\]/);
      return match ? match[1] : selector.value;
    }

    if (selector.type === 'css' && selector.value.startsWith('#')) {
      return selector.value.substring(1);
    }

    return selector.value.split(' > ').pop() || selector.value;
  }
}
