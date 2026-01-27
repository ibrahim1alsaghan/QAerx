import { Circle, Square } from 'lucide-react';
import type { View } from '../../App';
import { useRecording } from '../../hooks/useRecording';
import { clsx } from 'clsx';

interface HeaderProps {
  currentView: View;
  selectedSuiteId: string | null;
  selectedTestId: string | null;
}

const viewTitles: Record<View, string> = {
  suites: 'Test Suites',
  tests: 'Tests',
  results: 'Results',
  settings: 'Settings',
};

export function Header({ currentView }: HeaderProps) {
  const { isRecording, startRecording, stopRecording } = useRecording();

  return (
    <header className="h-14 bg-dark-850 border-b border-dark-800 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-dark-100">
          {viewTitles[currentView]}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {isRecording ? (
          <button
            onClick={stopRecording}
            className="btn btn-sm bg-red-600 hover:bg-red-700 text-white"
          >
            <Square className="w-3 h-3 fill-current" />
            Stop Recording
          </button>
        ) : (
          <button
            onClick={startRecording}
            className="btn btn-sm btn-primary"
          >
            <Circle className={clsx('w-3 h-3', isRecording && 'fill-current animate-pulse')} />
            Record
          </button>
        )}
      </div>
    </header>
  );
}
