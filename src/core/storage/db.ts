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
  }
}

export const db = new QAerxDatabase();
