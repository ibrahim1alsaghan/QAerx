import type { View } from '../../App';
import { SuiteList } from '../suites/SuiteList';
import { TestList } from '../tests/TestList';
import { TestDetail } from '../tests/TestDetail';
import { ResultsList } from '../results/ResultsList';
import { SettingsPanel } from '../settings/SettingsPanel';

interface MainContentProps {
  currentView: View;
  selectedSuiteId: string | null;
  selectedTestId: string | null;
  onSelectSuite: (id: string | null) => void;
  onSelectTest: (id: string | null) => void;
}

export function MainContent({
  currentView,
  selectedSuiteId,
  selectedTestId,
  onSelectSuite,
  onSelectTest,
}: MainContentProps) {
  // Show test detail when a test is selected
  if (currentView === 'tests' && selectedTestId) {
    return (
      <main className="flex-1 overflow-hidden">
        <TestDetail
          testId={selectedTestId}
          onBack={() => onSelectTest(null)}
          onDelete={() => onSelectTest(null)}
        />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto p-4">
      {currentView === 'suites' && (
        <SuiteList
          selectedSuiteId={selectedSuiteId}
          onSelectSuite={onSelectSuite}
        />
      )}
      {currentView === 'tests' && (
        <TestList
          suiteId={selectedSuiteId}
          selectedTestId={selectedTestId}
          onSelectTest={onSelectTest}
        />
      )}
      {currentView === 'results' && <ResultsList />}
      {currentView === 'settings' && <SettingsPanel />}
    </main>
  );
}
