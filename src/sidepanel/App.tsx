import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MainContent } from './components/layout/MainContent';
import { AppProvider } from './context/AppContext';

export type View = 'suites' | 'tests' | 'results' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('suites');
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  return (
    <AppProvider>
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
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'bg-dark-800 text-dark-100 border border-dark-600',
          duration: 3000,
        }}
      />
    </AppProvider>
  );
}
