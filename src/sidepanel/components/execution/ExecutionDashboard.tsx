import { useState, useEffect } from 'react';
import {
  Square,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  ChevronRight,
  AlertTriangle,
  Bot,
  MousePointer,
  Type,
  Navigation,
  List,
  Eye,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { UIStep, ScenarioType } from '@/types/test';
import type { AIValidationData } from '@/types/validation';

interface StepResult {
  dataSetIndex: number;
  stepId: string;
  status: 'passed' | 'failed';
  error?: string;
  duration?: number;
  pageResponse?: string;
  aiValidation?: AIValidationData;
}

interface ExecutionProgress {
  currentStep: number;
  total: number;
  currentDataSet: number;
  totalDataSets: number;
  currentStepId: string | null;
  results: StepResult[];
}

interface ExecutionDashboardProps {
  testName: string;
  steps: UIStep[];
  dataSets: Record<string, string>[];
  dataSetScenarios?: ScenarioType[];
  progress: ExecutionProgress | null;
  isRunning: boolean;
  onStop?: () => void;
  onAnalyzeFailure?: (step: UIStep, error: string) => void;
}

const SCENARIO_LABELS: Record<ScenarioType, { label: string; color: string }> = {
  'best-case': { label: 'Best Case', color: 'text-green-400 bg-green-500/20' },
  'worst-case': { label: 'Worst Case', color: 'text-red-400 bg-red-500/20' },
  'edge-case': { label: 'Edge Case', color: 'text-yellow-400 bg-yellow-500/20' },
  'boundary': { label: 'Boundary', color: 'text-purple-400 bg-purple-500/20' },
  'normal': { label: 'Normal', color: 'text-blue-400 bg-blue-500/20' },
};

export function ExecutionDashboard({
  testName,
  steps,
  dataSets,
  dataSetScenarios,
  progress,
  isRunning,
  onStop,
  onAnalyzeFailure,
}: ExecutionDashboardProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(() => Date.now());
  const [expandedError, setExpandedError] = useState<string | null>(null);

  // Update elapsed time every second
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  if (!progress) return null;

  const passedCount = progress.results.filter((r) => r.status === 'passed').length;
  const failedCount = progress.results.filter((r) => r.status === 'failed').length;
  const totalSteps = steps.length * dataSets.length;
  const completedSteps = progress.results.length;
  const progressPercent = (completedSteps / totalSteps) * 100;

  // Get step results for current data set
  const currentDataSetResults = progress.results.filter(
    (r) => r.dataSetIndex === progress.currentDataSet
  );

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get step icon based on action type
  const getStepIcon = (actionType: string) => {
    switch (actionType) {
      case 'navigate':
        return Navigation;
      case 'click':
      case 'dblclick':
        return MousePointer;
      case 'type':
        return Type;
      case 'select':
        return List;
      case 'waitForElement':
      case 'waitTime':
        return Clock;
      default:
        return Eye;
    }
  };

  // Get step status for current data set
  const getStepStatus = (step: UIStep) => {
    const result = currentDataSetResults.find((r) => r.stepId === step.id);
    if (result) return result.status;
    if (progress.currentStepId === step.id) return 'running';
    return 'pending';
  };

  // Get current scenario label if available
  const currentScenario = dataSetScenarios?.[progress.currentDataSet];
  const scenarioInfo = currentScenario ? SCENARIO_LABELS[currentScenario] : null;

  return (
    <div className="bg-dark-850 rounded-xl border border-dark-700 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 bg-dark-800 border-b border-dark-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRunning ? (
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-accent animate-spin" />
            </div>
          ) : failedCount > 0 ? (
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-dark-100">
              {isRunning ? 'Running' : failedCount > 0 ? 'Failed' : 'Completed'}: {testName}
            </h3>
            <p className="text-xs text-dark-500">
              Data Set {progress.currentDataSet + 1}/{progress.totalDataSets}
              {scenarioInfo && (
                <span className={clsx('ml-2 px-1.5 py-0.5 rounded text-[10px]', scenarioInfo.color)}>
                  {scenarioInfo.label}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-dark-400">{formatTime(elapsedTime)}</span>
          {isRunning && onStop && (
            <button
              onClick={onStop}
              className="btn btn-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3 border-b border-dark-700/50">
        <div className="flex items-center justify-between text-xs text-dark-400 mb-2">
          <span>
            Step {Math.min(progress.currentStep + 1, steps.length)}/{steps.length}
          </span>
          <span>{Math.round(progressPercent)}% complete</span>
        </div>
        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full transition-all duration-300',
              failedCount > 0 ? 'bg-gradient-to-r from-green-500 to-red-500' : 'bg-accent'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step Timeline */}
      <div className="p-4 max-h-64 overflow-auto">
        <div className="space-y-1">
          {steps.map((step, index) => {
            const status = getStepStatus(step);
            const result = currentDataSetResults.find((r) => r.stepId === step.id);
            const Icon = getStepIcon(step.action.type);

            return (
              <div key={step.id}>
                <div
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                    status === 'running' && 'bg-blue-500/10 border border-blue-500/30',
                    status === 'passed' && 'bg-green-500/5',
                    status === 'failed' && 'bg-red-500/5',
                    status === 'pending' && 'opacity-50'
                  )}
                >
                  {/* Status Icon */}
                  <div className="w-5 h-5 flex items-center justify-center">
                    {status === 'running' && (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    )}
                    {status === 'passed' && <CheckCircle className="w-4 h-4 text-green-400" />}
                    {status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                    {status === 'pending' && (
                      <div className="w-2 h-2 rounded-full bg-dark-600" />
                    )}
                  </div>

                  {/* Step Number */}
                  <span
                    className={clsx(
                      'text-xs font-medium w-5',
                      status === 'running' && 'text-blue-400',
                      status === 'passed' && 'text-green-400',
                      status === 'failed' && 'text-red-400',
                      status === 'pending' && 'text-dark-600'
                    )}
                  >
                    {index + 1}
                  </span>

                  {/* Step Icon */}
                  <Icon
                    className={clsx(
                      'w-3.5 h-3.5',
                      status === 'running' && 'text-blue-400',
                      status === 'passed' && 'text-dark-400',
                      status === 'failed' && 'text-dark-400',
                      status === 'pending' && 'text-dark-600'
                    )}
                  />

                  {/* Step Name */}
                  <span
                    className={clsx(
                      'flex-1 text-sm truncate',
                      status === 'running' && 'text-blue-300',
                      status === 'passed' && 'text-dark-300',
                      status === 'failed' && 'text-dark-300',
                      status === 'pending' && 'text-dark-600'
                    )}
                  >
                    {step.name}
                  </span>

                  {/* Duration */}
                  {result?.duration && (
                    <span className="text-[10px] text-dark-500 font-mono">
                      {result.duration < 1000
                        ? `${result.duration}ms`
                        : `${(result.duration / 1000).toFixed(1)}s`}
                    </span>
                  )}

                  {/* Expand Error */}
                  {result?.error && (
                    <button
                      onClick={() =>
                        setExpandedError(expandedError === step.id ? null : step.id)
                      }
                      className="p-1 hover:bg-dark-700 rounded transition-colors"
                    >
                      <ChevronRight
                        className={clsx(
                          'w-3.5 h-3.5 text-dark-500 transition-transform',
                          expandedError === step.id && 'rotate-90'
                        )}
                      />
                    </button>
                  )}
                </div>

                {/* Expanded Error */}
                {expandedError === step.id && result?.error && (
                  <div className="ml-10 mt-1 p-2 bg-red-500/10 rounded border border-red-500/20 animate-fade-in">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-red-300">{result.error}</p>
                        {result.aiValidation?.reason && (
                          <p className="text-xs text-dark-400 mt-1 italic">
                            AI: {result.aiValidation.reason}
                          </p>
                        )}
                        {onAnalyzeFailure && (
                          <button
                            onClick={() => onAnalyzeFailure(step, result.error!)}
                            className="mt-2 flex items-center gap-1.5 px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-colors"
                          >
                            <Bot className="w-3 h-3" />
                            Analyze with AI
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="px-4 py-3 bg-dark-800/50 border-t border-dark-700 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            {passedCount} passed
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <XCircle className="w-3.5 h-3.5" />
            {failedCount} failed
          </span>
        </div>
        {!isRunning && (
          <span className="text-xs text-dark-500">
            {passedCount}/{completedSteps} steps succeeded
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Compact execution indicator for showing in toolbar
 */
export function ExecutionIndicator({
  isRunning,
  progress,
  onClick,
}: {
  isRunning: boolean;
  progress: ExecutionProgress | null;
  onClick?: () => void;
}) {
  if (!isRunning || !progress) return null;

  const passedCount = progress.results.filter((r) => r.status === 'passed').length;
  const failedCount = progress.results.filter((r) => r.status === 'failed').length;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors"
    >
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span className="text-xs font-medium">
        Step {progress.currentStep + 1}/{progress.total}
      </span>
      <span className="text-xs opacity-75">
        <span className="text-green-400">{passedCount}</span>
        {failedCount > 0 && (
          <>
            /<span className="text-red-400">{failedCount}</span>
          </>
        )}
      </span>
    </button>
  );
}
