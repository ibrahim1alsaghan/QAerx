import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Save, Loader2, CheckCircle, XCircle, Database, ListChecks } from 'lucide-react';
import { TestRepository } from '@/core/storage/repositories';
import { StepEditor } from '../steps/StepEditor';
import { DataPanel } from '../data/DataPanel';
import type { Test, UIStep } from '@/types/test';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface TestDetailProps {
  testId: string;
  onBack: () => void;
}

type TabType = 'steps' | 'data';

export function TestDetail({ testId, onBack }: TestDetailProps) {
  const [test, setTest] = useState<Test | null>(null);
  const [steps, setSteps] = useState<UIStep[]>([]);
  const [dataSets, setDataSets] = useState<Record<string, string>[]>([{}]);
  const [activeTab, setActiveTab] = useState<TabType>('steps');
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<{
    currentStep: number;
    total: number;
    currentDataSet: number;
    totalDataSets: number;
    currentStepId: string | null;
    results: Array<{ dataSetIndex: number; stepId: string; status: 'passed' | 'failed'; error?: string; duration?: number }>;
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    TestRepository.getById(testId).then((t) => {
      if (t) {
        setTest(t);
        setSteps(t.steps as UIStep[]);
        setDataSets(t.dataSource?.data as Record<string, string>[] || [{}]);
      }
    });
  }, [testId]);

  const handleStepsChange = (newSteps: UIStep[]) => {
    setSteps(newSteps);
    setHasChanges(true);
  };

  const handleDataSetsChange = (newDataSets: Record<string, string>[]) => {
    setDataSets(newDataSets);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!test) return;

    try {
      await TestRepository.update(testId, {
        steps,
        dataSource: {
          type: 'manual',
          data: dataSets,
        },
      });
      setHasChanges(false);
      toast.success('Test saved');
    } catch (error) {
      toast.error('Failed to save test');
    }
  };

  const handleRun = async () => {
    if (steps.length === 0) {
      toast.error('Add at least one step before running');
      return;
    }

    setIsRunning(true);
    setRunProgress({
      currentStep: 0,
      total: steps.length,
      currentDataSet: 0,
      totalDataSets: dataSets.length,
      currentStepId: null,
      results: [],
    });

    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      // Helper to ensure content script is loaded
      const ensureContentScript = async () => {
        try {
          await chrome.tabs.sendMessage(tab.id!, { type: 'ping' });
        } catch {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            files: ['content.js'],
          });
          await new Promise((r) => setTimeout(r, 300));
        }
      };

      // Run for each data set
      for (let dataSetIndex = 0; dataSetIndex < dataSets.length; dataSetIndex++) {
        const variables = dataSets[dataSetIndex];
        setRunProgress((prev) => prev && { ...prev, currentDataSet: dataSetIndex });

        // Navigate to initial test URL if specified
        if (test?.url && test.url !== 'https://') {
          let url = test.url;
          Object.entries(variables).forEach(([key, value]) => {
            url = url.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          });
          await chrome.tabs.update(tab.id, { url });
          await new Promise((r) => setTimeout(r, 2500));
          await ensureContentScript();
        }

        // Listen for step progress
        const progressListener = (message: { type: string; stepId: string; index: number }) => {
          if (message.type === 'playback:step-start') {
            setRunProgress((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                currentStepId: message.stepId,
                currentStep: message.index,
              };
            });
          }
        };

        chrome.runtime.onMessage.addListener(progressListener);

        try {
          // Process steps, handling navigation separately
          let currentSteps: UIStep[] = [];

          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];

            // If this is a navigate or waitTime action, handle it from sidepanel (not content script)
            if (step.action.type === 'navigate' || step.action.type === 'waitTime') {
              // First, execute any accumulated steps before this navigation
              if (currentSteps.length > 0) {
                try {
                  const response = await chrome.tabs.sendMessage(tab.id, {
                    type: 'playback:execute',
                    steps: currentSteps,
                    variables,
                    timeout: 30000,
                  });

                  if (response?.result?.stepResults) {
                    response.result.stepResults.forEach((stepResult: { stepId: string; status: 'passed' | 'failed'; error?: string; duration?: number }) => {
                      setRunProgress((prev) => {
                        if (!prev) return null;
                        return {
                          ...prev,
                          results: [...prev.results, { dataSetIndex, ...stepResult }],
                        };
                      });
                    });
                  }
                } catch (error) {
                  console.error('Error executing steps before navigation:', error);
                  throw new Error(`Step execution failed: ${error instanceof Error ? error.message : String(error)}`);
                }
                currentSteps = [];
              }

              // Mark step as in progress
              setRunProgress((prev) => {
                if (!prev) return null;
                return { ...prev, currentStepId: step.id, currentStep: i };
              });

              try {
                const startTime = Date.now();

                if (step.action.type === 'navigate') {
                  // Perform navigation from sidepanel
                  const navAction = step.action as { url: string };
                  let url = navAction.url;
                  Object.entries(variables).forEach(([key, value]) => {
                    url = url.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                  });

                  await chrome.tabs.update(tab.id, { url });

                  // Wait for page load with timeout
                  await new Promise<void>((resolve) => {
                    let loaded = false;
                    const loadTimeout = setTimeout(() => {
                      if (!loaded) {
                        loaded = true;
                        resolve(); // Don't fail, just continue
                      }
                    }, 8000); // Increased timeout to 8 seconds

                    const listener = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
                      if (tabId === tab.id && info.status === 'complete' && !loaded) {
                        loaded = true;
                        clearTimeout(loadTimeout);
                        chrome.tabs.onUpdated.removeListener(listener);
                        setTimeout(() => resolve(), 500); // Small buffer after load
                      }
                    };

                    chrome.tabs.onUpdated.addListener(listener);

                    // Cleanup listener after timeout
                    setTimeout(() => {
                      chrome.tabs.onUpdated.removeListener(listener);
                    }, 8500);
                  });

                  await ensureContentScript();
                } else if (step.action.type === 'waitTime') {
                  // Perform wait from sidepanel (not content script to avoid bfcache issues)
                  const waitAction = step.action as { duration: number };
                  await new Promise((resolve) => setTimeout(resolve, waitAction.duration));
                }

                const duration = Date.now() - startTime;

                // Mark step as passed
                setRunProgress((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    currentStepId: null,
                    results: [...prev.results, { dataSetIndex, stepId: step.id, status: 'passed' as const, duration }],
                  };
                });
              } catch (error) {
                // Mark step as failed
                setRunProgress((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    currentStepId: null,
                    results: [...prev.results, {
                      dataSetIndex,
                      stepId: step.id,
                      status: 'failed' as const,
                      error: `${step.action.type === 'navigate' ? 'Navigation' : 'Wait'} failed: ${error instanceof Error ? error.message : String(error)}`,
                      duration: 0
                    }],
                  };
                });
                throw error;
              }
            } else {
              // Accumulate non-navigate steps to execute together
              currentSteps.push(step);
            }
          }

          // Execute any remaining non-navigate steps
          if (currentSteps.length > 0) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id, {
                type: 'playback:execute',
                steps: currentSteps,
                variables,
                timeout: 30000,
              });

              if (response?.result?.stepResults) {
                response.result.stepResults.forEach((stepResult: { stepId: string; status: 'passed' | 'failed'; error?: string; duration?: number }) => {
                  setRunProgress((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      results: [...prev.results, { dataSetIndex, ...stepResult }],
                    };
                  });
                });
              }
            } catch (error) {
              console.error('Error executing remaining steps:', error);
              throw new Error(`Step execution failed: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        } finally {
          chrome.runtime.onMessage.removeListener(progressListener);
        }
      }

      toast.success('Test completed!');
    } catch (error) {
      console.error('Test execution error:', error);
      toast.error('Test execution failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsRunning(false);
    }
  };

  if (!test) {
    return (
      <div className="flex items-center justify-center h-full text-dark-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const passedCount = runProgress?.results.filter((r) => r.status === 'passed').length || 0;
  const failedCount = runProgress?.results.filter((r) => r.status === 'failed').length || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-800">
        <button onClick={onBack} className="btn btn-icon btn-sm btn-ghost">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-medium text-dark-100 truncate">{test.name}</h2>
          <p className="text-xs text-dark-500 truncate">{test.url}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button onClick={handleSave} className="btn btn-sm btn-ghost">
              <Save className="w-4 h-4" />
              Save
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="btn btn-sm btn-primary"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Test
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {runProgress && (
        <div className="px-4 py-2 bg-dark-850 border-b border-dark-800">
          <div className="flex items-center justify-between text-xs text-dark-400 mb-1">
            <span>
              Data Set {runProgress.currentDataSet + 1}/{runProgress.totalDataSets}
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="w-3 h-3" /> {passedCount}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-3 h-3" /> {failedCount}
              </span>
            </div>
          </div>
          <div className="h-1 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{
                width: `${((runProgress.currentDataSet * steps.length + runProgress.results.length) / (runProgress.totalDataSets * steps.length)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-dark-800">
        <button
          onClick={() => setActiveTab('steps')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'steps'
              ? 'text-accent border-b-2 border-accent'
              : 'text-dark-400 hover:text-dark-200'
          )}
        >
          <ListChecks className="w-4 h-4" />
          Steps ({steps.length})
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'data'
              ? 'text-accent border-b-2 border-accent'
              : 'text-dark-400 hover:text-dark-200'
          )}
        >
          <Database className="w-4 h-4" />
          Data ({dataSets.length} sets)
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'steps' ? (
          <StepEditor
            steps={steps}
            onStepsChange={handleStepsChange}
            currentStepId={runProgress?.currentStepId}
            stepResults={runProgress?.results}
          />
        ) : (
          <DataPanel
            dataSets={dataSets}
            onDataSetsChange={handleDataSetsChange}
          />
        )}
      </div>
    </div>
  );
}
