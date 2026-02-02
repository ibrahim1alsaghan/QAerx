import { useState } from 'react';
import {
  FolderTree,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  Settings,
  Plus,
} from 'lucide-react';
import type { View } from '../../App';
import { useApp } from '../../context/AppContext';
import { clsx } from 'clsx';
import { LogoIcon } from '../shared/Logo';

interface SidebarProps {
  currentView: View;
  selectedSuiteId: string | null;
  selectedTestId: string | null;
  onViewChange: (view: View) => void;
  onSelectSuite: (id: string | null) => void;
  onSelectTest: (id: string | null) => void;
}

export function Sidebar({
  currentView,
  selectedSuiteId,
  selectedTestId,
  onViewChange,
  onSelectSuite,
  onSelectTest,
}: SidebarProps) {
  const { suites, tests } = useApp();
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());

  const toggleSuite = (suiteId: string) => {
    setExpandedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  };

  const handleSuiteClick = (suiteId: string) => {
    onSelectSuite(suiteId);
    onSelectTest(null);
    onViewChange('tests');
    // Auto-expand when clicking
    setExpandedSuites((prev) => new Set(prev).add(suiteId));
  };

  const handleTestClick = (testId: string, suiteId: string) => {
    onSelectSuite(suiteId);
    onSelectTest(testId);
    onViewChange('tests');
  };

  const getTestsForSuite = (suiteId: string) => {
    return tests.filter((t) => t.suiteId === suiteId);
  };

  return (
    <aside className="w-56 bg-dark-950 border-r border-dark-800 flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2.5 border-b border-dark-800">
        <LogoIcon className="w-8 h-8" />
        <span className="font-bold text-white">QAerx</span>
      </div>

      {/* Suites Section */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="nav-section flex items-center justify-between">
          <span>Test Suites</span>
          <button
            onClick={() => onViewChange('suites')}
            className="p-1 text-dark-500 hover:text-dark-300 rounded transition-colors"
            title="Manage suites"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Suite Tree */}
        <nav className="mt-1 px-2 space-y-0.5">
          {suites.map((suite) => {
            const suiteTests = getTestsForSuite(suite.id);
            const isExpanded = expandedSuites.has(suite.id);
            const isSelected = selectedSuiteId === suite.id && !selectedTestId;

            return (
              <div key={suite.id}>
                {/* Suite Item */}
                <div
                  className={clsx(
                    'tree-item group',
                    isSelected ? 'tree-item-active' : 'tree-item-default'
                  )}
                >
                  <button
                    onClick={() => toggleSuite(suite.id)}
                    className="p-0.5 -ml-1 text-dark-500 hover:text-dark-300"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <FolderTree className="w-4 h-4 text-dark-500 flex-shrink-0" />
                  <span
                    onClick={() => handleSuiteClick(suite.id)}
                    className="flex-1 truncate"
                  >
                    {suite.name}
                  </span>
                  <span className="text-xs text-dark-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {suiteTests.length}
                  </span>
                </div>

                {/* Tests under Suite */}
                {isExpanded && suiteTests.length > 0 && (
                  <div className="ml-4 pl-3 border-l border-dark-800 space-y-0.5 mt-0.5">
                    {suiteTests.map((test) => {
                      const isTestSelected = selectedTestId === test.id;
                      return (
                        <div
                          key={test.id}
                          onClick={() => handleTestClick(test.id, suite.id)}
                          className={clsx(
                            'tree-item',
                            isTestSelected ? 'tree-item-active' : 'tree-item-default'
                          )}
                        >
                          <FileText className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" />
                          <span className="truncate text-xs">{test.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {suites.length === 0 && (
            <div className="px-3 py-4 text-xs text-dark-500 text-center">
              No test suites yet
            </div>
          )}
        </nav>

        {/* Divider */}
        <div className="my-4 mx-4 border-t border-dark-800" />

        {/* Results & Settings */}
        <nav className="px-2 space-y-0.5">
          <div
            onClick={() => {
              onViewChange('results');
              onSelectTest(null);
            }}
            className={clsx(
              'nav-item',
              currentView === 'results' ? 'nav-item-active' : 'nav-item-default'
            )}
          >
            <History className="w-4 h-4" />
            <span>Results</span>
          </div>

          <div
            onClick={() => {
              onViewChange('settings');
              onSelectTest(null);
            }}
            className={clsx(
              'nav-item',
              currentView === 'settings' ? 'nav-item-active' : 'nav-item-default'
            )}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </div>
        </nav>
      </div>

      {/* Version */}
      <div className="px-4 py-3 border-t border-dark-800 text-[11px] text-dark-600">
        QAerx v0.1.0
      </div>
    </aside>
  );
}
