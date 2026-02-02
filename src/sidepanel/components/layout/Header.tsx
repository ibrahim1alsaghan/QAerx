import { Circle, ChevronRight } from 'lucide-react';
import type { View } from '../../App';
import { useRecording } from '../../hooks/useRecording';
import { useApp } from '../../context/AppContext';
import { AIStatusIndicator } from '../ai/AIStatusIndicator';

interface HeaderProps {
  currentView: View;
  selectedSuiteId: string | null;
  selectedTestId: string | null;
  onNavigateToSettings?: () => void;
  onNavigateToSuites?: () => void;
  onNavigateToTests?: () => void;
}

export function Header({
  currentView,
  selectedSuiteId,
  selectedTestId,
  onNavigateToSettings,
  onNavigateToSuites: _onNavigateToSuites,
  onNavigateToTests,
}: HeaderProps) {
  const { isRecording, steps } = useRecording();
  const { suites, tests } = useApp();

  // Get current suite and test names
  const currentSuite = selectedSuiteId
    ? suites.find((s) => s.id === selectedSuiteId)
    : null;
  const currentTest = selectedTestId
    ? tests.find((t) => t.id === selectedTestId)
    : null;

  // Build breadcrumb based on current state
  const renderBreadcrumb = () => {
    // Settings view
    if (currentView === 'settings') {
      return <span className="breadcrumb-current">Settings</span>;
    }

    // Results view
    if (currentView === 'results') {
      return <span className="breadcrumb-current">Test Results</span>;
    }

    // Suites view (managing suites)
    if (currentView === 'suites') {
      return <span className="breadcrumb-current">Manage Suites</span>;
    }

    // Tests view - show suite > test path
    if (currentView === 'tests') {
      return (
        <>
          {currentSuite && (
            <>
              <span
                className="breadcrumb-item"
                onClick={onNavigateToTests}
              >
                {currentSuite.name}
              </span>
              {currentTest && (
                <>
                  <ChevronRight className="breadcrumb-separator w-4 h-4" />
                  <span className="breadcrumb-current">{currentTest.name}</span>
                </>
              )}
            </>
          )}
          {!currentSuite && (
            <span className="breadcrumb-current">Tests</span>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <header className="h-12 bg-dark-900 border-b border-dark-800/50 px-5 flex items-center justify-between">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        {renderBreadcrumb()}
      </div>

      {/* Right side - Recording indicator and AI status */}
      <div className="flex items-center gap-3">
        {isRecording && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 text-red-400 rounded-full text-xs animate-pulse">
            <Circle className="w-2 h-2 fill-current" />
            Recording ({steps.length})
          </span>
        )}
        <AIStatusIndicator onConfigureClick={onNavigateToSettings} />
      </div>
    </header>
  );
}
