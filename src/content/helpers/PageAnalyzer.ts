/**
 * Analyzes a web page to extract testable elements and generate test suggestions
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
}

export interface ButtonAnalysis {
  text: string;
  type?: string;
  id?: string;
  class?: string;
  selector: string;
}

export interface LinkAnalysis {
  text: string;
  href: string;
  selector: string;
}

/**
 * Analyze the current page and extract all testable elements
 */
export function analyzeCurrentPage(): PageAnalysis {
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
    },
  };

  // Analyze forms
  const forms = document.querySelectorAll('form');
  forms.forEach((form, formIndex) => {
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
      const htmlInput = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

      // Skip hidden and submit buttons in field list
      if (htmlInput.type === 'hidden' || htmlInput.type === 'submit') {
        return;
      }

      const label = findLabelForInput(htmlInput);
      const selector = generateSelector(htmlInput, formIndex, inputIndex);

      const inputAnalysis: InputAnalysis = {
        type: htmlInput.type || 'text',
        name: htmlInput.name || undefined,
        id: htmlInput.id || undefined,
        placeholder: (htmlInput as HTMLInputElement).placeholder || undefined,
        label: label || undefined,
        required: (htmlInput as HTMLInputElement).required || false,
        selector,
      };

      formAnalysis.fields.push(inputAnalysis);
    });

    analysis.forms.push(formAnalysis);
  });

  // Analyze standalone inputs (not in forms)
  const standaloneInputs = document.querySelectorAll('input:not(form input), textarea:not(form textarea), select:not(form select)');
  standaloneInputs.forEach((input, index) => {
    const htmlInput = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

    if (htmlInput.type === 'hidden') return;

    const label = findLabelForInput(htmlInput);
    const selector = generateSelector(htmlInput, -1, index);

    analysis.inputs.push({
      type: htmlInput.type || 'text',
      name: htmlInput.name || undefined,
      id: htmlInput.id || undefined,
      placeholder: (htmlInput as HTMLInputElement).placeholder || undefined,
      label: label || undefined,
      required: (htmlInput as HTMLInputElement).required || false,
      selector,
    });
  });

  // Analyze buttons
  const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
  buttons.forEach((button, index) => {
    const htmlButton = button as HTMLButtonElement | HTMLInputElement;
    const text = htmlButton.textContent?.trim() || htmlButton.value || 'Button';
    const selector = generateSelector(htmlButton, -1, index);

    analysis.buttons.push({
      text,
      type: htmlButton.type || undefined,
      id: htmlButton.id || undefined,
      class: htmlButton.className || undefined,
      selector,
    });
  });

  // Analyze links (top 20 only to avoid clutter)
  const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 20);
  links.forEach((link, index) => {
    const htmlLink = link as HTMLAnchorElement;
    const text = htmlLink.textContent?.trim() || 'Link';
    const selector = generateSelector(htmlLink, -1, index);

    if (htmlLink.href && !htmlLink.href.startsWith('javascript:')) {
      analysis.links.push({
        text,
        href: htmlLink.href,
        selector,
      });
    }
  });

  // Detect page patterns
  analysis.metadata = detectPagePatterns(analysis);

  return analysis;
}

/**
 * Find label associated with an input element
 */
function findLabelForInput(input: HTMLElement): string | null {
  // Try explicit label with for attribute
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) {
      return label.textContent?.trim() || null;
    }
  }

  // Try parent label
  const parentLabel = input.closest('label');
  if (parentLabel) {
    // Get label text excluding input text
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const childInputs = clone.querySelectorAll('input, textarea, select');
    childInputs.forEach(child => child.remove());
    return clone.textContent?.trim() || null;
  }

  // Try aria-label
  const ariaLabel = input.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel;
  }

  // Try preceding text
  const prevText = input.previousSibling;
  if (prevText && prevText.nodeType === Node.TEXT_NODE) {
    const text = prevText.textContent?.trim();
    if (text && text.length < 50) {
      return text.replace(/:$/, '');
    }
  }

  return null;
}

/**
 * Generate a robust selector for an element
 */
function generateSelector(element: HTMLElement, _formIndex: number, _elementIndex: number): string {
  // Try ID first
  if (element.id) {
    return `#${element.id}`;
  }

  // Try name attribute
  if (element.getAttribute('name')) {
    const name = element.getAttribute('name');
    return `[name="${name}"]`;
  }

  // Try data-testid
  if (element.getAttribute('data-testid')) {
    return `[data-testid="${element.getAttribute('data-testid')}"]`;
  }

  // Try type + placeholder for inputs
  if (element instanceof HTMLInputElement && element.placeholder) {
    return `input[type="${element.type}"][placeholder="${element.placeholder}"]`;
  }

  // Fallback: tag with class or nth-of-type
  const tag = element.tagName.toLowerCase();
  if (element.className && !element.className.includes(' ')) {
    return `${tag}.${element.className}`;
  }

  // Last resort: nth-of-type
  const siblings = Array.from(element.parentElement?.children || []).filter(
    (child) => child.tagName === element.tagName
  );
  const index = siblings.indexOf(element) + 1;
  return `${tag}:nth-of-type(${index})`;
}

/**
 * Detect common page patterns to suggest relevant tests
 */
function detectPagePatterns(analysis: PageAnalysis): PageAnalysis['metadata'] {
  const metadata = {
    hasLogin: false,
    hasSignup: false,
    hasSearch: false,
    hasCheckout: false,
  };

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

  // Detect search
  const hasSearchInput = analysis.inputs.some(input =>
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

  return metadata;
}

/**
 * Simplified page context for AI consumption (reduced size)
 */
export function getSimplifiedPageContext(): string {
  const analysis = analyzeCurrentPage();

  let context = `URL: ${analysis.url}\nTitle: ${analysis.title}\n\n`;

  if (analysis.forms.length > 0) {
    context += `Forms (${analysis.forms.length}):\n`;
    analysis.forms.forEach((form, i) => {
      context += `  Form ${i + 1}${form.id ? ` (id="${form.id}")` : ''}:\n`;
      form.fields.forEach(field => {
        const label = field.label || field.placeholder || field.name || 'field';
        context += `    - ${field.type}: ${label} [${field.selector}]${field.required ? ' *required' : ''}\n`;
      });
    });
  }

  if (analysis.buttons.length > 0) {
    context += `\nButtons (${Math.min(analysis.buttons.length, 10)}):\n`;
    analysis.buttons.slice(0, 10).forEach(btn => {
      context += `  - "${btn.text}" [${btn.selector}]\n`;
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

  return context;
}
