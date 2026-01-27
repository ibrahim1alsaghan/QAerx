import { useState, useEffect } from 'react';
import { Plus, Play, FileText, Trash2, Globe } from 'lucide-react';
import { TestRepository } from '@/core/storage/repositories';
import type { Test } from '@/types/test';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface TestListProps {
  suiteId: string | null;
  selectedTestId: string | null;
  onSelectTest: (id: string | null) => void;
}

export function TestList({ suiteId, selectedTestId, onSelectTest }: TestListProps) {
  const [tests, setTests] = useState<Test[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newTestUrl, setNewTestUrl] = useState('');

  useEffect(() => {
    if (suiteId) {
      TestRepository.getBySuite(suiteId).then(setTests);
    } else {
      TestRepository.getAll().then(setTests);
    }
  }, [suiteId]);

  const handleCreateTest = async () => {
    if (!newTestName.trim() || !suiteId) return;

    try {
      await TestRepository.createNew(suiteId, newTestName.trim(), newTestUrl || 'https://');
      const updatedTests = await TestRepository.getBySuite(suiteId);
      setTests(updatedTests);
      setNewTestName('');
      setNewTestUrl('');
      setIsCreating(false);
      toast.success('Test created');
    } catch (error) {
      toast.error('Failed to create test');
    }
  };

  const handleDeleteTest = async (id: string) => {
    if (!confirm('Delete this test?')) return;

    try {
      await TestRepository.delete(id);
      if (suiteId) {
        const updatedTests = await TestRepository.getBySuite(suiteId);
        setTests(updatedTests);
      }
      if (selectedTestId === id) {
        onSelectTest(null);
      }
      toast.success('Test deleted');
    } catch (error) {
      toast.error('Failed to delete test');
    }
  };

  if (!suiteId) {
    return (
      <div className="text-center py-12 text-dark-500">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Select a suite to view tests</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider">
          Tests ({tests.length})
        </h2>
        <button
          onClick={() => setIsCreating(true)}
          className="btn btn-sm btn-ghost"
        >
          <Plus className="w-4 h-4" />
          New Test
        </button>
      </div>

      {isCreating && (
        <div className="card p-3 space-y-2">
          <input
            type="text"
            placeholder="Test name"
            value={newTestName}
            onChange={(e) => setNewTestName(e.target.value)}
            className="input"
            autoFocus
          />
          <input
            type="url"
            placeholder="Starting URL (https://...)"
            value={newTestUrl}
            onChange={(e) => setNewTestUrl(e.target.value)}
            className="input"
          />
          <div className="flex gap-2">
            <button onClick={handleCreateTest} className="btn btn-sm btn-primary">
              Create
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="btn btn-sm btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tests.map((test) => (
          <div
            key={test.id}
            className={clsx(
              'card p-3 cursor-pointer transition-colors',
              selectedTestId === test.id
                ? 'ring-2 ring-accent'
                : 'hover:bg-dark-750'
            )}
            onClick={() => onSelectTest(test.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-dark-100 truncate">{test.name}</h3>
                <div className="flex items-center gap-1 text-xs text-dark-500 mt-1">
                  <Globe className="w-3 h-3" />
                  <span className="truncate">{test.url}</span>
                </div>
                <div className="text-xs text-dark-500 mt-1">
                  {test.steps.length} steps
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Run test
                    toast.success('Running test...');
                  }}
                  className="btn btn-icon btn-sm btn-ghost text-accent hover:bg-accent/20"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTest(test.id);
                  }}
                  className="btn btn-icon btn-sm btn-ghost text-dark-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {tests.length === 0 && !isCreating && (
          <div className="text-center py-8 text-dark-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No tests in this suite</p>
            <button
              onClick={() => setIsCreating(true)}
              className="btn btn-sm btn-primary mt-4"
            >
              Create your first test
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
