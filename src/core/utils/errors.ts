/**
 * Error Handling Utilities
 * Centralized error handling for QAerx
 */

/**
 * Base error class for QAerx
 */
export class QAerxError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly recoverable: boolean;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: string,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      recoverable?: boolean;
    }
  ) {
    super(message);
    this.name = 'QAerxError';
    this.code = code;
    this.context = options?.context;
    this.timestamp = new Date();
    this.recoverable = options?.recoverable ?? true;
    this.originalError = options?.cause;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, QAerxError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      recoverable: this.recoverable,
      stack: this.stack,
    };
  }
}

/**
 * Error codes for different error types
 */
export const ErrorCodes = {
  // Execution errors
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
  ELEMENT_NOT_VISIBLE: 'ELEMENT_NOT_VISIBLE',
  ELEMENT_NOT_INTERACTABLE: 'ELEMENT_NOT_INTERACTABLE',
  NAVIGATION_FAILED: 'NAVIGATION_FAILED',
  ASSERTION_FAILED: 'ASSERTION_FAILED',

  // AI errors
  AI_API_ERROR: 'AI_API_ERROR',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  AI_NO_API_KEY: 'AI_NO_API_KEY',

  // Storage errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  DATA_CORRUPTION: 'DATA_CORRUPTION',

  // Validation errors
  INVALID_SELECTOR: 'INVALID_SELECTOR',
  INVALID_TEST_DATA: 'INVALID_TEST_DATA',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_REQUEST_FAILED: 'API_REQUEST_FAILED',

  // Extension errors
  CONTENT_SCRIPT_ERROR: 'CONTENT_SCRIPT_ERROR',
  MESSAGE_HANDLER_ERROR: 'MESSAGE_HANDLER_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Specific error classes
 */
export class ExecutionError extends QAerxError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.EXECUTION_FAILED,
    context?: Record<string, unknown>
  ) {
    super(message, code, { context, recoverable: true });
    this.name = 'ExecutionError';
  }
}

export class ElementNotFoundError extends QAerxError {
  constructor(selector: string, context?: Record<string, unknown>) {
    super(`Element not found: ${selector}`, ErrorCodes.ELEMENT_NOT_FOUND, {
      context: { selector, ...context },
      recoverable: true,
    });
    this.name = 'ElementNotFoundError';
  }
}

export class AIError extends QAerxError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.AI_API_ERROR,
    context?: Record<string, unknown>
  ) {
    super(message, code, { context, recoverable: true });
    this.name = 'AIError';
  }
}

export class StorageError extends QAerxError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCodes.STORAGE_ERROR, {
      context,
      recoverable: false,
    });
    this.name = 'StorageError';
  }
}

export class ValidationError extends QAerxError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCodes.INVALID_TEST_DATA, {
      context,
      recoverable: true,
    });
    this.name = 'ValidationError';
  }
}

/**
 * User-friendly error messages
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.EXECUTION_TIMEOUT]: 'The operation timed out. The page may be loading slowly.',
  [ErrorCodes.EXECUTION_FAILED]: 'Test execution failed unexpectedly.',
  [ErrorCodes.ELEMENT_NOT_FOUND]: 'Could not find the element on the page.',
  [ErrorCodes.ELEMENT_NOT_VISIBLE]: 'The element exists but is not visible.',
  [ErrorCodes.ELEMENT_NOT_INTERACTABLE]: 'The element cannot be clicked or interacted with.',
  [ErrorCodes.NAVIGATION_FAILED]: 'Failed to navigate to the page.',
  [ErrorCodes.ASSERTION_FAILED]: 'The assertion check did not pass.',
  [ErrorCodes.AI_API_ERROR]: 'AI service encountered an error.',
  [ErrorCodes.AI_RATE_LIMIT]: 'Too many AI requests. Please wait a moment.',
  [ErrorCodes.AI_INVALID_RESPONSE]: 'AI returned an unexpected response.',
  [ErrorCodes.AI_NO_API_KEY]: 'OpenAI API key is not configured.',
  [ErrorCodes.STORAGE_ERROR]: 'Failed to save or load data.',
  [ErrorCodes.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded. Please delete some old tests.',
  [ErrorCodes.DATA_CORRUPTION]: 'Data appears to be corrupted.',
  [ErrorCodes.INVALID_SELECTOR]: 'The selector is not valid.',
  [ErrorCodes.INVALID_TEST_DATA]: 'The test data is not valid.',
  [ErrorCodes.INVALID_CONFIGURATION]: 'The configuration is not valid.',
  [ErrorCodes.NETWORK_ERROR]: 'Network connection failed.',
  [ErrorCodes.API_REQUEST_FAILED]: 'API request failed.',
  [ErrorCodes.CONTENT_SCRIPT_ERROR]: 'Error communicating with the page.',
  [ErrorCodes.MESSAGE_HANDLER_ERROR]: 'Internal communication error.',
  [ErrorCodes.PERMISSION_DENIED]: 'Permission denied for this action.',
  [ErrorCodes.UNKNOWN_ERROR]: 'An unexpected error occurred.',
};

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof QAerxError) {
    return ErrorMessages[error.code as ErrorCode] || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return ErrorMessages[ErrorCodes.UNKNOWN_ERROR];
}

/**
 * Safe error wrapper - converts any error to QAerxError
 */
export function wrapError(error: unknown, defaultCode: ErrorCode = ErrorCodes.UNKNOWN_ERROR): QAerxError {
  if (error instanceof QAerxError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  return new QAerxError(message, defaultCode, { cause });
}

/**
 * Try-catch wrapper with error handling
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  options?: {
    fallback?: T;
    onError?: (error: QAerxError) => void;
    defaultCode?: ErrorCode;
  }
): Promise<{ data: T | undefined; error: QAerxError | undefined }> {
  try {
    const data = await fn();
    return { data, error: undefined };
  } catch (err) {
    const error = wrapError(err, options?.defaultCode);
    options?.onError?.(error);
    return { data: options?.fallback, error };
  }
}

/**
 * Logger utility
 */
export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (import.meta.env.DEV) {
      console.debug(`[QAerx] ${message}`, context || '');
    }
  },

  info: (message: string, context?: Record<string, unknown>) => {
    console.info(`[QAerx] ${message}`, context || '');
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(`[QAerx] ${message}`, context || '');
  },

  error: (message: string, error?: unknown) => {
    const qaError = error ? wrapError(error) : undefined;
    console.error(`[QAerx] ${message}`, qaError?.toJSON() || '');
  },
};
