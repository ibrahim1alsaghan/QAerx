import { db } from '../db';
import type { Settings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

export const SettingsRepository = {
  async get(): Promise<Settings> {
    const settings = await db.settings.get('app-settings');
    if (!settings) {
      await db.settings.add(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    return settings;
  },

  async update(data: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const updated = { ...current, ...data };
    await db.settings.put(updated);
    return updated;
  },

  async setOpenAIKey(encryptedKey: string): Promise<void> {
    await this.update({ openaiApiKey: encryptedKey });
  },

  async clearOpenAIKey(): Promise<void> {
    await this.update({ openaiApiKey: undefined });
  },

  async setParallelLimit(limit: number): Promise<void> {
    await this.update({ parallelLimit: Math.max(1, Math.min(limit, 10)) });
  },

  async completeOnboarding(): Promise<void> {
    await this.update({ onboardingCompleted: true });
  },

  async updateTutorialProgress(step: number): Promise<void> {
    await this.update({ tutorialProgress: step });
  },

  async setLastOpened(suiteId?: string, testId?: string): Promise<void> {
    await this.update({ lastOpenedSuiteId: suiteId, lastOpenedTestId: testId });
  },
};
