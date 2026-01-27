import { db } from '../db';
import type { TestRun, StepResult, RunSummary, ExecutionEnvironment } from '@/types/result';
import { v4 as uuid } from 'uuid';

export const ResultRepository = {
  async create(testId: string, suiteId: string): Promise<TestRun> {
    const run: TestRun = {
      id: uuid(),
      testId,
      suiteId,
      startedAt: Date.now(),
      status: 'running',
      environment: await this.getEnvironment(),
      stepResults: [],
      summary: {
        totalSteps: 0,
        passedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
        duration: 0,
      },
    };
    await db.testRuns.add(run);
    return run;
  },

  async getById(id: string): Promise<TestRun | undefined> {
    return db.testRuns.get(id);
  },

  async getByTest(testId: string, limit = 10): Promise<TestRun[]> {
    return db.testRuns
      .where('testId')
      .equals(testId)
      .reverse()
      .sortBy('startedAt')
      .then((runs) => runs.slice(0, limit));
  },

  async getBySuite(suiteId: string, limit = 50): Promise<TestRun[]> {
    return db.testRuns
      .where('suiteId')
      .equals(suiteId)
      .reverse()
      .sortBy('startedAt')
      .then((runs) => runs.slice(0, limit));
  },

  async getRecent(limit = 20): Promise<TestRun[]> {
    return db.testRuns.orderBy('startedAt').reverse().limit(limit).toArray();
  },

  async update(id: string, data: Partial<TestRun>): Promise<void> {
    await db.testRuns.update(id, data);
  },

  async addStepResult(runId: string, result: StepResult): Promise<void> {
    const run = await this.getById(runId);
    if (!run) throw new Error('Test run not found');

    const stepResults = [...run.stepResults, result];
    const summary = this.calculateSummary(stepResults, run.startedAt);

    await this.update(runId, { stepResults, summary });
  },

  async complete(
    runId: string,
    status: 'passed' | 'failed' | 'error' | 'stopped'
  ): Promise<void> {
    const run = await this.getById(runId);
    if (!run) throw new Error('Test run not found');

    const completedAt = Date.now();
    const summary = this.calculateSummary(run.stepResults, run.startedAt, completedAt);

    await this.update(runId, { status, completedAt, summary });
  },

  async delete(id: string): Promise<void> {
    // Delete associated screenshots
    await db.screenshots.where('testRunId').equals(id).delete();
    // Delete the run
    await db.testRuns.delete(id);
  },

  async pruneOld(daysToKeep = 30): Promise<number> {
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const oldRuns = await db.testRuns.where('startedAt').below(cutoff).toArray();

    for (const run of oldRuns) {
      await db.screenshots.where('testRunId').equals(run.id).delete();
    }

    return db.testRuns.where('startedAt').below(cutoff).delete();
  },

  calculateSummary(
    stepResults: StepResult[],
    startedAt: number,
    completedAt?: number
  ): RunSummary {
    return {
      totalSteps: stepResults.length,
      passedSteps: stepResults.filter((r) => r.status === 'passed').length,
      failedSteps: stepResults.filter((r) => r.status === 'failed').length,
      skippedSteps: stepResults.filter((r) => r.status === 'skipped').length,
      duration: (completedAt || Date.now()) - startedAt,
    };
  },

  async getEnvironment(): Promise<ExecutionEnvironment> {
    return {
      browserVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown',
      extensionVersion: chrome.runtime?.getManifest?.()?.version || '0.1.0',
      screenSize: { width: window.screen.width, height: window.screen.height },
      userAgent: navigator.userAgent,
    };
  },
};
