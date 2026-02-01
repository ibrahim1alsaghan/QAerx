/**
 * Analyzes a web page to extract testable elements and generate test suggestions
 *
 * Fixed issues:
 * 1. CSS.escape() for special characters in selectors
 * 2. Proper standalone input detection
 * 3. Sibling label detection
 * 4. Dynamic confidence scoring
 * 5. Comprehensive error handling
 * 6. Visibility filtering
 * 7. Extended field type support
 * 8. Variable name collision handling
 */

export interface PageAnalysis {
  url: string;
  title: string;
  forms: FormAnalysis[];
  buttons: ButtonAnalysis[];
  links: LinkAnalysis[];
  inputs: InputAnalysis[];
  metadata: {
    hasLogin: boolean;
    hasSignup: boolean;
    hasSearch: boolean;
    hasCheckout: boolean;
    /** Page text direction: 'rtl' for Arabic/Hebrew, 'ltr' for English/etc */
    direction: 'rtl' | 'ltr';
    /** Detected language code (e.g., 'ar', 'en', 'he') */
    language?: string;
  };
}

export interface FormAnalysis {
  id?: string;
  name?: string;
  action?: string;
  method?: string;
  fields: InputAnalysis[];
}

export interface InputAnalysis {
  type: string;
  name?: string;
  id?: string;
  placeholder?: string;
  label?: string;
  required: boolean;
  selector: string;
  confidence: number; // Added: selector confidence score
}

export interface ButtonAnalysis {
  text: string;
  type?: string;
  id?: string;
  class?: string;
  selector: string;
  confidence: number; // Added: selector confidence score
}

export interface LinkAnalysis {
  text: string;
  href: string;
  selector: string;
  confidence: number; // Added: selector confidence score
}

// Track used variable names to avoid collisions
const usedVariableNames = new Set<string>();

/**
 * Check if an element is visible on the page
 */
function isElementVisible(element: HTMLElement): boolean {
  try {
    // Check if element exists and has dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }

    // Check computed styles
    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;

    // Check if element is off-screen
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      // Element is above or below viewport - still might be scrollable, so include it
    }

    // Check for hidden parent
    let parent = element.parentElement;
    while (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
        return false;
      }
      parent = parent.parentElement;
    }

    return true;
  } catch {
    // If we can't determine visibility, assume visible
    return true;
  }
}

/**
 * Check if an ID appears to be auto-generated/unstable
 * Comprehensive list of framework-specific dynamic ID patterns
 */
function isUnstableId(id: string): boolean {
  const unstablePatterns = [
    // UUID patterns
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    /^[a-f0-9]{32}$/i, // MD5 hash

    // React
    /^:r[0-9]+:?$/, // React 18 useId
    /^react-[a-z]+-\d+$/i,

    // Other frameworks
    /^ember\d+$/,
    /^ng[-_]\d+$/i,
    /^mui-\d+$/,
    /^headlessui-[a-z]+-\d+$/i,
    /^radix-[a-z]+-\d+$/i,
    /^downshift-\d+-/i,

    // Frappe framework (comprehensive)
    /^frappe[-_]ui[-_]\d+$/i,
    /^frappe[-_]\d+$/i,
    /^control[-_]\d+[-_]\d+$/i,
    /^awesomplete[-_]\d+$/i,
    /^input[-_]with[-_]feedback[-_]\d+$/i,

    // Select/dropdown libraries
    /^select2-[a-z]+-[a-z0-9]+$/i,
    /^react-select-\d+/i,
    /^choices-\d+$/i,

    // Generic dynamic patterns
    /^\d+$/,
    /^_[a-zA-Z0-9]+$/,
    /^[a-z]+[-_][a-f0-9]{6,}$/i,
    /^[a-z]+[-_][a-z]+[-_]\d+$/i,
    /^uid[-_]\d+$/i,
    /^id[-_]\d+$/i,
  ];

  return unstablePatterns.some(pattern => pattern.test(id));
}

/**
 * Generate a unique variable name, handling collisions
 */
export function generateVariableName(baseName: string): string {
  // Sanitize: only alphanumeric and underscores
  let sanitized = baseName
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();

  // Ensure it doesn't start with a number
  if (/^\d/.test(sanitized)) {
    sanitized = 'field_' + sanitized;
  }

  // Default if empty
  if (!sanitized) {
    sanitized = 'field';
  }

  // Handle collisions by appending numbers
  let finalName = sanitized;
  let counter = 1;
  while (usedVariableNames.has(finalName)) {
    finalName = `${sanitized}_${counter}`;
    counter++;
  }

  usedVariableNames.add(finalName);
  return finalName;
}

/**
 * Reset used variable names (call before each analysis)
 */
export function resetVariableNames(): void {
  usedVariableNames.clear();
}

/**
 * Analyze the current page and extract all testable elements
 */
export function analyzeCurrentPage(): PageAnalysis {
  // Reset variable name tracking for fresh analysis
  resetVariableNames();

  const analysis: PageAnalysis = {
    url: window.location.href,
    title: document.title,
    forms: [],
    buttons: [],
    links: [],
    inputs: [],
    metadata: {
      hasLogin: false,
      hasSignup: false,
      hasSearch: false,
      hasCheckout: false,
      direction: 'ltr',
    },
  };

  try {
    // Analyze forms
    const forms = document.querySelectorAll('form');
    forms.forEach((form, formIndex) => {
      try {
        const formAnalysis: FormAnalysis = {
          id: form.id || undefined,
          name: form.getAttribute('name') || undefined,
          action: form.action || undefined,
          method: form.method || undefined,
          fields: [],
        };

        // Extract form fields
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach((input, inputIndex) => {
          try {
            const htmlInput = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

            // Skip hidden fields
            if (htmlInput.type === 'hidden' || htmlInput.type === 'submit') {
              return;
            }

            // Skip invisible elements
            if (!isElementVisible(htmlInput)) {
              return;
            }

            const label = findLabelForInput(htmlInput);
            const { selector, confidence } = generateSelector(htmlInput, formIndex, inputIndex);

            const inputAnalysis: InputAnalysis = {
              type: htmlInput.type || 'text',
              name: htmlInput.name || undefined,
              id: htmlInput.id || undefined,
              placeholder: (htmlInput as HTMLInputElement).placeholder || undefined,
              label: label || undefined,
              required: (htmlInput as HTMLInputElement).required || false,
              selector,
              confidence,
            };

            formAnalysis.fields.push(inputAnalysis);
          } catch (e) {
            console.warn('[PageAnalyzer] Error processing form input:', e);
          }
        });

        analysis.forms.push(formAnalysis);
      } catch (e) {
        console.warn('[PageAnalyzer] Error processing form:', e);
      }
    });

    // Analyze standalone inputs (not in forms) - FIXED: proper filtering
    const allInputs = document.querySelectorAll('input, textarea, select');
    const standaloneInputs = Array.from(allInputs).filter(el => !el.closest('form'));

    standaloneInputs.forEach((input, index) => {
      try {
        const htmlInput = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

        // Skip hidden and submit types
        if (htmlInput.type === 'hidden' || htmlInput.type === 'submit') {
          return;
        }

        // Skip invisible elements
        if (!isElementVisible(htmlInput)) {
          return;
        }

        const label = findLabelForInput(htmlInput);
        const { selector, confidence } = generateSelector(htmlInput, -1, index);

        analysis.inputs.push({
          type: htmlInput.type || 'text',
          name: htmlInput.name || undefined,
          id: htmlInput.id || undefined,
          placeholder: (htmlInput as HTMLInputElement).placeholder || undefined,
          label: label || undefined,
          required: (htmlInput as HTMLInputElement).required || false,
          selector,
          confidence,
        });
      } catch (e) {
        console.warn('[PageAnalyzer] Error processing standalone input:', e);
      }
    });

    // Analyze buttons (skip hidden/invisible)
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
    buttons.forEach((button, index) => {
      try {
        const htmlButton = button as HTMLButtonElement | HTMLInputElement;

        // Skip invisible buttons
        if (!isElementVisible(htmlButton)) {
          return;
        }

        const text = htmlButton.textContent?.trim() || (htmlButton as HTMLInputElement).value || 'Button';
        const { selector, confidence } = generateSelector(htmlButton, -1, index);

        analysis.buttons.push({
          text: text.substring(0, 100), // Limit text length
          type: htmlButton.type || undefined,
          id: htmlButton.id || undefined,
          class: htmlButton.className || undefined,
          selector,
          confidence,
        });
      } catch (e) {
        console.warn('[PageAnalyzer] Error processing button:', e);
      }
    });

    // Analyze links (top 20 visible only)
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    const visibleLinks = allLinks.filter(link => isElementVisible(link as HTMLElement)).slice(0, 20);

    visibleLinks.forEach((link, index) => {
      try {
        const htmlLink = link as HTMLAnchorElement;
        const text = htmlLink.textContent?.trim() || 'Link';
        const { selector, confidence } = generateSelector(htmlLink, -1, index);

        if (htmlLink.href && !htmlLink.href.startsWith('javascript:')) {
          analysis.links.push({
            text: text.substring(0, 100), // Limit text length
            href: htmlLink.href,
            selector,
            confidence,
          });
        }
      } catch (e) {
        console.warn('[PageAnalyzer] Error processing link:', e);
      }
    });

    // Detect page patterns
    analysis.metadata = detectPagePatterns(analysis);
  } catch (e) {
    console.error('[PageAnalyzer] Critical error during page analysis:', e);
  }

  return analysis;
}

/**
 * Find label associated with an input element
 * Enhanced with sibling label detection
 */
function findLabelForInput(input: HTMLElement): string | null {
  try {
    // 1. Try explicit label with for attribute
    if (input.id) {
      const escapedId = CSS.escape(input.id);
      const label = document.querySelector(`label[for="${escapedId}"]`);
      if (label) {
        const text = label.textContent?.trim();
        if (text && text.length > 0) {
          return text;
        }
      }
    }

    // 2. Try parent label (input wrapped in label)
    const parentLabel = input.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      const childInputs = clone.querySelectorAll('input, textarea, select');
      childInputs.forEach(child => child.remove());
      const text = clone.textContent?.trim();
      if (text && text.length > 0) {
        return text;
      }
    }

    // 3. Try aria-label attribute
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim().length > 0) {
      return ariaLabel.trim();
    }

    // 4. Try aria-labelledby
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      if (labelElement) {
        const text = labelElement.textContent?.trim();
        if (text && text.length > 0) {
          return text;
        }
      }
    }

    // 5. Try preceding sibling label - NEW FIX
    const prevSibling = input.previousElementSibling;
    if (prevSibling && prevSibling.tagName === 'LABEL') {
      const text = prevSibling.textContent?.trim();
      if (text && text.length > 0 && text.length < 100) {
        return text.replace(/:$/, '');
      }
    }

    // 6. Try parent container with label child (common pattern)
    const parent = input.parentElement;
    if (parent) {
      const siblingLabel = parent.querySelector('label');
      if (siblingLabel && siblingLabel !== parentLabel) {
        const text = siblingLabel.textContent?.trim();
        if (text && text.length > 0 && text.length < 100) {
          return text.replace(/:$/, '');
        }
      }
    }

    // 7. Try preceding text node
    const prevText = input.previousSibling;
    if (prevText && prevText.nodeType === Node.TEXT_NODE) {
      const text = prevText.textContent?.trim();
      if (text && text.length > 2 && text.length < 50) {
        return text.replace(/:$/, '');
      }
    }

    // 8. Try title attribute
    const title = input.getAttribute('title');
    if (title && title.trim().length > 0) {
      return title.trim();
    }

    return null;
  } catch (e) {
    console.warn('[PageAnalyzer] Error finding label:', e);
    return null;
  }
}

/**
 * Generate a robust selector for an element with confidence score
 * FIXED: Uses CSS.escape() for all attribute values
 */
function generateSelector(element: HTMLElement, _formIndex: number, _elementIndex: number): { selector: string; confidence: number } {
  try {
    // 1. Try data-testid (highest priority, most stable)
    const testId = element.getAttribute('data-testid');
    if (testId) {
      return {
        selector: `[data-testid="${CSS.escape(testId)}"]`,
        confidence: 0.95,
      };
    }

    // 2. Try data-cy (Cypress convention)
    const dataCy = element.getAttribute('data-cy');
    if (dataCy) {
      return {
        selector: `[data-cy="${CSS.escape(dataCy)}"]`,
        confidence: 0.95,
      };
    }

    // 3. Try stable ID (not auto-generated)
    if (element.id && !isUnstableId(element.id)) {
      return {
        selector: `#${CSS.escape(element.id)}`,
        confidence: 0.90,
      };
    }

    // 4. Try name attribute (common for form fields)
    const name = element.getAttribute('name');
    if (name) {
      const tag = element.tagName.toLowerCase();
      return {
        selector: `${tag}[name="${CSS.escape(name)}"]`,
        confidence: 0.85,
      };
    }

    // 5. Try aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      const tag = element.tagName.toLowerCase();
      return {
        selector: `${tag}[aria-label="${CSS.escape(ariaLabel)}"]`,
        confidence: 0.80,
      };
    }

    // 6. Try type + placeholder for inputs
    if (element instanceof HTMLInputElement && element.placeholder) {
      return {
        selector: `input[type="${CSS.escape(element.type)}"][placeholder="${CSS.escape(element.placeholder)}"]`,
        confidence: 0.75,
      };
    }

    // 7. Try role attribute
    const role = element.getAttribute('role');
    if (role) {
      const tag = element.tagName.toLowerCase();
      // Add text content for specificity if it's a button-like element
      const text = element.textContent?.trim();
      if (text && text.length < 50 && (role === 'button' || role === 'link')) {
        return {
          selector: `${tag}[role="${CSS.escape(role)}"]:contains("${text.substring(0, 30)}")`,
          confidence: 0.65,
        };
      }
      return {
        selector: `${tag}[role="${CSS.escape(role)}"]`,
        confidence: 0.60,
      };
    }

    // 8. Try stable class (single class, not CSS-in-JS or Tailwind utility)
    const tag = element.tagName.toLowerCase();
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(/\s+/).filter(c => c.length > 0);
      const stableClass = classes.find(c => {
        // Skip CSS-in-JS classes
        if (/^(css|sc|emotion|styled)-[a-zA-Z0-9]+$/.test(c)) return false;
        if (/^[a-f0-9]{6,}$/.test(c)) return false;
        if (c.startsWith('_')) return false;
        // Skip Tailwind decimal utility classes (e.g., mb-1.5, space-y-0.5)
        // These contain dots which break CSS selectors
        if (/\.\d/.test(c)) return false;
        // Skip Tailwind utility classes (e.g., p-4, mt-2)
        if (/^-?[a-z]{1,2}-\d+(\.\d+)?$/.test(c)) return false;
        return true;
      });

      if (stableClass) {
        return {
          selector: `${tag}.${CSS.escape(stableClass)}`,
          confidence: 0.55,
        };
      }
    }

    // 9. Last resort: nth-of-type (least stable)
    const siblings = Array.from(element.parentElement?.children || []).filter(
      (child) => child.tagName === element.tagName
    );
    const index = siblings.indexOf(element) + 1;

    return {
      selector: `${tag}:nth-of-type(${index})`,
      confidence: 0.40,
    };
  } catch (e) {
    console.warn('[PageAnalyzer] Error generating selector:', e);
    // Emergency fallback
    const tag = element.tagName?.toLowerCase() || 'div';
    return {
      selector: tag,
      confidence: 0.20,
    };
  }
}

/**
 * Detect page direction (RTL for Arabic/Hebrew pages, LTR otherwise)
 */
function detectPageDirection(): { direction: 'rtl' | 'ltr'; language?: string } {
  try {
    const html = document.documentElement;

    // Check explicit dir attribute
    const dirAttr = html.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl') {
      return { direction: 'rtl', language: html.getAttribute('lang') || undefined };
    }

    // Check lang attribute for RTL languages
    const lang = html.getAttribute('lang')?.toLowerCase();
    const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'arc', 'syr'];
    if (lang) {
      const langCode = lang.split('-')[0]; // e.g., 'ar-SA' -> 'ar'
      if (rtlLanguages.includes(langCode)) {
        return { direction: 'rtl', language: langCode };
      }
    }

    // Check computed direction style
    const computedDir = window.getComputedStyle(document.body).direction;
    if (computedDir === 'rtl') {
      return { direction: 'rtl', language: lang?.split('-')[0] };
    }

    // Check document.dir property
    if (document.dir === 'rtl') {
      return { direction: 'rtl', language: lang?.split('-')[0] };
    }

    return { direction: 'ltr', language: lang?.split('-')[0] };
  } catch {
    return { direction: 'ltr' };
  }
}

/**
 * Detect common page patterns to suggest relevant tests
 */
function detectPagePatterns(analysis: PageAnalysis): PageAnalysis['metadata'] {
  // Detect page direction first
  const { direction, language } = detectPageDirection();

  const metadata = {
    hasLogin: false,
    hasSignup: false,
    hasSearch: false,
    hasCheckout: false,
    direction,
    language,
  };

  try {
    const allText = document.body.textContent?.toLowerCase() || '';
    const url = window.location.href.toLowerCase();

    // Detect login page
    const hasPasswordField = analysis.forms.some(form =>
      form.fields.some(field => field.type === 'password')
    );
    const hasEmailField = analysis.forms.some(form =>
      form.fields.some(field =>
        field.type === 'email' ||
        field.name?.toLowerCase().includes('email') ||
        field.id?.toLowerCase().includes('email')
      )
    );
    const hasLoginText = allText.includes('login') || allText.includes('sign in') || url.includes('login');
    metadata.hasLogin = hasPasswordField && (hasEmailField || hasLoginText);

    // Detect signup page
    const hasConfirmPassword = analysis.forms.some(form =>
      form.fields.some(field =>
        field.name?.toLowerCase().includes('confirm') ||
        field.id?.toLowerCase().includes('confirm')
      )
    );
    const hasSignupText = allText.includes('sign up') || allText.includes('register') || url.includes('signup') || url.includes('register');
    metadata.hasSignup = hasPasswordField && (hasConfirmPassword || hasSignupText);

    // Detect search - check both forms and standalone inputs
    const allFields = [
      ...analysis.forms.flatMap(f => f.fields),
      ...analysis.inputs,
    ];
    const hasSearchInput = allFields.some(input =>
      input.type === 'search' ||
      input.name?.toLowerCase().includes('search') ||
      input.placeholder?.toLowerCase().includes('search')
    );
    metadata.hasSearch = hasSearchInput || allText.includes('search');

    // Detect checkout/payment
    const hasCheckoutText = url.includes('checkout') || url.includes('cart') || allText.includes('checkout') || allText.includes('payment');
    const hasCardNumber = analysis.forms.some(form =>
      form.fields.some(field =>
        field.name?.toLowerCase().includes('card') ||
        field.placeholder?.toLowerCase().includes('card')
      )
    );
    metadata.hasCheckout = hasCheckoutText || hasCardNumber;
  } catch (e) {
    console.warn('[PageAnalyzer] Error detecting page patterns:', e);
  }

  return metadata;
}

/**
 * Simplified page context for AI consumption (reduced size)
 */
export function getSimplifiedPageContext(): string {
  try {
    const analysis = analyzeCurrentPage();

    let context = `URL: ${analysis.url}\nTitle: ${analysis.title}\n\n`;

    if (analysis.forms.length > 0) {
      context += `Forms (${analysis.forms.length}):\n`;
      analysis.forms.forEach((form, i) => {
        context += `  Form ${i + 1}${form.id ? ` (id="${form.id}")` : ''}:\n`;
        form.fields.forEach(field => {
          const label = field.label || field.placeholder || field.name || 'field';
          const conf = Math.round(field.confidence * 100);
          context += `    - ${field.type}: ${label} [${field.selector}] (${conf}% confidence)${field.required ? ' *required' : ''}\n`;
        });
      });
    }

    if (analysis.inputs.length > 0) {
      context += `\nStandalone Inputs (${analysis.inputs.length}):\n`;
      analysis.inputs.forEach(input => {
        const label = input.label || input.placeholder || input.name || 'input';
        const conf = Math.round(input.confidence * 100);
        context += `  - ${input.type}: ${label} [${input.selector}] (${conf}% confidence)${input.required ? ' *required' : ''}\n`;
      });
    }

    if (analysis.buttons.length > 0) {
      context += `\nButtons (${Math.min(analysis.buttons.length, 10)}):\n`;
      analysis.buttons.slice(0, 10).forEach(btn => {
        const conf = Math.round(btn.confidence * 100);
        context += `  - "${btn.text}" [${btn.selector}] (${conf}% confidence)\n`;
      });
    }

    if (analysis.links.length > 0) {
      context += `\nLinks (${Math.min(analysis.links.length, 10)}):\n`;
      analysis.links.slice(0, 10).forEach(link => {
        context += `  - "${link.text}" -> ${link.href}\n`;
      });
    }

    if (analysis.metadata.hasLogin) context += `\nDetected: Login page\n`;
    if (analysis.metadata.hasSignup) context += `Detected: Signup page\n`;
    if (analysis.metadata.hasSearch) context += `Detected: Search functionality\n`;
    if (analysis.metadata.hasCheckout) context += `Detected: Checkout/Payment page\n`;

    // Add direction info
    context += `\nPage Direction: ${analysis.metadata.direction.toUpperCase()}`;
    if (analysis.metadata.language) {
      context += ` (${analysis.metadata.language})`;
    }
    context += '\n';

    return context;
  } catch (e) {
    console.error('[PageAnalyzer] Error generating page context:', e);
    return `URL: ${window.location.href}\nTitle: ${document.title}\n\nError analyzing page.`;
  }
}
