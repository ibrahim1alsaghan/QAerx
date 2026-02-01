/**
 * AI Validation Types
 * Types for the AI-first test validation system
 */

import type { ScenarioType } from './test';

/**
 * Context collected after step execution for AI validation
 */
export interface ValidationContext {
  stepName: string;
  stepIndex: number;
  totalSteps: number;
  actionType: string;
  actionDescription: string;

  // Captured page state
  pageResponse: string | undefined;
  urlBefore: string;
  urlAfter: string;
  titleBefore: string;
  titleAfter: string;

  // Test scenario context
  scenario: ScenarioType;
  variables: Record<string, string>;
}

/**
 * Result from AI validation
 */
export interface ValidationResult {
  status: 'passed' | 'failed';
  confidence: number;  // 0-1, how confident AI is in the result
  reason: string;      // Human-readable explanation
  expectedError: boolean;  // True if error was expected (worst-case scenario)
}

/**
 * Raw response from AI validation API
 */
export interface AIValidationResponse {
  errorDetected: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  confidence: number;
}

/**
 * Extended step result with AI validation data
 */
export interface AIValidationData {
  confidence: number;
  reason: string;
  expectedError: boolean;
  validatedBy: 'ai' | 'local' | 'fallback';
}

/**
 * Step result context captured from PlaybackEngine
 */
export interface StepExecutionContext {
  urlBefore: string;
  urlAfter: string;
  titleBefore: string;
  titleAfter: string;
}
