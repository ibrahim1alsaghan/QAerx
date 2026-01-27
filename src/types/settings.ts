export interface Settings {
  id: 'app-settings';
  openaiApiKey?: string;
  parallelLimit: number;
  defaultTimeout: number;
  screenshotQuality: number;
  recordMouseMovements: boolean;
  recordScrollEvents: boolean;
  onboardingCompleted: boolean;
  tutorialProgress: number;
  theme: 'dark';
  lastOpenedSuiteId?: string;
  lastOpenedTestId?: string;
}

export interface Credential {
  id: string;
  name: string;
  domain: string;
  encryptedData: string;
  iv: string;
  salt: string;
  createdAt: number;
  updatedAt: number;
}

export interface ScreenshotRecord {
  id: string;
  testRunId?: string;
  testId: string;
  stepId: string;
  timestamp: number;
  dataUrl: string;
  width: number;
  height: number;
  isBaseline: boolean;
  name?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app-settings',
  parallelLimit: 2,
  defaultTimeout: 30000,
  screenshotQuality: 80,
  recordMouseMovements: false,
  recordScrollEvents: true,
  onboardingCompleted: false,
  tutorialProgress: 0,
  theme: 'dark',
};
