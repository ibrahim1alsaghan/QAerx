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
    results: Array<{ dataSetIndex: number; stepId: string; status: 'passed' | 'failed' }>;
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
      results: [],
    });

    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      // Ensure content script is loaded
      await chrome.tabs.sendMessage(tab.id, { type: 'ping' }).catch(async () => {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ['content.js'],
        });
        await new Promise((r) => setTimeout(r, 200));
      });

      // Run for each data set
      for (let dataSetIndex = 0; dataSetIndex < dataSets.length; dataSetIndex++) {
        const variables = dataSets[dataSetIndex];

        setRunProgress((prev) => prev && { ...prev, currentDataSet: dataSetIndex });

        // Navigate to test URL if specified
        if (test?.url && test.url !== 'https://') {
          let url = test.url;
          // Substitute variables in URL
          Object.entries(variables).forEach(([key, value]) => {
            url = url.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          });

          await chrome.tabs.update(tab.id, { url });
          await new Promise((r) => setTimeout(r, 2000)); // Wait for page load

          // Re-inject content script after navigation
          await chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            files: ['content.js'],
          });
          await new Promise((r) => setTimeout(r, 200));
        }

        // Execute steps
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'playback:execute',
          steps,
          variables,
          timeout: 30000,
        });

        if (response.result) {
          // Update progress with results
          response.result.stepResults.forEach((stepResult: { stepId: string; status: 'passed' | 'failed' }) => {
            setRunProgress((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                results: [...prev.results, { dataSetIndex, ...stepResult }],
              };
            });
          });
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
