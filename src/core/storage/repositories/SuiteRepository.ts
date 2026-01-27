import { db } from '../db';
import type { Suite, SuiteHooks } from '@/types/test';
import { v4 as uuid } from 'uuid';

export interface SuiteTreeNode extends Suite {
  children: SuiteTreeNode[];
  tests: number;
}

export const SuiteRepository = {
  async create(data: Omit<Suite, 'id' | 'createdAt' | 'updatedAt'>): Promise<Suite> {
    const now = Date.now();
    const suite: Suite = {
      ...data,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    };
    await db.suites.add(suite);
    return suite;
  },

  async getById(id: string): Promise<Suite | undefined> {
    return db.suites.get(id);
  },

  async getAll(): Promise<Suite[]> {
    return db.suites.orderBy('order').toArray();
  },

  async getByParent(parentId: string | undefined): Promise<Suite[]> {
    if (parentId === undefined) {
      return db.suites.filter((s) => !s.parentId).toArray();
    }
    return db.suites.where('parentId').equals(parentId).toArray();
  },

  async update(id: string, data: Partial<Suite>): Promise<void> {
    await db.suites.update(id, {
      ...data,
      updatedAt: Date.now(),
    });
  },

  async delete(id: string): Promise<void> {
    // Delete all tests in suite
    await db.tests.where('suiteId').equals(id).delete();
    // Delete child suites recursively
    const children = await this.getByParent(id);
    for (const child of children) {
      await this.delete(child.id);
    }
    // Delete the suite
    await db.suites.delete(id);
  },

  async getTree(): Promise<SuiteTreeNode[]> {
    const allSuites = await this.getAll();
    const allTests = await db.tests.toArray();

    const testCountMap = new Map<string, number>();
    for (const test of allTests) {
      testCountMap.set(test.suiteId, (testCountMap.get(test.suiteId) || 0) + 1);
    }

    const buildTree = (parentId?: string): SuiteTreeNode[] => {
      return allSuites
        .filter((s) => s.parentId === parentId)
        .sort((a, b) => a.order - b.order)
        .map((suite) => ({
          ...suite,
          children: buildTree(suite.id),
          tests: testCountMap.get(suite.id) || 0,
        }));
    };

    return buildTree(undefined);
  },

  async createDefault(): Promise<Suite> {
    return this.create({
      name: 'Default Suite',
      order: 0,
      hooks: {} as SuiteHooks,
    });
  },
};
