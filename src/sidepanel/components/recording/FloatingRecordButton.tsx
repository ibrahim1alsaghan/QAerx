import { useState, useEffect } from 'react';
import { Circle, Square, Save, X, Plus, FolderPlus } from 'lucide-react';
import { useRecording } from '../../hooks/useRecording';
import { TestRepository, SuiteRepository } from '@/core/storage/repositories';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import type { Test, Suite } from '@/types/test';

interface FloatingRecordButtonProps {
  onTestCreated?: (testId: string) => void;
  onStepsAdded?: (testId: string) => void;
}

export function FloatingRecordButton({ onTestCreated, onStepsAdded }: FloatingRecordButtonProps) {
  const { isRecording, steps, startRecording, stopRecording } = useRecording();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState<any[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [newTestName, setNewTestName] = useState('');
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new');
  const [isCreating, setIsCreating] = useState(false);

  // Load suites and tests
  useEffect(() => {
    const loadData = async () => {
      const allSuites = await SuiteRepository.getAll();
      setSuites(allSuites);
      if (allSuites.length > 0 && !selectedSuiteId) {
        setSelectedSuiteId(allSuites[0].id);
      }
    };
    loadData();
  }, []);

  // Load tests when suite changes
  useEffect(() => {
    const loadTests = async () => {
      if (selectedSuiteId) {
        const suiteTests = await TestRepository.getBySuite(selectedSuiteId);
        setTests(suiteTests);
      }
    };
    loadTests();
  }, [selectedSuiteId]);

  const handleStartRecording = async () => {
    await startRecording();
  };

  const handleStopRecording = async () => {
    const capturedSteps = await stopRecording();
    if (capturedSteps && capturedSteps.length > 0) {
      setRecordedSteps(capturedSteps);
      setShowSaveModal(true);
      // Default test name from page title or timestamp
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const pageTitle = tabs[0]?.title || 'Recorded Test';
      setNewTestName(`${pageTitle.substring(0, 30)} - ${new Date().toLocaleTimeString()}`);
    } else {
      toast.error('No steps were recorded');
    }
  };

  const handleSaveAsNewTest = async () => {
    if (!selectedSuiteId || !newTestName.trim()) {
      toast.error('Please enter a test name');
      return;
    }

    setIsCreating(true);
    try {
      // Get current URL
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = tabs[0]?.url || 'https://';

      // Create new test with recorded steps
      const newTest = await TestRepository.createNew(
        selectedSuiteId,
        newTestName.trim(),
        currentUrl
      );

      // Update with recorded steps
      await TestRepository.update(newTest.id, { steps: recordedSteps });

      toast.success(`Created test "${newTestName}" with ${recordedSteps.length} steps`);
      onTestCreated?.(newTest.id);
      handleClose();
    } catch (error) {
      toast.error('Failed to create test');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddToExistingTest = async () => {
    if (!selectedTestId) {
      toast.error('Please select a test');
      return;
    }

    setIsCreating(true);
    try {
      const test = await TestRepository.getById(selectedTestId);
      if (test) {
        const updatedSteps = [...(test.steps || []), ...recordedSteps];
        await TestRepository.update(selectedTestId, { steps: updatedSteps });
        toast.success(`Added ${recordedSteps.length} steps to "${test.name}"`);
        onStepsAdded?.(selectedTestId);
        handleClose();
      }
    } catch (error) {
      toast.error('Failed to add steps to test');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setShowSaveModal(false);
    setRecordedSteps([]);
    setNewTestName('');
    setSaveMode('new');
    setSelectedTestId(null);
  };

  return (
    <>
      {/* Floating Record Button */}
      <div className="fixed bottom-4 right-4 z-40">
        {isRecording ? (
          <button
            onClick={handleStopRecording}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all',
              'bg-red-600 hover:bg-red-700 text-white',
              'animate-pulse'
            )}
          >
            <Square className="w-4 h-4 fill-current" />
            <span className="font-medium">Stop ({steps.length})</span>
          </button>
        ) : (
          <button
            onClick={handleStartRecording}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all',
              'bg-accent hover:bg-accent/90 text-white',
              'hover:scale-105'
            )}
          >
            <Circle className="w-4 h-4" />
            <span className="font-medium">Record</span>
          </button>
        )}
      </div>

      {/* Save Recording Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl shadow-2xl w-full max-w-md border border-dark-700">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
              <h3 className="text-lg font-semibold text-dark-100">Save Recording</h3>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-dark-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-dark-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Recording summary */}
              <div className="flex items-center gap-3 p-3 bg-accent/10 rounded-lg border border-accent/30">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Circle className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-100">
                    {recordedSteps.length} steps recorded
                  </p>
                  <p className="text-xs text-dark-400">Ready to save</p>
                </div>
              </div>

              {/* Steps preview */}
              <div className="max-h-32 overflow-auto bg-dark-850 rounded-lg p-2 space-y-1">
                {recordedSteps.slice(0, 5).map((step, index) => (
                  <div key={step.id} className="text-sm text-dark-400 flex items-center gap-2">
                    <span className="text-dark-500 w-5 text-right">{index + 1}.</span>
                    <span className="truncate">{step.name}</span>
                  </div>
                ))}
                {recordedSteps.length > 5 && (
                  <div className="text-xs text-dark-500 text-center pt-1">
                    +{recordedSteps.length - 5} more steps
                  </div>
                )}
              </div>

              {/* Save mode tabs */}
              <div className="flex rounded-lg bg-dark-850 p-1">
                <button
                  onClick={() => setSaveMode('new')}
                  className={clsx(
                    'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    saveMode === 'new'
                      ? 'bg-accent text-white'
                      : 'text-dark-400 hover:text-dark-200'
                  )}
                >
                  <Plus className="w-4 h-4" />
                  New Test
                </button>
                <button
                  onClick={() => setSaveMode('existing')}
                  className={clsx(
                    'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    saveMode === 'existing'
                      ? 'bg-accent text-white'
                      : 'text-dark-400 hover:text-dark-200'
                  )}
                >
                  <FolderPlus className="w-4 h-4" />
                  Existing Test
                </button>
              </div>

              {/* New Test Form */}
              {saveMode === 'new' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">
                      Suite
                    </label>
                    <select
                      value={selectedSuiteId || ''}
                      onChange={(e) => setSelectedSuiteId(e.target.value)}
                      className="input w-full"
                    >
                      {suites.map((suite) => (
                        <option key={suite.id} value={suite.id}>
                          {suite.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">
                      Test Name
                    </label>
                    <input
                      type="text"
                      value={newTestName}
                      onChange={(e) => setNewTestName(e.target.value)}
                      placeholder="Enter test name..."
                      className="input w-full"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={handleSaveAsNewTest}
                    disabled={isCreating || !newTestName.trim()}
                    className="btn btn-primary w-full justify-center"
                  >
                    {isCreating ? (
                      <span className="animate-pulse">Creating...</span>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Create Test
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Existing Test Form */}
              {saveMode === 'existing' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">
                      Suite
                    </label>
                    <select
                      value={selectedSuiteId || ''}
                      onChange={(e) => {
                        setSelectedSuiteId(e.target.value);
                        setSelectedTestId(null);
                      }}
                      className="input w-full"
                    >
                      {suites.map((suite) => (
                        <option key={suite.id} value={suite.id}>
                          {suite.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">
                      Test
                    </label>
                    <select
                      value={selectedTestId || ''}
                      onChange={(e) => setSelectedTestId(e.target.value)}
                      className="input w-full"
                      disabled={tests.length === 0}
                    >
                      <option value="">Select a test...</option>
                      {tests.map((test) => (
                        <option key={test.id} value={test.id}>
                          {test.name} ({(test.steps?.length || 0)} steps)
                        </option>
                      ))}
                    </select>
                    {tests.length === 0 && (
                      <p className="text-xs text-dark-500 mt-1">
                        No tests in this suite. Create a new test instead.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleAddToExistingTest}
                    disabled={isCreating || !selectedTestId}
                    className="btn btn-primary w-full justify-center"
                  >
                    {isCreating ? (
                      <span className="animate-pulse">Adding...</span>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Add to Test
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Discard option */}
              <button
                onClick={handleClose}
                className="btn btn-ghost w-full justify-center text-dark-400 text-sm"
              >
                Discard Recording
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
