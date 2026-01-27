import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, History } from 'lucide-react';
import { ResultRepository } from '@/core/storage/repositories';
import type { TestRun } from '@/types/result';
import { clsx } from 'clsx';

const statusIcons = {
  passed: CheckCircle,
  failed: XCircle,
  running: Clock,
  error: AlertCircle,
  stopped: AlertCircle,
};

const statusColors = {
  passed: 'text-status-pass',
  failed: 'text-status-fail',
  running: 'text-status-running',
  error: 'text-status-fail',
  stopped: 'text-status-pending',
};

export function ResultsList() {
  const [results, setResults] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ResultRepository.getRecent(50).then((data) => {
      setResults(data);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-dark-500">
        <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No test results yet</p>
        <p className="text-sm mt-1">Run some tests to see results here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-dark-400 uppercase tracking-wider">
        Recent Results ({results.length})
      </h2>

      <div className="space-y-2">
        {results.map((run) => {
          const StatusIcon = statusIcons[run.status];
          const statusColor = statusColors[run.status];

          return (
            <div key={run.id} className="card p-3">
              <div className="flex items-center gap-3">
                <StatusIcon className={clsx('w-5 h-5', statusColor)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-dark-100">Test Run</span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full', statusColor, 'bg-current/10')}>
                      {run.status}
                    </span>
                  </div>
                  <div className="text-xs text-dark-500 mt-1">
                    {new Date(run.startedAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-dark-300">
                    {run.summary.passedSteps}/{run.summary.totalSteps} passed
                  </div>
                  <div className="text-xs text-dark-500">
                    {(run.summary.duration / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>

              {run.summary.failedSteps > 0 && (
                <div className="mt-2 pt-2 border-t border-dark-700">
                  <div className="text-xs text-status-fail">
                    {run.summary.failedSteps} step{run.summary.failedSteps !== 1 ? 's' : ''} failed
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
