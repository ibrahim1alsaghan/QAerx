import OpenAI from 'openai';
import type { UIStep, SelectorStrategy } from '@/types/test';
import type { SelectorHealingSuggestion } from '@/types/result';
import { SettingsRepository } from '../storage/repositories/SettingsRepository';

interface DOMContext {
  html: string;
  forms: FormInfo[];
  interactiveElements: ElementInfo[];
  metadata: {
    title: string;
    url: string;
  };
}

interface FormInfo {
  id?: string;
  name?: string;
  action?: string;
  fields: Array<{
    type: string;
    name?: string;
    id?: string;
    placeholder?: string;
    label?: string;
  }>;
}

interface ElementInfo {
  tag: string;
  type?: string;
  text?: string;
  id?: string;
  class?: string;
}

interface PageContext {
  url: string;
  title: string;
  forms: FormInfo[];
  buttons: Array<{ text: string; id?: string; class?: string }>;
  links: Array<{ text: string; href: string }>;
  currentFormState: Record<string, string>;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

export class AIService {
  private client: OpenAI | null = null;
  private rateLimitDelay = 0;
  private lastRequestTime = 0;
  private minInterval = 1000; // 1 request per second
  private cache: Map<string, CacheEntry> = new Map();
  private cacheMaxAge = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize OpenAI client with API key from settings
   */
  async initialize(): Promise<boolean> {
    try {
      const settings = await SettingsRepository.get();

      if (!settings?.openaiApiKey) {
        throw new Error('OpenAI API key not configured. Please add it in Settings.');
      }

      this.client = new OpenAI({
        apiKey: settings.openaiApiKey,
        dangerouslyAllowBrowser: true, // Required for Chrome extension
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize AIService:', error);
      throw error;
    }
  }

  /**
   * Generate realistic test data based on test steps and variable names
   * @param steps - The test steps to analyze
   * @param count - Number of data sets to generate
   * @param options - Generation options including direction for localization
   */
  async generateTestData(
    steps: UIStep[],
    count: number = 3,
    options: { direction?: 'rtl' | 'ltr'; language?: string } = {}
  ): Promise<Record<string, string>[]> {
    if (!this.client) {
      throw new Error('AIService not initialized');
    }

    // Extract variable names from steps
    let variables = this.extractVariablesFromSteps(steps);

    // If no variables found, try to infer from selectors and step names
    if (variables.length === 0) {
      variables = this.inferFieldsFromSteps(steps);

      if (variables.length === 0) {
        throw new Error(
          'Could not find variables in test steps.\n\n' +
          'Tips:\n' +
          '1. Use {{variableName}} in step text (e.g., "Type {{email}}")\n' +
          '2. Or add Type steps with selectors like #email, #password, etc.'
        );
      }
    }

    // Create context from steps
    const stepDescriptions = steps
      .map((s, i) => {
        const selectors = s.selectors?.map(sel => sel.value).join(' or ') || 'no selector';
        return `${i + 1}. ${s.name}: ${this.describeAction(s)} [selector: ${selectors}]`;
      })
      .join('\n');

    // Determine localization requirements based on direction
    const isRTL = options.direction === 'rtl';
    const localeHint = isRTL
      ? `

LOCALIZATION (Arabic/RTL page detected):
- For names: Use Arabic names (أحمد، محمد، سارة، فاطمة، خالد، نورة, etc.)
- For phone numbers: Use Saudi format +966 5XX XXX XXXX
- For addresses/cities: Use Arabic text (الرياض، جدة، الدمام, etc.)
- For generic text fields: Use Arabic text
- KEEP IN ENGLISH: email addresses, usernames, passwords, URLs, technical IDs
- Example: firstName: "محمد", lastName: "الأحمد", email: "mohammed@example.com", phone: "+966512345678"`
      : '';

    const systemMessage = `You are a test data generator for automated testing. Generate realistic, diverse test data based on variable names and test context. Consider field types, validation rules, and real-world user scenarios.${isRTL ? ' You must generate Arabic/localized data for RTL pages as specified.' : ''}`;

    const userMessage = `Generate ${count} unique test data sets for these variables:

Variables needed: ${variables.join(', ')}

Test context:
${stepDescriptions}

Requirements:
- Return ONLY a JSON array of objects
- Each object must have exactly these keys: ${variables.join(', ')}
- Make data realistic and diverse (different email domains, name variations, valid formats)
- For emails: use real-looking domains (gmail.com, company.com, etc.)
- For passwords: include mix of letters, numbers, special chars
- For names: use diverse, realistic names
- For numbers: use appropriate formats (phone, zip, etc.)${localeHint}

Example format:
[{"variable1": "value1", "variable2": "value2"}]`;

    try {
      const response = await this.makeRequest(async () => {
        return await this.client!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.8, // Higher temperature for diversity
          response_format: { type: 'json_object' },
        });
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      // Parse response with robust handling
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error('[AIService] Failed to parse JSON:', content);
        throw new Error('AI returned invalid JSON. Please try again.');
      }

      // Handle various response formats from OpenAI
      let dataArray: any[] = [];

      if (Array.isArray(parsed)) {
        // Direct array: [{...}, {...}]
        dataArray = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        // Object with array property: { data: [...] } or { dataSets: [...] }
        // Try common property names
        const arrayKeys = ['data', 'dataSets', 'datasets', 'results', 'items', 'testData'];
        for (const key of arrayKeys) {
          if (Array.isArray(parsed[key])) {
            dataArray = parsed[key];
            break;
          }
        }

        // If still empty, try to find any array property
        if (dataArray.length === 0) {
          for (const value of Object.values(parsed)) {
            if (Array.isArray(value) && value.length > 0) {
              dataArray = value as any[];
              break;
            }
          }
        }
      }

      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        console.error('[AIService] Invalid response format:', parsed);
        throw new Error('AI returned invalid data format. Expected an array of data sets.');
      }

      // Validate that all variables are present in each data set
      dataArray.forEach((row, index) => {
        variables.forEach((variable) => {
          if (!(variable in row)) {
            throw new Error(`Missing variable "${variable}" in data set ${index + 1}`);
          }
        });
      });

      return dataArray.slice(0, count);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Generate test data with scenarios (best case, worst case, edge cases)
   *
   * Default is 3 scenarios (Standard):
   * - 1 Best Case (happy path)
   * - 1 Worst Case (invalid/security)
   * - 1 Edge Case (boundaries)
   *
   * Options allow for more comprehensive testing:
   * - Quick (1): Just best case
   * - Standard (3): Best + Worst + Edge
   * - Comprehensive (5): Multiple of each type
   */
  async generateScenarioTestData(
    steps: UIStep[],
    options: { bestCase?: number; worstCase?: number; edgeCase?: number; boundary?: number; direction?: 'rtl' | 'ltr'; language?: string } = {}
  ): Promise<{ dataSets: Record<string, string>[]; scenarios: ('best-case' | 'worst-case' | 'edge-case' | 'boundary')[] }> {
    if (!this.client) {
      throw new Error('AIService not initialized');
    }

    // Default to 3 scenarios (Standard): 1 best, 1 worst, 1 edge
    const { bestCase = 1, worstCase = 1, edgeCase = 1, boundary = 0, direction, language: _language } = options;
    const totalCount = bestCase + worstCase + edgeCase + boundary;
    const isRTL = direction === 'rtl';

    // Extract variable names from steps
    let variables = this.extractVariablesFromSteps(steps);
    if (variables.length === 0) {
      variables = this.inferFieldsFromSteps(steps);
      if (variables.length === 0) {
        throw new Error('Could not find variables in test steps. Use {{variableName}} syntax.');
      }
    }

    const stepDescriptions = steps
      .map((s, i) => {
        const selectors = s.selectors?.map(sel => sel.value).join(' or ') || 'no selector';
        return `${i + 1}. ${s.name}: ${this.describeAction(s)} [selector: ${selectors}]`;
      })
      .join('\n');

    const systemMessage = `You are a QA test data expert. Generate comprehensive test data covering different scenarios to ensure thorough testing coverage.${isRTL ? ' Generate Arabic/localized data for RTL pages as specified.' : ''}`;

    // Localization hint for RTL pages
    const localeHint = isRTL
      ? `

LOCALIZATION (Arabic/RTL page detected):
- For names: Use Arabic names (أحمد، محمد، سارة، فاطمة، خالد، نورة)
- For phone numbers: Use Saudi format +966 5XX XXX XXXX
- For addresses/cities: Use Arabic text (الرياض، جدة، الدمام)
- For generic text fields: Use Arabic text
- KEEP IN ENGLISH: email addresses, usernames, passwords, URLs
`
      : '';

    const userMessage = `Generate test data sets for these variables: ${variables.join(', ')}${localeHint}

Test context:
${stepDescriptions}

Generate the following scenarios:
1. BEST CASE (${bestCase} sets): Valid, correctly formatted data that should pass all validations
   - Real email formats (user@domain.com)
   - Strong passwords meeting requirements
   - Properly formatted names, phones, etc.

2. WORST CASE (${worstCase} sets): Invalid data that should fail validation
   - Invalid email formats (missing @, invalid domains)
   - Weak/invalid passwords
   - Empty required fields
   - Special characters that might break input
   - SQL injection attempts (for security testing)
   - XSS attempts (for security testing)

3. EDGE CASE (${edgeCase} sets): Unusual but potentially valid data
   - Very long strings (near max length)
   - Unicode characters, emojis
   - Leading/trailing spaces
   - Multiple consecutive spaces

4. BOUNDARY (${boundary} sets): Data at validation boundaries
   - Minimum length values
   - Maximum length values
   - Just under/over limits

Return ONLY valid JSON in this exact format:
{
  "dataSets": [
    {"scenario": "best-case", ${variables.map(v => `"${v}": "value"`).join(', ')}},
    {"scenario": "worst-case", ${variables.map(v => `"${v}": "value"`).join(', ')}},
    ...
  ]
}`;

    try {
      const response = await this.makeRequest(async () => {
        return await this.client!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.8,
          response_format: { type: 'json_object' },
        });
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      // Parse response with robust handling
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error('[AIService] Failed to parse scenario JSON:', content);
        throw new Error('AI returned invalid JSON for scenarios. Please try again.');
      }

      // Extract data array from various response formats
      let rawDataSets: any[] = [];

      if (Array.isArray(parsed)) {
        rawDataSets = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        // Try common property names
        const arrayKeys = ['dataSets', 'datasets', 'data', 'results', 'scenarios'];
        for (const key of arrayKeys) {
          if (Array.isArray(parsed[key])) {
            rawDataSets = parsed[key];
            break;
          }
        }

        // If still empty, find any array property
        if (rawDataSets.length === 0) {
          for (const value of Object.values(parsed)) {
            if (Array.isArray(value) && value.length > 0) {
              rawDataSets = value as any[];
              break;
            }
          }
        }
      }

      if (!Array.isArray(rawDataSets) || rawDataSets.length === 0) {
        console.error('[AIService] Invalid scenario response format:', parsed);
        throw new Error('AI returned invalid data format for scenarios.');
      }

      // Separate data and scenarios
      const dataSets: Record<string, string>[] = [];
      const scenarios: ('best-case' | 'worst-case' | 'edge-case' | 'boundary')[] = [];

      rawDataSets.forEach((row: any) => {
        const scenario = row.scenario as 'best-case' | 'worst-case' | 'edge-case' | 'boundary';
        scenarios.push(scenario || 'normal');

        // Create clean data set without scenario field
        const cleanData: Record<string, string> = {};
        variables.forEach(v => {
          cleanData[v] = row[v] || '';
        });
        dataSets.push(cleanData);
      });

      return { dataSets: dataSets.slice(0, totalCount), scenarios: scenarios.slice(0, totalCount) };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Get page type hint from page context for better AI suggestions
   */
  private getPageTypeHint(pageContext: string): string {
    if (pageContext.includes('Detected: Login')) return 'This is a LOGIN page. Focus only on login flow.';
    if (pageContext.includes('Detected: Signup')) return 'This is a SIGNUP/REGISTRATION page. Focus only on signup flow.';
    if (pageContext.includes('Detected: Search')) return 'This page has SEARCH functionality. Focus on search flow.';
    if (pageContext.includes('Detected: Checkout')) return 'This is a CHECKOUT/PAYMENT page. Focus on checkout flow.';
    return 'Analyze the form fields to determine the primary purpose of this page.';
  }

  /**
   * Analyze current page and suggest test cases - focused on main flow only
   */
  async analyzePageAndSuggestTests(pageContext: string): Promise<UIStep[]> {
    if (!this.client) {
      throw new Error('AIService not initialized');
    }

    const pageTypeHint = this.getPageTypeHint(pageContext);

    const systemMessage = `You are a focused QA expert. Your job is to identify a page's PRIMARY purpose and suggest ONLY the essential test steps for that main user flow. Never suggest unnecessary or tangential tests. Keep it simple and focused.`;

    const userMessage = `Analyze this page and generate a focused test for its MAIN purpose only:

${pageTypeHint}

Page Context:
${pageContext}

STRICT Rules:
1. Identify the page's PRIMARY purpose (login, signup, search, checkout, or form entry)
2. Generate ONLY 3-5 steps that test this main flow
3. Steps should follow: fill required fields → submit action
4. Do NOT suggest steps for navigation links, secondary buttons, footer links, or unrelated features
5. Do NOT suggest "wait" or "verify" steps unless absolutely necessary
6. Use ONLY the selectors provided in the page context above
7. Return ONLY valid JSON

Format:
{"pageType": "login|signup|search|checkout|form", "steps": [{"name": "Step name", "type": "click|type|select", "selector": "exact CSS selector from context", "text": "text to type (only for type action)"}]}`;

    try {
      const response = await this.makeRequest(async () => {
        return await this.client!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.5, // Lower temperature for more focused output
          response_format: { type: 'json_object' },
        });
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      const parsed = JSON.parse(content);
      const suggestions = parsed.steps || [];

      if (!Array.isArray(suggestions)) {
        throw new Error('AI returned invalid format');
      }

      // Filter out steps without valid selectors or with invalid action types
      const validSuggestions = suggestions.filter((s: any) =>
        s.selector &&
        s.selector.length > 0 &&
        s.type &&
        ['click', 'type', 'select', 'check', 'uncheck'].includes(s.type)
      );

      // Limit to 5 steps maximum
      const limitedSuggestions = validSuggestions.slice(0, 5);

      // Convert AI suggestions to UIStep objects
      const steps: UIStep[] = limitedSuggestions.map((suggestion: any, index: number) => {
        const step: UIStep = {
          id: crypto.randomUUID(),
          type: 'ui',
          order: index,
          name: suggestion.name || 'AI Suggested Step',
          description: suggestion.description,
          enabled: true,
          continueOnFailure: false,
          action: this.createActionFromSuggestion(suggestion),
          selectors: suggestion.selector
            ? [
                {
                  type: 'css',
                  value: suggestion.selector,
                  priority: 0,
                  confidence: 0.75,
                },
              ]
            : [],
        };
        return step;
      });

      return steps;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Enhance collected steps with AI - improve variable names based on field semantics
   */
  async enhanceCollectedSteps(
    steps: UIStep[],
    pageMetadata: { hasLogin: boolean; hasSignup: boolean; hasSearch: boolean; hasCheckout: boolean }
  ): Promise<UIStep[]> {
    if (!this.client) {
      // Return steps unchanged if AI not available
      return steps;
    }

    // Extract current variable names from steps
    const variableMap = new Map<string, { stepIndex: number; fieldType: string; stepName: string }>();

    steps.forEach((step, index) => {
      if (step.action.type === 'type' || step.action.type === 'select') {
        const action = step.action as { text?: string; value?: string };
        const text = action.text || action.value || '';
        const match = text.match(/\{\{(\w+)\}\}/);
        if (match) {
          variableMap.set(match[1], {
            stepIndex: index,
            fieldType: step.action.type,
            stepName: step.name,
          });
        }
      }
    });

    // If no variables to enhance, return as-is
    if (variableMap.size === 0) {
      return steps;
    }

    // Determine page type
    let pageType = 'form';
    if (pageMetadata.hasLogin) pageType = 'login';
    else if (pageMetadata.hasSignup) pageType = 'signup';
    else if (pageMetadata.hasSearch) pageType = 'search';
    else if (pageMetadata.hasCheckout) pageType = 'checkout';

    // Build step summary for AI
    const stepSummary = Array.from(variableMap.entries())
      .map(([varName, info]) => `- ${info.stepName} (${info.fieldType}): {{${varName}}}`)
      .join('\n');

    const currentVars = Array.from(variableMap.keys()).map(v => `{{${v}}}`).join(', ');

    const systemMessage = `You are a QA expert. Improve variable names in test steps to be semantic and descriptive.`;

    const userMessage = `These test steps were collected from a ${pageType} page:
${stepSummary}

Current variables: ${currentVars}

Suggest better variable names that describe what data each field needs.
Rules:
- Use camelCase (e.g., firstName, emailAddress)
- Be descriptive based on the step name (e.g., "Enter Email" → email, "Enter Password" → password)
- Keep names short (max 20 chars)
- For login pages: prefer email, password, username
- For signup pages: prefer firstName, lastName, email, password, confirmPassword
- Return ONLY valid JSON

Format: {"variables": {"currentVarName": "newVarName", ...}}`;

    try {
      const response = await this.makeRequest(async () => {
        return await this.client!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3, // Very low for consistent naming
          response_format: { type: 'json_object' },
        });
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return steps; // Return unchanged if no response
      }

      const parsed = JSON.parse(content);
      const newVariables = parsed.variables || {};

      // Apply variable name changes to steps
      const enhancedSteps = steps.map((step) => {
        const newStep = { ...step };

        // Update action text/value with new variable names
        if (step.action.type === 'type') {
          const action = step.action as { type: 'type'; text: string };
          let newText = action.text;
          for (const [oldVar, newVar] of Object.entries(newVariables)) {
            newText = newText.replace(`{{${oldVar}}}`, `{{${newVar}}}`);
          }
          newStep.action = { ...action, text: newText };

          // Also update step name if it contains the old variable
          for (const [oldVar, newVar] of Object.entries(newVariables)) {
            if (step.name.toLowerCase().includes(oldVar.toLowerCase())) {
              newStep.name = step.name.replace(new RegExp(oldVar, 'gi'), String(newVar));
            }
          }
        } else if (step.action.type === 'select') {
          const action = step.action as { type: 'select'; value: string };
          let newValue = action.value;
          for (const [oldVar, newVar] of Object.entries(newVariables)) {
            newValue = newValue.replace(`{{${oldVar}}}`, `{{${newVar}}}`);
          }
          newStep.action = { ...action, value: newValue };
        }

        return newStep as UIStep;
      });

      return enhancedSteps;
    } catch (error) {
      // On error, return steps unchanged
      console.warn('AI enhancement failed, returning original steps:', error);
      return steps;
    }
  }

  /**
   * Suggest alternative selectors when current selector fails or matches multiple elements
   */
  async suggestSelectors(
    domContext: DOMContext,
    failedSelector: string,
    issue: 'not-found' | 'multiple' = 'not-found'
  ): Promise<SelectorStrategy[]> {
    if (!this.client) {
      throw new Error('AIService not initialized');
    }

    const cacheKey = `selectors:${this.hashString(failedSelector + domContext.html + issue)}`;
    const cached = this.getFromCache<SelectorStrategy[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const issueDescription = issue === 'not-found'
      ? '0 elements found - selector does not match any element'
      : 'Multiple elements found - selector is not unique';

    const systemMessage = `You are a CSS selector expert. Analyze DOM context and suggest robust, maintainable selectors. Prefer data-testid, ARIA labels, semantic HTML, and stable IDs over brittle class names or complex XPath.`;

    const userMessage = `Current selector: ${failedSelector}
Issue: ${issueDescription}

Page: ${domContext.metadata.title} (${domContext.metadata.url})

Simplified DOM:
${this.optimizeDOMSnapshot(domContext.html)}

Suggest 3-5 alternative selectors ordered by robustness.

Requirements:
- Return ONLY valid JSON
- Prefer: data-testid > ARIA > semantic HTML > stable IDs > classes
- Avoid: auto-generated IDs, CSS framework classes (Tailwind, MUI), nth-child when possible
- Each suggestion needs: type, value, confidence (0-1), explanation

Format:
{"suggestions": [{"type": "css", "value": "[data-testid='btn']", "confidence": 0.95, "explanation": "Uses stable test ID"}]}`;

    try {
      const response = await this.makeRequest(async () => {
        return await this.client!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3, // Lower temperature for consistency
          response_format: { type: 'json_object' },
        });
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      const parsed = JSON.parse(content);
      const suggestions = parsed.suggestions || [];

      if (!Array.isArray(suggestions)) {
        throw new Error('AI returned invalid suggestions format');
      }

      const strategies: SelectorStrategy[] = suggestions.map((s: any, index: number) => ({
        type: s.type || 'css',
        value: s.value,
        priority: index,
        confidence: s.confidence || 0.5,
        explanation: s.explanation,
      }));

      this.setInCache(cacheKey, strategies);
      return strategies;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Suggest next logical test step based on current steps and page context
   */
  async suggestNextStep(
    currentSteps: UIStep[],
    pageContext: PageContext
  ): Promise<UIStep | null> {
    if (!this.client) {
      throw new Error('AIService not initialized');
    }

    const stepDescriptions = currentSteps
      .map((s, i) => `${i + 1}. ${s.name}`)
      .join('\n');

    const systemMessage = `You are a QA automation expert. Analyze test context and page state to suggest logical next test steps. Consider common user flows, form validation, and typical test scenarios.`;

    const userMessage = `Current test steps:
${stepDescriptions}

Current page:
- URL: ${pageContext.url}
- Title: ${pageContext.title}
- Forms: ${pageContext.forms.length} form(s) ${pageContext.forms.map(f => `with ${f.fields.length} fields`).join(', ')}
- Buttons: ${pageContext.buttons.map(b => b.text).join(', ')}
- Links: ${pageContext.links.slice(0, 5).map(l => l.text).join(', ')}
- Filled fields: ${Object.keys(pageContext.currentFormState).join(', ') || 'none'}

Suggest the most logical next test step.

Requirements:
- Return ONLY valid JSON
- Consider common flows (login, form fill, navigation, assertions)
- Include: type, name, selector, reasoning
- Type must be one of: click, type, navigate, waitTime, waitForElement

Format:
{"step": {"type": "click", "name": "Click submit button", "selector": "button[type='submit']", "reasoning": "Form filled, next is submission"}}`;

    try {
      const response = await this.makeRequest(async () => {
        return await this.client!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' },
        });
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      const suggestion = parsed.step;

      if (!suggestion || !suggestion.type || !suggestion.selector) {
        return null;
      }

      // Create UIStep from suggestion
      const step: UIStep = {
        id: crypto.randomUUID(),
        type: 'ui',
        order: currentSteps.length,
        name: suggestion.name || 'AI Suggested Step',
        enabled: true,
        continueOnFailure: false,
        action: this.createAction(suggestion.type, suggestion),
        selectors: [
          {
            type: 'css',
            value: suggestion.selector,
            priority: 0,
            confidence: 0.8,
          },
        ],
      };

      return step;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Heal broken selector by analyzing DOM and suggesting alternatives
   */
  async healSelector(
    originalSelector: string,
    domSnapshot: string,
    error: string,
    stepName?: string
  ): Promise<SelectorHealingSuggestion> {
    if (!this.client) {
      throw new Error('AIService not initialized');
    }

    const systemMessage = `You are a selector repair expert. A test selector failed to find an element. Analyze the DOM to find the element the user likely intended and suggest updated selectors.`;

    const userMessage = `Failed selector: ${originalSelector}
Error: ${error}
Step context: ${stepName || 'Unknown step'}

Current DOM snapshot:
${this.optimizeDOMSnapshot(domSnapshot)}

Find the most likely target element and suggest 3-5 alternative selectors.
Consider: renamed classes, moved elements, similar elements nearby, updated IDs.

Requirements:
- Return ONLY valid JSON
- Include confidence (0-1) for overall healing success
- Include explanation of what changed
- Suggest robust selectors

Format:
{"suggestedSelectors": [{"type": "css", "value": ".new-class", "confidence": 0.9}], "confidence": 0.88, "explanation": "Button class changed from .old to .new"}`;

    try {
      const response = await this.makeRequest(async () => {
        return await this.client!.chat.completions.create({
          model: 'gpt-4o', // Use more powerful model for complex healing
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      const parsed = JSON.parse(content);

      const suggestions: SelectorStrategy[] = (parsed.suggestedSelectors || []).map(
        (s: any, index: number) => ({
          type: s.type || 'css',
          value: s.value,
          priority: index,
          confidence: s.confidence || 0.5,
        })
      );

      return {
        originalSelector: {
          type: 'css',
          value: originalSelector,
          priority: 0,
          confidence: 0,
        },
        suggestedSelectors: suggestions,
        confidence: parsed.confidence || 0.5,
        aiExplanation: parsed.explanation,
      };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Validate step result using AI interpretation
   * Called by AIValidationService for intelligent pass/fail determination
   */
  async validateStepResult(context: {
    stepName: string;
    actionType: string;
    actionDescription: string;
    pageResponse: string | undefined;
    urlChange: string;
    variables: Record<string, string>;
  }): Promise<{
    errorDetected: boolean;
    errorMessage: string | null;
    successMessage: string | null;
    confidence: number;
  }> {
    if (!this.client) {
      throw new Error('AIService not initialized');
    }

    const systemMessage = `You are a QA test validator. Analyze test step execution results to determine success or failure.

Your job is to:
1. Detect if there was an error message on the page
2. Identify success indicators (redirects, success messages, confirmations)
3. Provide confidence level (0-1) in your assessment

Be especially careful to detect:
- Login/authentication failures ("Invalid credentials", "Wrong password", etc.)
- Form validation errors ("Required field", "Invalid email", etc.)
- Permission/access errors ("Unauthorized", "Forbidden", etc.)
- Server errors ("Error", "Failed", "500", etc.)`;

    const userMessage = `Analyze this test step execution:

STEP: "${context.stepName}"
ACTION TYPE: ${context.actionType}
ACTION DETAILS: ${context.actionDescription}

PAGE RESPONSE CAPTURED: "${context.pageResponse || 'No message captured on page'}"

URL CHANGE: ${context.urlChange}

DATA USED IN THIS STEP:
${JSON.stringify(context.variables, null, 2)}

Based on this information, determine:
1. Was there an error message displayed on the page?
2. If successful, what indicates success (redirect, message, etc.)?
3. How confident are you in this assessment?

Return ONLY valid JSON:
{
  "errorDetected": true or false,
  "errorMessage": "The specific error message if detected, or null",
  "successMessage": "Success indicator if no error (e.g., 'Redirected to dashboard'), or null",
  "confidence": 0.0 to 1.0
}`;

    try {
      const response = await this.makeRequest(async () => {
        return await this.client!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3, // Low temperature for consistent validation
          response_format: { type: 'json_object' },
        });
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      const result = JSON.parse(content);

      return {
        errorDetected: result.errorDetected ?? false,
        errorMessage: result.errorMessage ?? null,
        successMessage: result.successMessage ?? null,
        confidence: result.confidence ?? 0.5,
      };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Extract {{variableName}} patterns from test steps
   */
  private extractVariablesFromSteps(steps: UIStep[]): string[] {
    const variables = new Set<string>();

    steps.forEach((step) => {
      const action = step.action as any;

      // Check action properties for variables
      ['url', 'text', 'value'].forEach((prop) => {
        if (typeof action[prop] === 'string') {
          // Use match() instead of exec() to avoid regex state issues
          const matches = action[prop].match(/\{\{(\w+)\}\}/g);
          if (matches) {
            matches.forEach((match: string) => {
              const varName = match.replace(/[{}]/g, '');
              variables.add(varName);
            });
          }
        }
      });
    });

    return Array.from(variables);
  }

  /**
   * Infer field names from selectors when no variables are found
   */
  private inferFieldsFromSteps(steps: UIStep[]): string[] {
    const fields = new Set<string>();

    steps.forEach((step) => {
      const action = step.action as any;

      // For type actions, analyze the selector
      if (action.type === 'type' && step.selectors && step.selectors.length > 0) {
        const selector = step.selectors[0].value;

        // Extract common field identifiers
        const patterns = [
          /id="?(\w+)"?/i,
          /name="?(\w+)"?/i,
          /#(\w+)/,
          /\[name=["']?(\w+)["']?\]/,
          /\[id=["']?(\w+)["']?\]/,
          /\[placeholder=["']?([^"']+)["']?\]/i,
        ];

        for (const pattern of patterns) {
          const match = selector.match(pattern);
          if (match && match[1]) {
            const fieldName = match[1].toLowerCase();
            // Common field names
            if (
              fieldName.includes('email') ||
              fieldName.includes('user') ||
              fieldName.includes('password') ||
              fieldName.includes('name') ||
              fieldName.includes('phone') ||
              fieldName.includes('address') ||
              fieldName.includes('city') ||
              fieldName.includes('zip') ||
              fieldName.includes('state')
            ) {
              fields.add(fieldName);
              break;
            }
          }
        }

        // Fallback: use step name
        if (fields.size === 0) {
          const stepName = step.name.toLowerCase();
          if (stepName.includes('email')) fields.add('email');
          if (stepName.includes('password')) fields.add('password');
          if (stepName.includes('username') || stepName.includes('user')) fields.add('username');
          if (stepName.includes('name')) fields.add('name');
        }
      }
    });

    return Array.from(fields);
  }

  /**
   * Describe action for AI context
   */
  private describeAction(step: UIStep): string {
    const action = step.action as any;

    switch (action.type) {
      case 'type':
        return `Type "${action.text}" into element`;
      case 'click':
        return 'Click element';
      case 'navigate':
        return `Navigate to ${action.url}`;
      case 'select':
        return `Select option "${action.value}"`;
      case 'waitTime':
        return `Wait ${action.duration}ms`;
      case 'waitForElement':
        return 'Wait for element to appear';
      default:
        return action.type;
    }
  }

  /**
   * Create action object from AI suggestion
   */
  private createAction(type: string, suggestion: any): any {
    switch (type) {
      case 'click':
        return { type: 'click' };
      case 'type':
        return { type: 'type', text: suggestion.text || '' };
      case 'navigate':
        return { type: 'navigate', url: suggestion.url || '' };
      case 'waitTime':
        return { type: 'waitTime', duration: suggestion.duration || 2000 };
      case 'waitForElement':
        return { type: 'waitForElement' };
      default:
        return { type: 'click' };
    }
  }

  /**
   * Create action from page analysis suggestion
   */
  private createActionFromSuggestion(suggestion: any): any {
    const actionType = suggestion.type || 'click';

    switch (actionType) {
      case 'type':
        return { type: 'type', text: suggestion.text || '' };
      case 'click':
        return { type: 'click' };
      case 'navigate':
        return { type: 'navigate', url: suggestion.url || '' };
      case 'waitForElement':
        return { type: 'waitForElement' };
      case 'waitTime':
        return { type: 'waitTime', duration: suggestion.duration || 2000 };
      default:
        return { type: 'click' };
    }
  }

  /**
   * Optimize DOM snapshot to reduce token usage
   */
  private optimizeDOMSnapshot(html: string): string {
    if (!html) return '';

    let optimized = html;

    // Remove scripts, styles, comments
    optimized = optimized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    optimized = optimized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    optimized = optimized.replace(/<!--[\s\S]*?-->/g, '');

    // Remove data URIs
    optimized = optimized.replace(/data:[^"'\s>]+/g, 'data:...');

    // Truncate long text nodes
    optimized = optimized.replace(/>([^<]{100})[^<]*</g, '>$1...</');

    // Minimize whitespace
    optimized = optimized.replace(/\s+/g, ' ');

    // Limit total length to ~8000 chars (~2000 tokens)
    if (optimized.length > 8000) {
      optimized = optimized.substring(0, 8000) + '\n...[truncated]';
    }

    return optimized;
  }

  /**
   * Rate-limited request wrapper
   */
  private async makeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    // Wait if needed for rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval + this.rateLimitDelay) {
      const waitTime = this.minInterval + this.rateLimitDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();

    try {
      const result = await requestFn();
      // Reset rate limit delay on success
      this.rateLimitDelay = 0;
      return result;
    } catch (error: any) {
      // Handle rate limiting
      if (error?.status === 429) {
        const retryAfter = error?.headers?.['retry-after'];
        this.rateLimitDelay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        throw new Error(`AI rate limited. Please try again in ${this.rateLimitDelay / 1000}s`);
      }
      throw error;
    }
  }

  /**
   * Handle errors with user-friendly messages
   */
  private handleError(error: any): void {
    console.error('AIService error:', error);

    if (error?.status === 401) {
      throw new Error('Invalid OpenAI API key. Please update in Settings.');
    }

    if (error?.status === 429) {
      throw new Error('AI rate limit exceeded. Please wait before trying again.');
    }

    if (error?.message?.includes('network') || error?.code === 'ECONNREFUSED') {
      throw new Error('Cannot reach OpenAI API. Check your internet connection.');
    }
  }

  /**
   * Cache management
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.cacheMaxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setInCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });

    // Simple cache size management
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  /**
   * Simple string hash for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}
