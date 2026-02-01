import { useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MainContent } from './components/layout/MainContent';
import { FloatingRecordButton } from './components/recording/FloatingRecordButton';
import { AppProvider, useApp } from './context/AppContext';

export type View = 'suites' | 'tests' | 'results' | 'settings';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('suites');
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const { refreshTests, refreshSuites } = useApp();

  // Handle test creation from FloatingRecordButton
  const handleTestCreated = useCallback(async (testId: string) => {
    await refreshSuites();
    await refreshTests();
    setCurrentView('tests');
    setSelectedTestId(testId);
  }, [refreshTests, refreshSuites]);

  // Handle steps added to existing test
  const handleStepsAdded = useCallback(async (testId: string) => {
    await refreshTests();
    setCurrentView('tests');
    setSelectedTestId(testId);
  }, [refreshTests]);

  return (
    <>
      <div className="flex h-screen bg-dark-900">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            currentView={currentView}
            selectedSuiteId={selectedSuiteId}
            selectedTestId={selectedTestId}
          />
          <MainContent
            currentView={currentView}
            selectedSuiteId={selectedSuiteId}
            selectedTestId={selectedTestId}
            onSelectSuite={setSelectedSuiteId}
            onSelectTest={setSelectedTestId}
          />
        </div>
      </div>

      {/* Floating Record Button - Always visible */}
      <FloatingRecordButton
        onTestCreated={handleTestCreated}
        onStepsAdded={handleStepsAdded}
      />

      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'bg-dark-800 text-dark-100 border border-dark-600',
          duration: 3000,
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
