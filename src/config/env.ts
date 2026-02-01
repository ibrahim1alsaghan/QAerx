/**
 * Environment Configuration
 * Centralized configuration for QAerx extension
 */

export interface Config {
  // AI Settings
  ai: {
    provider: 'openai';
    model: string;
    maxTokens: number;
    temperature: number;
  };

  // Execution Settings
  execution: {
    defaultTimeout: number;
    maxParallelTests: number;
    retryAttempts: number;
    retryDelay: number;
    screenshotOnFailure: boolean;
    screenshotOnSuccess: boolean;
  };

  // Storage Settings
  storage: {
    maxTestHistory: number;
    maxScreenshotSize: number;
    compressScreenshots: boolean;
  };

  // Debug Settings
  debug: {
    enabled: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    verboseExecution: boolean;
  };

  // Feature Flags
  features: {
    aiDataGeneration: boolean;
    visualComparison: boolean;
    selectorHealing: boolean;
    networkMocking: boolean;
  };
}

/**
 * Default configuration values
 */
export const defaultConfig: Config = {
  ai: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.7,
  },

  execution: {
    defaultTimeout: 30000, // 30 seconds
    maxParallelTests: 3,
    retryAttempts: 2,
    retryDelay: 1000, // 1 second
    screenshotOnFailure: true,
    screenshotOnSuccess: false,
  },

  storage: {
    maxTestHistory: 100,
    maxScreenshotSize: 1024 * 1024, // 1MB
    compressScreenshots: true,
  },

  debug: {
    enabled: import.meta.env.DEV || false,
    logLevel: import.meta.env.DEV ? 'debug' : 'error',
    verboseExecution: false,
  },

  features: {
    aiDataGeneration: true,
    visualComparison: true,
    selectorHealing: true,
    networkMocking: false, // Future feature
  },
};

/**
 * Runtime configuration - merges defaults with user settings
 */
class ConfigManager {
  private config: Config = { ...defaultConfig };
  private listeners: Set<(config: Config) => void> = new Set();

  /**
   * Get current configuration
   */
  get(): Config {
    return { ...this.config };
  }

  /**
   * Get a specific config value
   */
  getValue<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  /**
   * Update configuration (partial update supported)
   */
  update(updates: Partial<Config>): void {
    this.config = this.deepMerge(this.config, updates);
    this.notifyListeners();
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...defaultConfig };
    this.notifyListeners();
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(callback: (config: Config) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Deep merge helper
   */
  private deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = result[key];
      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object'
      ) {
        result[key] = this.deepMerge(targetValue, sourceValue as Partial<typeof targetValue>);
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
    return result;
  }

  /**
   * Notify all listeners of config changes
   */
  private notifyListeners(): void {
    const configCopy = this.get();
    this.listeners.forEach(callback => callback(configCopy));
  }
}

/**
 * Singleton config manager instance
 */
export const configManager = new ConfigManager();

/**
 * Convenience export for getting config
 */
export const getConfig = () => configManager.get();
