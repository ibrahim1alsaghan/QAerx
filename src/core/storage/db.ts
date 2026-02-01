import Dexie, { type Table } from 'dexie';
import type { Suite, Test } from '@/types/test';
import type { TestRun } from '@/types/result';
import type { Settings, Credential, ScreenshotRecord } from '@/types/settings';

export class QAerxDatabase extends Dexie {
  suites!: Table<Suite, string>;
  tests!: Table<Test, string>;
  testRuns!: Table<TestRun, string>;
  credentials!: Table<Credential, string>;
  screenshots!: Table<ScreenshotRecord, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('QAerxDB');

    this.version(1).stores({
      suites: 'id, parentId, name, updatedAt',
      tests: 'id, suiteId, name, updatedAt, [suiteId+order]',
      testRuns: 'id, testId, suiteId, status, startedAt, [testId+startedAt]',
      credentials: 'id, name, domain',
      screenshots: 'id, testRunId, stepId, timestamp, isBaseline, [testId+isBaseline]',
      settings: 'id',
    });

    // Version 2: Add order index to suites
    this.version(2).stores({
      suites: 'id, parentId, name, order, updatedAt',
      tests: 'id, suiteId, name, updatedAt, [suiteId+order]',
      testRuns: 'id, testId, suiteId, status, startedAt, [testId+startedAt]',
      credentials: 'id, name, domain',
      screenshots: 'id, testRunId, stepId, timestamp, isBaseline, [testId+isBaseline]',
      settings: 'id',
    }).upgrade(tx => {
      // Migration: Add default order value to existing suites
      return tx.table('suites').toCollection().modify(suite => {
        if (suite.order === undefined) {
          suite.order = 0;
        }
      });
    });
  }
}

export const db = new QAerxDatabase();
