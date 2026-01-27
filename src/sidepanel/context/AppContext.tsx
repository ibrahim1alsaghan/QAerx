import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Suite, Test } from '@/types/test';
import type { Settings } from '@/types/settings';
import { SuiteRepository, TestRepository, SettingsRepository } from '@/core/storage/repositories';

interface AppState {
  suites: Suite[];
  tests: Test[];
  settings: Settings | null;
  isLoading: boolean;
  refreshSuites: () => Promise<void>;
  refreshTests: (suiteId?: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSuites = async () => {
    const data = await SuiteRepository.getAll();
    setSuites(data);
  };

  const refreshTests = async (suiteId?: string) => {
    const data = suiteId
      ? await TestRepository.getBySuite(suiteId)
      : await TestRepository.getAll();
    setTests(data);
  };

  const refreshSettings = async () => {
    const data = await SettingsRepository.get();
    setSettings(data);
  };

  useEffect(() => {
    const init = async () => {
      try {
        console.log('AppContext init starting...');
        setIsLoading(true);
        await Promise.all([refreshSuites(), refreshTests(), refreshSettings()]);
        console.log('Initial data loaded');

        // Create default suite if none exist
        const allSuites = await SuiteRepository.getAll();
        console.log('All suites:', allSuites);
        if (allSuites.length === 0) {
          console.log('Creating default suite...');
          await SuiteRepository.createDefault();
          await refreshSuites();
        }

        setIsLoading(false);
        console.log('AppContext init complete');
      } catch (error) {
        console.error('AppContext init error:', error);
        setIsLoading(false);
      }
    };

    init();
  }, []);

  return (
    <AppContext.Provider
      value={{
        suites,
        tests,
        settings,
        isLoading,
        refreshSuites,
        refreshTests,
        refreshSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
