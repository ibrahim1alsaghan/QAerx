// Suite and Test types

export interface Suite {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string;
  order: number;
  hooks: SuiteHooks;
}

export interface SuiteHooks {
  beforeAll?: Step[];
  afterAll?: Step[];
  beforeEach?: Step[];
  afterEach?: Step[];
}

export interface Test {
  id: string;
  suiteId: string;
  name: string;
  description?: string;
  url: string;
  createdAt: number;
  updatedAt: number;
  order: number;
  credentialId?: string;
  dataSource?: TestDataSource;
  steps: Step[];
  tags?: string[];
}

export interface TestDataSource {
  type: 'manual' | 'imported' | 'ai-generated';
  data: Record<string, unknown>[];
  sourceFile?: string;
}

// Step types
export type Step = UIStep | APIStep;

export interface BaseStep {
  id: string;
  order: number;
  name: string;
  description?: string;
  enabled: boolean;
  continueOnFailure: boolean;
  dataBindings?: DataBinding[];
}

export interface UIStep extends BaseStep {
  type: 'ui';
  action: UIAction;
  selectors: SelectorStrategy[];
  assertions?: UIAssertion[];
  waitConfig?: WaitConfig;
}

export interface APIStep extends BaseStep {
  type: 'api';
  request: APIRequest;
  assertions?: APIAssertion[];
  extractors?: ResponseExtractor[];
  parallel?: boolean;
}

// UI Actions
export type UIAction =
  | { type: 'click'; button?: 'left' | 'right' | 'middle' }
  | { type: 'dblclick' }
  | { type: 'type'; text: string; clearFirst?: boolean }
  | { type: 'select'; value: string | string[] }
  | { type: 'check' }
  | { type: 'uncheck' }
  | { type: 'hover' }
  | { type: 'scroll'; x?: number; y?: number; toElement?: boolean }
  | { type: 'navigate'; url: string }
  | { type: 'reload' }
  | { type: 'goBack' }
  | { type: 'goForward' }
  | { type: 'waitForElement' }
  | { type: 'screenshot'; fullPage?: boolean }
  | { type: 'press'; key: string; modifiers?: string[] };

// Selector types
export interface SelectorStrategy {
  type: 'data-testid' | 'data-cy' | 'aria' | 'css' | 'text' | 'xpath';
  value: string;
  priority: number;
  confidence: number;
  frameSelector?: string;
}

// Wait configuration
export interface WaitConfig {
  strategy: 'visible' | 'hidden' | 'attached' | 'detached' | 'stable' | 'networkIdle';
  timeout: number;
  pollInterval?: number;
}

// API types
export interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: {
    type: 'json' | 'form' | 'text' | 'formData';
    content: unknown;
  };
  timeout?: number;
  followRedirects?: boolean;
}

export interface ResponseExtractor {
  name: string;
  source: 'body' | 'header' | 'status' | 'timing';
  path?: string;
  headerName?: string;
}

// Data binding
export interface DataBinding {
  variable: string;
  target: string;
}

// Assertions
export type UIAssertion =
  | TextAssertion
  | VisibilityAssertion
  | AttributeAssertion
  | VisualAssertion
  | CountAssertion;

export interface TextAssertion {
  type: 'text';
  expected: string;
  comparison: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matches';
  caseSensitive?: boolean;
}

export interface VisibilityAssertion {
  type: 'visibility';
  expected: 'visible' | 'hidden' | 'exists' | 'notExists';
}

export interface AttributeAssertion {
  type: 'attribute';
  attribute: string;
  expected: string;
  comparison: 'equals' | 'contains' | 'matches';
}

export interface VisualAssertion {
  type: 'visual';
  baselineId?: string;
  tolerance: {
    pixelThreshold: number;
    colorThreshold: number;
  };
  ignoreRegions?: Region[];
  usePerceptualDiff?: boolean;
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
  reason?: string;
}

export interface CountAssertion {
  type: 'count';
  expected: number;
  comparison: 'equals' | 'greaterThan' | 'lessThan' | 'atLeast' | 'atMost';
}

export type APIAssertion =
  | StatusAssertion
  | BodyAssertion
  | HeaderAssertion
  | TimingAssertion
  | SchemaAssertion;

export interface StatusAssertion {
  type: 'status';
  expected: number | number[];
}

export interface BodyAssertion {
  type: 'body';
  path?: string;
  expected: unknown;
  comparison: 'equals' | 'contains' | 'matches' | 'exists' | 'type';
}

export interface HeaderAssertion {
  type: 'header';
  name: string;
  expected: string;
  comparison: 'equals' | 'contains' | 'exists';
}

export interface TimingAssertion {
  type: 'timing';
  maxDuration: number;
}

export interface SchemaAssertion {
  type: 'schema';
  schema: object;
}
