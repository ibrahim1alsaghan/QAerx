import { useState } from 'react';
import {
  X,
  Bot,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Wand2,
  Loader2,
  Target,
  Lightbulb,
  Code,
} from 'lucide-react';
import type { FailureAnalysisResult } from '@/types/result';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface FailureAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: FailureAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onApplyFix?: (fix: { code?: string; selector?: string }) => void;
  stepName: string;
  errorMessage: string;
}

export function FailureAnalysisModal({
  isOpen,
  onClose,
  analysis,
  isLoading,
  error,
  onApplyFix,
  stepName,
  errorMessage,
}: FailureAnalysisModalProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['causes', 'fixes'])
  );

  if (!isOpen) return null;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getProbabilityColor = (probability: string) => {
    switch (probability) {
      case 'high':
        return 'text-red-400 bg-red-500/20';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'low':
        return 'text-blue-400 bg-blue-500/20';
      default:
        return 'text-dark-400 bg-dark-700';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 border border-dark-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Bot className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark-100">AI Failure Analysis</h2>
              <p className="text-xs text-dark-500 mt-0.5">{stepName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* Error Message */}
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-300">{errorMessage}</div>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-dark-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-purple-400" />
              <p className="text-sm">Analyzing failure with AI...</p>
              <p className="text-xs text-dark-500 mt-1">This may take a few seconds</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Analysis Results */}
          {analysis && !isLoading && (
            <>
              {/* Category Badge */}
              <div className="flex items-center justify-center">
                <div className="px-4 py-2 bg-dark-850 rounded-full border border-dark-700">
                  <span className="text-lg font-medium">{analysis.categoryLabel}</span>
                  <span className={clsx('ml-2 text-sm', getConfidenceColor(analysis.confidence))}>
                    ({Math.round(analysis.confidence * 100)}%)
                  </span>
                </div>
              </div>

              {/* Summary - Bilingual */}
              <div className="p-4 bg-dark-850 rounded-lg space-y-2">
                <p className="text-dark-200">{analysis.summary}</p>
                <p className="text-dark-300 text-right font-arabic" dir="rtl">{analysis.summaryArabic}</p>
              </div>

              {/* Possible Causes */}
              <div className="border border-dark-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('causes')}
                  className="w-full px-4 py-3 flex items-center justify-between bg-dark-850 hover:bg-dark-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-medium text-dark-200">
                      Possible Causes ({analysis.possibleCauses.length})
                    </span>
                  </div>
                  {expandedSections.has('causes') ? (
                    <ChevronDown className="w-4 h-4 text-dark-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-dark-400" />
                  )}
                </button>

                {expandedSections.has('causes') && (
                  <div className="p-3 space-y-2">
                    {analysis.possibleCauses.map((cause, index) => (
                      <div
                        key={index}
                        className="p-3 bg-dark-900 rounded-lg border border-dark-800"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-dark-100">
                            {cause.cause}
                          </span>
                          <span
                            className={clsx(
                              'px-2 py-0.5 text-xs rounded-full uppercase',
                              getProbabilityColor(cause.probability)
                            )}
                          >
                            {cause.probability}
                          </span>
                        </div>
                        <p className="text-xs text-dark-400 mt-2">{cause.explanation}</p>
                        {cause.causeArabic && (
                          <p className="text-xs text-dark-500 mt-1 text-right font-arabic" dir="rtl">
                            السبب: {cause.causeArabic}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggested Fixes */}
              <div className="border border-dark-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('fixes')}
                  className="w-full px-4 py-3 flex items-center justify-between bg-dark-850 hover:bg-dark-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-dark-200">
                      Suggested Fixes ({analysis.suggestedFixes.length})
                    </span>
                  </div>
                  {expandedSections.has('fixes') ? (
                    <ChevronDown className="w-4 h-4 text-dark-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-dark-400" />
                  )}
                </button>

                {expandedSections.has('fixes') && (
                  <div className="p-3 space-y-2">
                    {analysis.suggestedFixes.map((fix, index) => (
                      <div
                        key={index}
                        className="p-3 bg-dark-900 rounded-lg border border-dark-800"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-dark-100">
                            {fix.fix}
                          </span>
                          {fix.autoApplicable && onApplyFix && fix.code && (
                            <button
                              onClick={() => onApplyFix({ code: fix.code })}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors"
                            >
                              <Wand2 className="w-3 h-3" />
                              Apply
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-dark-400 mt-2">{fix.description}</p>
                        {fix.fixArabic && (
                          <p className="text-xs text-dark-500 mt-1 text-right font-arabic" dir="rtl">
                            💡 الحل: {fix.fixArabic}
                          </p>
                        )}
                        {fix.code && (
                          <div className="mt-2 relative">
                            <pre className="p-2 bg-dark-950 rounded text-xs text-dark-300 font-mono overflow-x-auto">
                              {fix.code}
                            </pre>
                            <button
                              onClick={() => copyToClipboard(fix.code!)}
                              className="absolute top-1 right-1 p-1 text-dark-500 hover:text-dark-300 transition-colors"
                              title="Copy code"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Alternative Selectors */}
              {analysis.alternativeSelectors && analysis.alternativeSelectors.length > 0 && (
                <div className="border border-dark-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('selectors')}
                    className="w-full px-4 py-3 flex items-center justify-between bg-dark-850 hover:bg-dark-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-dark-200">
                        Alternative Selectors ({analysis.alternativeSelectors.length})
                      </span>
                    </div>
                    {expandedSections.has('selectors') ? (
                      <ChevronDown className="w-4 h-4 text-dark-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-dark-400" />
                    )}
                  </button>

                  {expandedSections.has('selectors') && (
                    <div className="p-3 space-y-2">
                      {analysis.alternativeSelectors.map((selector, index) => (
                        <div
                          key={index}
                          className="p-3 bg-dark-900 rounded-lg border border-dark-800"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-sm text-accent font-mono">
                              {selector.selector}
                            </code>
                            <div className="flex items-center gap-2">
                              <span
                                className={clsx(
                                  'text-xs',
                                  getConfidenceColor(selector.confidence)
                                )}
                              >
                                {Math.round(selector.confidence * 100)}%
                              </span>
                              {onApplyFix && (
                                <button
                                  onClick={() => onApplyFix({ selector: selector.selector })}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors"
                                >
                                  <Wand2 className="w-3 h-3" />
                                  Use
                                </button>
                              )}
                              <button
                                onClick={() => copyToClipboard(selector.selector)}
                                className="p-1 text-dark-500 hover:text-dark-300 transition-colors"
                                title="Copy selector"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-dark-400 mt-2">{selector.explanation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-dark-700 flex justify-end">
          <button
            onClick={onClose}
            className="btn btn-sm btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Smaller inline version for step results
export function AnalyzeButton({
  onClick,
  isLoading,
}: {
  onClick: () => void;
  isLoading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="flex items-center gap-1.5 px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-colors disabled:opacity-50"
      title="Analyze failure with AI"
    >
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Bot className="w-3 h-3" />
      )}
      Analyze
    </button>
  );
}
