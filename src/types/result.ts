import type { SelectorStrategy } from './test';

export interface TestRun {
  id: string;
  testId: string;
  suiteId: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'passed' | 'failed' | 'error' | 'stopped';
  dataRowIndex?: number;
  environment: ExecutionEnvironment;
  stepResults: StepResult[];
  summary: RunSummary;
}

export interface ExecutionEnvironment {
  browserVersion: string;
  extensionVersion: string;
  screenSize: { width: number; height: number };
  userAgent: string;
}

export interface RunSummary {
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  duration: number;
}

export type StepResult = UIStepResult | APIStepResult;

export interface BaseStepResult {
  stepId: string;
  stepName: string;
  startedAt: number;
  completedAt: number;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  error?: StepError;
  logs?: LogEntry[];
}

export interface UIStepResult extends BaseStepResult {
  type: 'ui';
  selectorUsed?: SelectorStrategy;
  selectorHealing?: SelectorHealingSuggestion;
  screenshot?: Screenshot;
  assertionResults?: AssertionResult[];
  domSnapshot?: string;
}

export interface APIStepResult extends BaseStepResult {
  type: 'api';
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: string;
    timing: {
      dns: number;
      connect: number;
      ttfb: number;
      download: number;
      total: number;
    };
  };
  assertionResults?: AssertionResult[];
  extractedValues?: Record<string, unknown>;
}

export interface StepError {
  message: string;
  stack?: string;
  type: 'timeout' | 'element-not-found' | 'assertion-failed' | 'network' | 'script' | 'unknown';
  recoverable: boolean;
}

export interface SelectorHealingSuggestion {
  originalSelector: SelectorStrategy;
  suggestedSelectors: SelectorStrategy[];
  confidence: number;
  aiExplanation?: string;
}

export interface Screenshot {
  id: string;
  timestamp: number;
  dataUrl: string;
  width: number;
  height: number;
  isBaseline: boolean;
  diff?: {
    baselineId: string;
    diffPercentage: number;
    diffImageDataUrl?: string;
  };
}

export interface AssertionResult {
  assertionIndex: number;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message?: string;
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
}
