import { Circle } from 'lucide-react';
import type { View } from '../../App';
import { useRecording } from '../../hooks/useRecording';
import { AIStatusIndicator } from '../ai/AIStatusIndicator';

interface HeaderProps {
  currentView: View;
  selectedSuiteId: string | null;
  selectedTestId: string | null;
  onNavigateToSettings?: () => void;
}

const viewTitles: Record<View, string> = {
  suites: 'Test Suites',
  tests: 'Tests',
  results: 'Results',
  settings: 'Settings',
};

export function Header({ currentView, onNavigateToSettings }: HeaderProps) {
  const { isRecording, steps } = useRecording();

  return (
    <header className="h-14 bg-dark-850 border-b border-dark-800 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-dark-100">
          {viewTitles[currentView]}
        </h1>
        {isRecording && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs animate-pulse">
            <Circle className="w-2 h-2 fill-current" />
            Recording ({steps.length} steps)
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* AI Status Indicator */}
        <AIStatusIndicator onConfigureClick={onNavigateToSettings} />
      </div>
    </header>
  );
}
