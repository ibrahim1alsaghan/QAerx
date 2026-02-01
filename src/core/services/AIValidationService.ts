/**
 * AI Validation Service
 * Core service for AI-powered test step validation
 *
 * Makes AI the decision-maker for pass/fail determination with scenario awareness:
 * - best-case: errors mean FAIL (unexpected)
 * - worst-case: errors mean PASS (validation working correctly)
 * - edge-case/boundary: context-dependent
 */

import { AIService } from './AIService';
import type { ScenarioType } from '@/types/test';
import type {
  ValidationContext,
  ValidationResult,
  AIValidationResponse,
  AIValidationData,
} from '@/types/validation';

export class AIValidationService {
  private aiService: AIService;
  private initialized = false;

  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Initialize the service (required before validation)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.aiService.initialize();
      this.initialized = true;
    } catch (error) {
      console.warn('[AIValidationService] AI not available, using fallback validation');
      this.initialized = false;
    }
  }

  /**
   * Check if AI validation is available
   */
  isAvailable(): boolean {
    return this.initialized;
  }

  /**
   * Validate a step execution result
   * Returns intelligent pass/fail based on scenario context
   */
  async validateStep(context: ValidationContext): Promise<ValidationResult> {
    // Try AI validation first
    if (this.initialized) {
      try {
        const aiResponse = await this.callAIValidation(context);
        return this.applyScenarioLogic(aiResponse, context.scenario);
      } catch (error) {
        console.warn('[AIValidationService] AI validation failed, using fallback:', error);
      }
    }

    // Fallback to local validation
    return this.fallbackValidation(context);
  }

  /**
   * Call AI to analyze step execution
   */
  private async callAIValidation(context: ValidationContext): Promise<AIValidationResponse> {
    const response = await this.aiService.validateStepResult({
      stepName: context.stepName,
      actionType: context.actionType,
      actionDescription: context.actionDescription,
      pageResponse: context.pageResponse,
      urlChange: context.urlBefore !== context.urlAfter
        ? `${context.urlBefore} -> ${context.urlAfter}`
        : 'No change',
      variables: context.variables,
    });

    return response;
  }

  /**
   * Apply scenario-aware logic to AI response
   * - worst-case: errors are EXPECTED (test PASS)
   * - best-case: errors are UNEXPECTED (test FAIL)
   */
  private applyScenarioLogic(
    aiResponse: AIValidationResponse,
    scenario: ScenarioType
  ): ValidationResult {
    const { errorDetected, errorMessage, successMessage, confidence } = aiResponse;

    // For worst-case scenarios: error detection = PASS (validation working)
    if (scenario === 'worst-case') {
      if (errorDetected) {
        return {
          status: 'passed',
          confidence,
          reason: `Validation correctly rejected invalid data: ${errorMessage || 'Error detected'}`,
          expectedError: true,
        };
      } else {
        // No error on worst-case = FAIL (validation not working)
        return {
          status: 'failed',
          confidence,
          reason: 'Expected validation error but none was shown - invalid data was accepted',
          expectedError: false,
        };
      }
    }

    // For best-case and normal scenarios: error = FAIL
    if (scenario === 'best-case' || scenario === 'normal') {
      if (errorDetected) {
        return {
          status: 'failed',
          confidence,
          reason: errorMessage || 'Error detected on page',
          expectedError: false,
        };
      } else {
        return {
          status: 'passed',
          confidence,
          reason: successMessage || 'Step completed successfully',
          expectedError: false,
        };
      }
    }

    // For edge-case and boundary: context-dependent
    // Errors might be expected or not - use AI confidence
    if (errorDetected) {
      // If error contains "required" or "validation" keywords, it might be expected
      const isValidationError =
        errorMessage?.toLowerCase().includes('required') ||
        errorMessage?.toLowerCase().includes('invalid') ||
        errorMessage?.toLowerCase().includes('must be');

      if (isValidationError && confidence > 0.7) {
        return {
          status: 'passed',
          confidence,
          reason: `Edge/boundary case triggered validation: ${errorMessage}`,
          expectedError: true,
        };
      }

      return {
        status: 'failed',
        confidence,
        reason: errorMessage || 'Error detected',
        expectedError: false,
      };
    }

    return {
      status: 'passed',
      confidence,
      reason: successMessage || 'Step completed',
      expectedError: false,
    };
  }

  /**
   * Fallback validation when AI is not available
   * Uses enhanced pattern matching
   */
  private fallbackValidation(context: ValidationContext): ValidationResult {
    const { pageResponse, scenario, urlBefore, urlAfter } = context;

    // Check for error indicators
    const hasError = this.detectErrorInResponse(pageResponse);
    const hasSuccess = this.detectSuccessInResponse(pageResponse, urlBefore, urlAfter);

    // Apply scenario logic
    if (scenario === 'worst-case') {
      if (hasError) {
        return {
          status: 'passed',
          confidence: 0.6,
          reason: `[Local] Validation rejected invalid data: ${pageResponse || 'Error detected'}`,
          expectedError: true,
        };
      }
      return {
        status: 'failed',
        confidence: 0.5,
        reason: '[Local] Expected error but none detected',
        expectedError: false,
      };
    }

    // For best-case/normal
    if (hasError) {
      return {
        status: 'failed',
        confidence: 0.6,
        reason: `[Local] ${pageResponse || 'Error detected'}`,
        expectedError: false,
      };
    }

    if (hasSuccess) {
      return {
        status: 'passed',
        confidence: 0.7,
        reason: `[Local] ${pageResponse || 'Step completed successfully'}`,
        expectedError: false,
      };
    }

    // No clear signal - assume pass
    return {
      status: 'passed',
      confidence: 0.4,
      reason: '[Local] Step completed (no error detected)',
      expectedError: false,
    };
  }

  /**
   * Detect error patterns in page response
   */
  private detectErrorInResponse(pageResponse: string | undefined): boolean {
    if (!pageResponse) return false;

    const lower = pageResponse.toLowerCase();
    const errorPatterns = [
      'error', 'invalid', 'failed', 'incorrect', 'wrong',
      'denied', 'unauthorized', 'forbidden', 'required',
      'not found', 'missing', 'unable', 'cannot',
    ];

    return (
      pageResponse.startsWith('Error:') ||
      errorPatterns.some(pattern => lower.includes(pattern))
    );
  }

  /**
   * Detect success patterns in page response and URL changes
   */
  private detectSuccessInResponse(
    pageResponse: string | undefined,
    urlBefore: string,
    urlAfter: string
  ): boolean {
    // Check page response
    if (pageResponse) {
      const lower = pageResponse.toLowerCase();
      const successPatterns = [
        'success', 'welcome', 'logged in', 'created', 'saved',
        'completed', 'submitted', 'updated', 'confirmed',
      ];

      if (
        pageResponse.startsWith('Success:') ||
        successPatterns.some(pattern => lower.includes(pattern))
      ) {
        return true;
      }
    }

    // Check URL change (e.g., login -> dashboard)
    if (urlBefore !== urlAfter) {
      const successPaths = ['dashboard', 'home', 'main', 'profile', 'account', 'admin'];
      const afterPath = urlAfter.toLowerCase();

      if (successPaths.some(path => afterPath.includes(path))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Convert ValidationResult to AIValidationData for step result
   */
  toAIValidationData(result: ValidationResult): AIValidationData {
    return {
      confidence: result.confidence,
      reason: result.reason,
      expectedError: result.expectedError,
      validatedBy: this.initialized ? 'ai' : 'fallback',
    };
  }
}

// Singleton instance
let validationServiceInstance: AIValidationService | null = null;

export function getAIValidationService(): AIValidationService {
  if (!validationServiceInstance) {
    validationServiceInstance = new AIValidationService();
  }
  return validationServiceInstance;
}
