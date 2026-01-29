import { useState } from 'react';
import { Circle, Square, Save, X } from 'lucide-react';
import type { View } from '../../App';
import { useRecording } from '../../hooks/useRecording';
import { TestRepository } from '@/core/storage/repositories';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface HeaderProps {
  currentView: View;
  selectedSuiteId: string | null;
  selectedTestId: string | null;
  onRecordingComplete?: (steps: any[]) => void;
}

const viewTitles: Record<View, string> = {
  suites: 'Test Suites',
  tests: 'Tests',
  results: 'Results',
  settings: 'Settings',
};

export function Header({ currentView, selectedTestId, onRecordingComplete }: HeaderProps) {
  const { isRecording, steps, startRecording, stopRecording } = useRecording();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState<any[]>([]);

  const handleStartRecording = async () => {
    await startRecording();
  };

  const handleStopRecording = async () => {
    const capturedSteps = await stopRecording();
    if (capturedSteps && capturedSteps.length > 0) {
      setRecordedSteps(capturedSteps);
      setShowSaveModal(true);
    } else {
      toast.error('No steps were recorded');
    }
  };

  const handleSaveToCurrentTest = async () => {
    if (!selectedTestId) {
      toast.error('No test selected. Please select a test first.');
      return;
    }

    try {
      const test = await TestRepository.getById(selectedTestId);
      if (test) {
        const updatedSteps = [...(test.steps || []), ...recordedSteps];
        await TestRepository.update(selectedTestId, { steps: updatedSteps });
        toast.success(`Added ${recordedSteps.length} steps to test`);
        onRecordingComplete?.(recordedSteps);
      }
    } catch (error) {
      toast.error('Failed to save recording');
    }
    setShowSaveModal(false);
    setRecordedSteps([]);
  };

  const handleDiscardRecording = () => {
    setShowSaveModal(false);
    setRecordedSteps([]);
    toast.success('Recording discarded');
  };

  return (
    <>
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
          {isRecording ? (
            <button
              onClick={handleStopRecording}
              className="btn btn-sm bg-red-600 hover:bg-red-700 text-white"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop Recording
            </button>
          ) : (
            <button
              onClick={handleStartRecording}
              className="btn btn-sm btn-primary"
            >
              <Circle className={clsx('w-3 h-3', isRecording && 'fill-current animate-pulse')} />
              Record
            </button>
          )}
        </div>
      </header>

      {/* Save Recording Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-dark-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
              <h3 className="text-lg font-semibold text-dark-100">Save Recording</h3>
              <button
                onClick={handleDiscardRecording}
                className="p-1 hover:bg-dark-700 rounded"
              >
                <X className="w-5 h-5 text-dark-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-dark-300">
                Recorded <span className="font-semibold text-accent">{recordedSteps.length}</span> steps.
                What would you like to do?
              </p>

              {/* Preview steps */}
              <div className="max-h-40 overflow-auto bg-dark-850 rounded-lg p-2 space-y-1">
                {recordedSteps.slice(0, 5).map((step, index) => (
                  <div key={step.id} className="text-sm text-dark-400 flex items-center gap-2">
                    <span className="text-dark-500 w-4">{index + 1}.</span>
                    <span>{step.name}</span>
                  </div>
                ))}
                {recordedSteps.length > 5 && (
                  <div className="text-xs text-dark-500 text-center pt-1">
                    +{recordedSteps.length - 5} more steps
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {selectedTestId && (
                  <button
                    onClick={handleSaveToCurrentTest}
                    className="btn btn-primary w-full justify-center"
                  >
                    <Save className="w-4 h-4" />
                    Add to Current Test
                  </button>
                )}
                <button
                  onClick={handleDiscardRecording}
                  className="btn btn-ghost w-full justify-center text-dark-400"
                >
                  Discard Recording
                </button>
              </div>

              {!selectedTestId && (
                <p className="text-xs text-dark-500 text-center">
                  Select a test first to save recording, or discard and create steps manually.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
