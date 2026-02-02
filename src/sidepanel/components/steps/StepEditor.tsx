import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  MousePointer,
  Type,
  List,
  Eye,
  Clock,
  Navigation,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Bot,
} from 'lucide-react';
import type { UIStep, UIAction, SelectorStrategy } from '@/types/test';
import type { FailureAnalysisResult } from '@/types/result';
import { clsx } from 'clsx';
import { SelectorInput } from './SelectorInput';
import { FailureAnalysisModal } from '../ai/FailureAnalysisModal';
import { AIService } from '@/core/services/AIService';
import toast from 'react-hot-toast';

interface StepEditorProps {
  steps: UIStep[];
  onStepsChange: (steps: UIStep[]) => void;
  currentStepId?: string | null;
  stepResults?: Array<{ stepId: string; status: 'passed' | 'failed'; error?: string; duration?: number }>;
}

type StepType = 'navigate' | 'click' | 'type' | 'select' | 'assert' | 'wait';

const STEP_TYPES: { type: StepType; label: string; icon: typeof MousePointer; description: string }[] = [
  { type: 'navigate', label: 'Navigate', icon: Navigation, description: 'Go to a URL' },
  { type: 'click', label: 'Click', icon: MousePointer, description: 'Click an element' },
  { type: 'type', label: 'Type', icon: Type, description: 'Enter text' },
  { type: 'select', label: 'Select', icon: List, description: 'Select option' },
  { type: 'assert', label: 'Assert', icon: Eye, description: 'Verify element' },
  { type: 'wait', label: 'Wait', icon: Clock, description: 'Wait for element/time' },
];

export function StepEditor({ steps, onStepsChange, currentStepId, stepResults }: StepEditorProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // AI Failure Analysis state
  const [analysisModal, setAnalysisModal] = useState<{
    isOpen: boolean;
    stepId: string | null;
    stepName: string;
    errorMessage: string;
    analysis: FailureAnalysisResult | null;
    isLoading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    stepId: null,
    stepName: '',
    errorMessage: '',
    analysis: null,
    isLoading: false,
    error: null,
  });

  const handleAnalyzeFailure = async (step: UIStep, errorMessage: string) => {
    setAnalysisModal({
      isOpen: true,
      stepId: step.id,
      stepName: step.name,
      errorMessage,
      analysis: null,
      isLoading: true,
      error: null,
    });

    try {
      const aiService = new AIService();
      await aiService.initialize();

      // Get current page URL
      let pageUrl = 'Unknown';
      let pageTitle = '';
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        pageUrl = tab?.url || 'Unknown';
        pageTitle = tab?.title || '';
      } catch {
        // Ignore if we can't get tab info
      }

      // Determine error type
      const errorType = errorMessage.toLowerCase().includes('timeout')
        ? 'timeout'
        : errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('no element')
        ? 'element-not-found'
        : errorMessage.toLowerCase().includes('assert')
        ? 'assertion-failed'
        : 'unknown';

      const analysis = await aiService.analyzeFailure({
        stepName: step.name,
        actionType: step.action.type,
        selector: step.selectors?.[0]?.value,
        errorMessage,
        errorType,
        pageUrl,
        pageTitle,
      });

      setAnalysisModal(prev => ({
        ...prev,
        analysis,
        isLoading: false,
      }));
    } catch (error) {
      setAnalysisModal(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to analyze failure',
      }));
    }
  };

  const handleApplyFix = (fix: { code?: string; selector?: string }) => {
    if (fix.selector && analysisModal.stepId) {
      // Apply new selector to the step
      onStepsChange(
        steps.map(step => {
          if (step.id === analysisModal.stepId) {
            return {
              ...step,
              selectors: [
                { type: 'css' as const, value: fix.selector!, priority: 0, confidence: 0.8 },
                ...step.selectors.slice(1),
              ],
            };
          }
          return step;
        })
      );
      toast.success('Selector updated');
      setAnalysisModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  // Close add menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStepResult = (stepId: string) => {
    return stepResults?.find((r) => r.stepId === stepId);
  };

  const addStep = (type: StepType) => {
    const newStep = createStep(type, steps.length);
    onStepsChange([...steps, newStep]);
    setExpandedStep(newStep.id);
    setShowAddMenu(false);
  };

  const updateStep = (id: string, updates: Partial<UIStep>) => {
    onStepsChange(
      steps.map((step) => (step.id === id ? { ...step, ...updates } : step))
    );
  };

  const deleteStep = (id: string) => {
    onStepsChange(steps.filter((step) => step.id !== id));
    if (expandedStep === id) {
      setExpandedStep(null);
    }
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    newSteps.forEach((step, i) => (step.order = i));
    onStepsChange(newSteps);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-dark-500 uppercase tracking-wider">
          {steps.length} {steps.length === 1 ? 'Step' : 'Steps'}
        </span>
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="btn btn-xs btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>

          {showAddMenu && (
            <div className="dropdown-menu right-0 top-full mt-1 w-48 animate-fade-in">
              {STEP_TYPES.map(({ type, label, icon: Icon, description }) => (
                <button
                  key={type}
                  onClick={() => addStep(type)}
                  className="dropdown-item w-full text-left"
                >
                  <Icon className="w-4 h-4 text-accent" />
                  <div className="flex-1">
                    <div className="text-sm">{label}</div>
                    <div className="text-[10px] text-dark-500">{description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {steps.length === 0 ? (
        <div className="empty-state py-8">
          <MousePointer className="empty-state-icon" />
          <p className="empty-state-title">No steps yet</p>
          <p className="empty-state-description">
            Add your first step or use Smart Collect to scan the page
          </p>
        </div>
      ) : (
        /* Step List */
        <div className="space-y-1">
          {steps.map((step, index) => (
            <StepItem
              key={step.id}
              step={step}
              index={index}
              isExpanded={expandedStep === step.id}
              isCurrent={currentStepId === step.id}
              result={getStepResult(step.id)}
              onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              onUpdate={(updates) => updateStep(step.id, updates)}
              onDelete={() => deleteStep(step.id)}
              onMove={(dir) => moveStep(index, dir)}
              canMoveUp={index > 0}
              canMoveDown={index < steps.length - 1}
              onAnalyzeFailure={(error) => handleAnalyzeFailure(step, error)}
            />
          ))}
        </div>
      )}

      {/* AI Failure Analysis Modal */}
      <FailureAnalysisModal
        isOpen={analysisModal.isOpen}
        onClose={() => setAnalysisModal(prev => ({ ...prev, isOpen: false }))}
        analysis={analysisModal.analysis}
        isLoading={analysisModal.isLoading}
        error={analysisModal.error}
        onApplyFix={handleApplyFix}
        stepName={analysisModal.stepName}
        errorMessage={analysisModal.errorMessage}
      />
    </div>
  );
}

interface StepItemProps {
  step: UIStep;
  index: number;
  isExpanded: boolean;
  isCurrent?: boolean;
  result?: { status: 'passed' | 'failed'; error?: string; duration?: number };
  onToggle: () => void;
  onUpdate: (updates: Partial<UIStep>) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onAnalyzeFailure?: (errorMessage: string) => void;
}

function StepItem({
  step,
  index,
  isExpanded,
  isCurrent,
  result,
  onToggle,
  onUpdate,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
  onAnalyzeFailure,
}: StepItemProps) {
  const getStepIcon = () => {
    switch (step.action.type) {
      case 'navigate': return Navigation;
      case 'click':
      case 'dblclick': return MousePointer;
      case 'type': return Type;
      case 'select': return List;
      case 'waitForElement': return Clock;
      default: return Eye;
    }
  };

  const Icon = getStepIcon();

  const updateAction = (actionUpdates: Partial<UIAction>) => {
    onUpdate({ action: { ...step.action, ...actionUpdates } as UIAction });
  };

  const updateSelector = (selector: string, allSelectors?: SelectorStrategy[]) => {
    if (allSelectors) {
      onUpdate({ selectors: allSelectors });
    } else {
      const existingSelectors = step.selectors.length > 1 ? step.selectors : [];
      const newSelectors: SelectorStrategy[] = [
        { type: 'css', value: selector, priority: 0, confidence: 1 },
        ...existingSelectors.slice(1),
      ];
      onUpdate({ selectors: newSelectors });
    }
  };

  // Determine step number styling based on status
  const getStepNumberClass = () => {
    if (isCurrent) return 'step-number bg-blue-500/20 text-blue-400';
    if (result?.status === 'passed') return 'step-number-success';
    if (result?.status === 'failed') return 'step-number-error';
    return 'step-number';
  };

  const getStepItemClass = () => {
    if (isCurrent) return 'bg-blue-500/5 border-l-2 border-l-blue-400';
    if (result?.status === 'passed') return 'bg-green-500/5';
    if (result?.status === 'failed') return 'bg-red-500/5';
    if (isExpanded) return 'bg-dark-800';
    return 'hover:bg-dark-800/50';
  };

  return (
    <div className={clsx('rounded-lg transition-colors', getStepItemClass())}>
      {/* Step Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer group"
        onClick={onToggle}
      >
        <GripVertical className="w-3.5 h-3.5 text-dark-600 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity" />
        <span className={getStepNumberClass()}>{index + 1}</span>
        <Icon className={clsx('w-4 h-4', isCurrent ? 'text-blue-400' : 'text-dark-500')} />
        <span className={clsx('flex-1 text-sm truncate', isCurrent ? 'text-blue-300' : 'text-dark-200')}>
          {step.name}
        </span>

        {/* Status indicators */}
        {isCurrent && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
        {result?.status === 'passed' && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
        {result?.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
        {result?.duration && <span className="text-[10px] text-dark-600">{result.duration}ms</span>}

        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-dark-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Error preview (collapsed) */}
      {result?.error && !isExpanded && (
        <div className="px-3 pb-2 pl-12">
          <div className="text-xs text-red-400 truncate">{result.error}</div>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 animate-fade-in">
          <div className="border-t border-dark-700/50 pt-3">
            {/* Step Name */}
            <div className="mb-3">
              <label className="block text-[11px] text-dark-500 mb-1 uppercase tracking-wider">Name</label>
              <input
                type="text"
                value={step.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="input input-sm"
              />
            </div>

            {/* Action-specific fields */}
            {step.action.type === 'navigate' && (
              <div className="mb-3">
                <label className="block text-[11px] text-dark-500 mb-1 uppercase tracking-wider">URL</label>
                <input
                  type="text"
                  value={(step.action as { url?: string }).url || ''}
                  onChange={(e) => updateAction({ url: e.target.value } as Partial<UIAction>)}
                  placeholder="https://example.com/{{page}}"
                  className="input input-sm"
                />
                <p className="text-[10px] text-dark-600 mt-1">Use {'{{variable}}'} for dynamic values</p>
              </div>
            )}

            {['click', 'type', 'select', 'waitForElement'].includes(step.action.type) && (
              <div className="mb-3">
                <label className="block text-[11px] text-dark-500 mb-1 uppercase tracking-wider">Selector</label>
                <SelectorInput
                  value={step.selectors[0]?.value || ''}
                  onChange={updateSelector}
                  suggestions={step.selectors}
                  onSuggestionsRequest={() => {}}
                />
              </div>
            )}

            {step.action.type === 'type' && (
              <div className="mb-3">
                <label className="block text-[11px] text-dark-500 mb-1 uppercase tracking-wider">Text</label>
                <input
                  type="text"
                  value={(step.action as { text?: string }).text || ''}
                  onChange={(e) => updateAction({ text: e.target.value } as Partial<UIAction>)}
                  placeholder="{{email}}"
                  className="input input-sm"
                />
              </div>
            )}

            {step.action.type === 'select' && (
              <div className="mb-3">
                <label className="block text-[11px] text-dark-500 mb-1 uppercase tracking-wider">Value</label>
                <input
                  type="text"
                  value={(step.action as { value?: string }).value || ''}
                  onChange={(e) => updateAction({ value: e.target.value } as Partial<UIAction>)}
                  placeholder="{{option}}"
                  className="input input-sm"
                />
              </div>
            )}

            {(step.action.type === 'waitTime' || step.action.type === 'waitForElement') && (
              <div className="mb-3 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => updateAction({ type: 'waitTime', duration: 2000 } as Partial<UIAction>)}
                    className={clsx(
                      'flex-1 px-3 py-1.5 rounded text-xs transition-colors',
                      step.action.type === 'waitTime'
                        ? 'bg-accent text-white'
                        : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                    )}
                  >
                    Time
                  </button>
                  <button
                    onClick={() => {
                      updateAction({ type: 'waitForElement' } as Partial<UIAction>);
                      if (step.selectors.length === 0) {
                        onUpdate({ selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }] });
                      }
                    }}
                    className={clsx(
                      'flex-1 px-3 py-1.5 rounded text-xs transition-colors',
                      step.action.type === 'waitForElement'
                        ? 'bg-accent text-white'
                        : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                    )}
                  >
                    Element
                  </button>
                </div>

                {step.action.type === 'waitTime' && (
                  <div>
                    <input
                      type="number"
                      value={(step.action as { duration?: number }).duration || 2000}
                      onChange={(e) => updateAction({ duration: parseInt(e.target.value) || 2000 } as Partial<UIAction>)}
                      min="100"
                      step="100"
                      className="input input-sm"
                    />
                    <p className="text-[10px] text-dark-600 mt-1">
                      {((step.action as { duration?: number }).duration || 2000) / 1000}s
                    </p>
                  </div>
                )}

                {step.action.type === 'waitForElement' && (
                  <SelectorInput
                    value={step.selectors[0]?.value || ''}
                    onChange={updateSelector}
                    suggestions={step.selectors}
                    onSuggestionsRequest={() => {}}
                  />
                )}
              </div>
            )}

            {/* Error display */}
            {result?.error && (
              <div className="p-2 bg-red-500/10 rounded border border-red-500/20 mb-3">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs text-red-300">{result.error}</div>
                    {onAnalyzeFailure && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAnalyzeFailure(result.error!);
                        }}
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

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-dark-700/50">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onMove('up')}
                  disabled={!canMoveUp}
                  className="btn btn-icon-sm btn-ghost disabled:opacity-30"
                  title="Move up"
                >
                  <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                </button>
                <button
                  onClick={() => onMove('down')}
                  disabled={!canMoveDown}
                  className="btn btn-icon-sm btn-ghost disabled:opacity-30"
                  title="Move down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={onDelete}
                className="btn btn-xs btn-ghost text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function createStep(type: StepType, order: number): UIStep {
  const id = crypto.randomUUID();
  const baseStep = {
    id,
    type: 'ui' as const,
    order,
    enabled: true,
    continueOnFailure: false,
    selectors: [] as SelectorStrategy[],
  };

  switch (type) {
    case 'navigate':
      return { ...baseStep, name: 'Navigate to URL', action: { type: 'navigate', url: '' }, selectors: [] };
    case 'click':
      return { ...baseStep, name: 'Click element', action: { type: 'click' }, selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }] };
    case 'type':
      return { ...baseStep, name: 'Type text', action: { type: 'type', text: '' }, selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }] };
    case 'select':
      return { ...baseStep, name: 'Select option', action: { type: 'select', value: '' }, selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }] };
    case 'assert':
      return { ...baseStep, name: 'Assert element visible', action: { type: 'waitForElement' }, selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }], assertions: [{ type: 'visibility', expected: 'visible' }] };
    case 'wait':
      return { ...baseStep, name: 'Wait', action: { type: 'waitTime', duration: 2000 }, selectors: [] };
    default:
      return { ...baseStep, name: 'New step', action: { type: 'click' }, selectors: [] };
  }
}
