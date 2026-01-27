import { db } from '../db';
import type { Test, Step } from '@/types/test';
import { v4 as uuid } from 'uuid';

export const TestRepository = {
  async create(data: Omit<Test, 'id' | 'createdAt' | 'updatedAt'>): Promise<Test> {
    const now = Date.now();
    const test: Test = {
      ...data,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    };
    await db.tests.add(test);
    return test;
  },

  async getById(id: string): Promise<Test | undefined> {
    return db.tests.get(id);
  },

  async getAll(): Promise<Test[]> {
    return db.tests.toArray();
  },

  async getBySuite(suiteId: string): Promise<Test[]> {
    return db.tests.where('suiteId').equals(suiteId).sortBy('order');
  },

  async update(id: string, data: Partial<Test>): Promise<void> {
    await db.tests.update(id, {
      ...data,
      updatedAt: Date.now(),
    });
  },

  async delete(id: string): Promise<void> {
    // Delete associated test runs
    await db.testRuns.where('testId').equals(id).delete();
    // Delete the test
    await db.tests.delete(id);
  },

  async addStep(testId: string, step: Step): Promise<void> {
    const test = await this.getById(testId);
    if (!test) throw new Error('Test not found');

    const steps = [...test.steps, step];
    await this.update(testId, { steps });
  },

  async updateStep(testId: string, stepId: string, data: Partial<Step>): Promise<void> {
    const test = await this.getById(testId);
    if (!test) throw new Error('Test not found');

    const steps = test.steps.map((s): Step => (s.id === stepId ? { ...s, ...data } as Step : s));
    await this.update(testId, { steps });
  },

  async deleteStep(testId: string, stepId: string): Promise<void> {
    const test = await this.getById(testId);
    if (!test) throw new Error('Test not found');

    const steps = test.steps.filter((s) => s.id !== stepId);
    // Reorder remaining steps
    const reorderedSteps = steps.map((s, i) => ({ ...s, order: i }));
    await this.update(testId, { steps: reorderedSteps });
  },

  async reorderSteps(testId: string, stepIds: string[]): Promise<void> {
    const test = await this.getById(testId);
    if (!test) throw new Error('Test not found');

    const stepMap = new Map(test.steps.map((s) => [s.id, s]));
    const reorderedSteps = stepIds
      .map((id, i) => {
        const step = stepMap.get(id);
        return step ? { ...step, order: i } : null;
      })
      .filter((s): s is Step => s !== null);

    await this.update(testId, { steps: reorderedSteps });
  },

  async createNew(suiteId: string, name: string, url: string): Promise<Test> {
    const existingTests = await this.getBySuite(suiteId);
    const order = existingTests.length;

    return this.create({
      suiteId,
      name,
      url,
      order,
      steps: [],
    });
  },
};
