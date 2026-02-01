/**
 * Application Constants
 * Centralized constants used throughout QAerx
 */

/**
 * Application metadata
 */
export const APP = {
  NAME: 'QAerx',
  VERSION: '1.0.0',
  DESCRIPTION: 'AI-Powered Test Automation',
} as const;

/**
 * Storage keys for IndexedDB
 */
export const STORAGE_KEYS = {
  SETTINGS: 'qaerx_settings',
  TESTS: 'qaerx_tests',
  SUITES: 'qaerx_suites',
  RESULTS: 'qaerx_results',
  CREDENTIALS: 'qaerx_credentials',
} as const;

/**
 * Message types for extension communication
 */
export const MESSAGE_TYPES = {
  // Recording
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  RECORDING_STEP: 'RECORDING_STEP',

  // Execution
  RUN_TEST: 'RUN_TEST',
  STOP_TEST: 'STOP_TEST',
  TEST_STEP_RESULT: 'TEST_STEP_RESULT',
  TEST_COMPLETE: 'TEST_COMPLETE',

  // Page Analysis
  ANALYZE_PAGE: 'ANALYZE_PAGE',
  COLLECT_FIELDS: 'COLLECT_FIELDS',
  HIGHLIGHT_ELEMENT: 'HIGHLIGHT_ELEMENT',

  // AI
  AI_GENERATE_DATA: 'AI_GENERATE_DATA',
  AI_HEAL_SELECTOR: 'AI_HEAL_SELECTOR',
  AI_ANALYZE_FAILURE: 'AI_ANALYZE_FAILURE',
} as const;

/**
 * Step action types
 */
export const ACTION_TYPES = {
  NAVIGATE: 'navigate',
  CLICK: 'click',
  DOUBLE_CLICK: 'dblclick',
  TYPE: 'type',
  CLEAR: 'clear',
  SELECT: 'select',
  CHECK: 'check',
  UNCHECK: 'uncheck',
  HOVER: 'hover',
  SCROLL: 'scroll',
  WAIT: 'wait',
  ASSERT: 'assert',
  SCREENSHOT: 'screenshot',
  API: 'api',
} as const;

/**
 * Test result statuses
 */
export const TEST_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  ERROR: 'error',
} as const;

/**
 * Selector strategies in priority order
 */
export const SELECTOR_PRIORITY = [
  'data-testid',
  'data-cy',
  'data-test',
  'aria-label',
  'id',
  'name',
  'placeholder',
  'class',
  'css',
  'xpath',
  'text',
] as const;

/**
 * Scenario types for test data
 */
export const SCENARIO_TYPES = {
  BEST_CASE: 'best-case',
  WORST_CASE: 'worst-case',
  EDGE_CASE: 'edge-case',
  BOUNDARY: 'boundary',
  NORMAL: 'normal',
} as const;

/**
 * AI providers
 */
export const AI_PROVIDERS = {
  OPENAI: 'openai',
} as const;

/**
 * Default timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  ELEMENT_WAIT: 10000,
  PAGE_LOAD: 30000,
  ANIMATION: 300,
  DEBOUNCE: 150,
  API_REQUEST: 30000,
} as const;

/**
 * Keyboard shortcuts
 */
export const SHORTCUTS = {
  RUN_TEST: 'Ctrl+Enter',
  SAVE: 'Ctrl+S',
  RECORD: 'Ctrl+R',
  STOP: 'Escape',
} as const;

/**
 * Validation patterns
 */
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  VARIABLE: /\{\{([^}]+)\}\}/g,
  CSS_SELECTOR: /^[#.]?[\w\-\[\]='"^$*~|:()>\s.#]+$/,
} as const;

/**
 * File size limits
 */
export const SIZE_LIMITS = {
  MAX_SCREENSHOT_SIZE: 1024 * 1024 * 2, // 2MB
  MAX_IMPORT_SIZE: 1024 * 1024 * 10, // 10MB
  MAX_TEST_STEPS: 500,
  MAX_DATA_SETS: 100,
} as const;

/**
 * Report formats
 */
export const REPORT_FORMATS = {
  PDF: 'pdf',
  HTML: 'html',
  JSON: 'json',
  CSV: 'csv',
} as const;
