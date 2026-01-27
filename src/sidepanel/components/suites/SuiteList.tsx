import { useState } from 'react';
import { FolderPlus, Folder, ChevronRight, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SuiteRepository } from '@/core/storage/repositories';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface SuiteListProps {
  selectedSuiteId: string | null;
  onSelectSuite: (id: string | null) => void;
}

export function SuiteList({ selectedSuiteId, onSelectSuite }: SuiteListProps) {
  const { suites, refreshSuites } = useApp();
  const [isCreating, setIsCreating] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState('');

  const handleCreateSuite = async () => {
    if (!newSuiteName.trim()) return;

    try {
      await SuiteRepository.create({
        name: newSuiteName.trim(),
        order: suites.length,
        hooks: {},
      });
      await refreshSuites();
      setNewSuiteName('');
      setIsCreating(false);
      toast.success('Suite created');
    } catch (error) {
      console.error('Suite creation error:', error);
      toast.error('Failed to create suite: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDeleteSuite = async (id: string) => {
    if (!confirm('Delete this suite and all its tests?')) return;

    try {
      await SuiteRepository.delete(id);
      await refreshSuites();
      if (selectedSuiteId === id) {
        onSelectSuite(null);
      }
      toast.success('Suite deleted');
    } catch (error) {
      toast.error('Failed to delete suite');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider">
          Suites ({suites.length})
        </h2>
        <button
          onClick={() => setIsCreating(true)}
          className="btn btn-sm btn-ghost"
        >
          <FolderPlus className="w-4 h-4" />
          New Suite
        </button>
      </div>

      {isCreating && (
        <div className="card p-3">
          <input
            type="text"
            placeholder="Suite name"
            value={newSuiteName}
            onChange={(e) => setNewSuiteName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSuite();
              if (e.key === 'Escape') setIsCreating(false);
            }}
            className="input mb-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={handleCreateSuite} className="btn btn-sm btn-primary">
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

      <div className="space-y-1">
        {suites.map((suite) => (
          <div
            key={suite.id}
            className={clsx(
              'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
              selectedSuiteId === suite.id
                ? 'bg-accent/20 text-accent'
                : 'hover:bg-dark-800 text-dark-200'
            )}
            onClick={() => onSelectSuite(suite.id)}
          >
            <Folder className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">{suite.name}</span>
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSuite(suite.id);
              }}
              className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        {suites.length === 0 && !isCreating && (
          <div className="text-center py-8 text-dark-500">
            <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No test suites yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="btn btn-sm btn-primary mt-4"
            >
              Create your first suite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
