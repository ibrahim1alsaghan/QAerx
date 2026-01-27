import { useState } from 'react';
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
} from 'lucide-react';
import type { UIStep, UIAction, SelectorStrategy } from '@/types/test';
import { clsx } from 'clsx';
import { SelectorInput } from './SelectorInput';
import { SelectorTips } from './SelectorTips';

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
  { type: 'type', label: 'Type', icon: Type, description: 'Enter text into a field' },
  { type: 'select', label: 'Select', icon: List, description: 'Select from dropdown' },
  { type: 'assert', label: 'Assert', icon: Eye, description: 'Verify element text/visibility' },
  { type: 'wait', label: 'Wait', icon: Clock, description: 'Wait for element or time' },
];

export function StepEditor({ steps, onStepsChange, currentStepId, stepResults }: StepEditorProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

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
    <div className="space-y-3">
      <SelectorTips />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-dark-300">
          Steps ({steps.length})
        </h3>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="btn btn-sm btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>

          {showAddMenu && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-10">
              {STEP_TYPES.map(({ type, label, icon: Icon, description }) => (
                <button
                  key={type}
                  onClick={() => addStep(type)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-700 text-left first:rounded-t-lg last:rounded-b-lg"
                >
                  <Icon className="w-4 h-4 text-accent" />
                  <div>
                    <div className="text-sm text-dark-100">{label}</div>
                    <div className="text-xs text-dark-500">{description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {steps.length === 0 ? (
        <div className="text-center py-8 text-dark-500 border border-dashed border-dark-700 rounded-lg">
          <MousePointer className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No steps yet</p>
          <p className="text-xs mt-1">Click "Add Step" to create your first test step</p>
        </div>
      ) : (
        <div className="space-y-2">
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
            />
          ))}
        </div>
      )}
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
}: StepItemProps) {
  const getStepIcon = () => {
    switch (step.action.type) {
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
        return Clock;
      default:
        return Eye;
    }
  };

  const Icon = getStepIcon();

  const updateAction = (actionUpdates: Partial<UIAction>) => {
    onUpdate({ action: { ...step.action, ...actionUpdates } as UIAction });
  };

  const updateSelector = (selector: string, allSelectors?: SelectorStrategy[]) => {
    if (allSelectors) {
      // From element picker - use all suggestions
      onUpdate({ selectors: allSelectors });
    } else {
      // Manual input - keep existing suggestions if they exist
      const existingSelectors = step.selectors.length > 1 ? step.selectors : [];
      const newSelectors: SelectorStrategy[] = [
        { type: 'css', value: selector, priority: 0, confidence: 1 },
        ...existingSelectors.slice(1),
      ];
      onUpdate({ selectors: newSelectors });
    }
  };

  const getBorderColor = () => {
    if (isCurrent) return 'border-blue-400 shadow-lg shadow-blue-400/20';
    if (result?.status === 'passed') return 'border-green-400';
    if (result?.status === 'failed') return 'border-red-400';
    if (isExpanded) return 'border-accent';
    return 'border-dark-700';
  };

  const getBackgroundColor = () => {
    if (isCurrent) return 'bg-blue-400/5';
    if (result?.status === 'passed') return 'bg-green-400/5';
    if (result?.status === 'failed') return 'bg-red-400/5';
    if (isExpanded) return 'bg-dark-850';
    return 'bg-dark-800';
  };

  const getStatusIcon = () => {
    if (isCurrent) return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    if (result?.status === 'passed') return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (result?.status === 'failed') return <XCircle className="w-4 h-4 text-red-400" />;
    return null;
  };

  return (
    <div
      className={clsx(
        'border rounded-lg transition-all duration-200',
        getBorderColor(),
        getBackgroundColor()
      )}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={onToggle}
      >
        <GripVertical className="w-4 h-4 text-dark-600 cursor-grab" />
        <span className={clsx(
          "w-6 h-6 flex items-center justify-center rounded text-xs",
          isCurrent ? "bg-blue-400/20 text-blue-400" :
          result?.status === 'passed' ? "bg-green-400/20 text-green-400" :
          result?.status === 'failed' ? "bg-red-400/20 text-red-400" :
          "bg-dark-700 text-dark-400"
        )}>
          {index + 1}
        </span>
        <Icon className={clsx(
          "w-4 h-4",
          isCurrent ? "text-blue-400" :
          result?.status === 'passed' ? "text-green-400" :
          result?.status === 'failed' ? "text-red-400" :
          "text-accent"
        )} />
        <span className={clsx(
          "flex-1 text-sm truncate",
          isCurrent ? "text-blue-300 font-medium" :
          result?.status === 'passed' ? "text-green-300" :
          result?.status === 'failed' ? "text-red-300" :
          "text-dark-200"
        )}>
          {step.name}
        </span>
        {getStatusIcon()}
        {result?.duration && (
          <span className="text-xs text-dark-500">
            {result.duration}ms
          </span>
        )}
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-dark-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-dark-500" />
        )}
      </div>

      {result?.error && !isExpanded && (
        <div className="px-3 pb-2">
          <div className="text-xs text-red-400 bg-red-400/10 rounded px-2 py-1">
            {result.error}
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-dark-700 pt-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Step Name</label>
            <input
              type="text"
              value={step.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="input"
            />
          </div>

          {step.action.type === 'navigate' && (
            <div>
              <label className="block text-xs text-dark-400 mb-1">
                URL <span className="text-dark-600">(use {'{{variable}}'} for data)</span>
              </label>
              <input
                type="text"
                value={(step.action as { url?: string }).url || ''}
                onChange={(e) => updateAction({ url: e.target.value } as Partial<UIAction>)}
                placeholder="https://example.com/{{page}}"
                className="input"
              />
            </div>
          )}

          {['click', 'type', 'select', 'waitForElement'].includes(step.action.type) && (
            <div>
              <label className="block text-xs text-dark-400 mb-1">
                Element Selector <span className="text-dark-600">(CSS selector, or use Pick button)</span>
              </label>
              <SelectorInput
                value={step.selectors[0]?.value || ''}
                onChange={updateSelector}
                suggestions={step.selectors}
                onSuggestionsRequest={() => {
                  // Suggestions are already in step.selectors from element picker
                }}
              />
            </div>
          )}

          {step.action.type === 'type' && (
            <div>
              <label className="block text-xs text-dark-400 mb-1">
                Text to Type <span className="text-dark-600">(use {'{{variable}}'} for data)</span>
              </label>
              <input
                type="text"
                value={(step.action as { text?: string }).text || ''}
                onChange={(e) => updateAction({ text: e.target.value } as Partial<UIAction>)}
                placeholder="{{email}}"
                className="input"
              />
            </div>
          )}

          {step.action.type === 'select' && (
            <div>
              <label className="block text-xs text-dark-400 mb-1">
                Value to Select <span className="text-dark-600">(use {'{{variable}}'} for data)</span>
              </label>
              <input
                type="text"
                value={(step.action as { value?: string }).value || ''}
                onChange={(e) => updateAction({ value: e.target.value } as Partial<UIAction>)}
                placeholder="{{option}}"
                className="input"
              />
            </div>
          )}

          {(step.action.type === 'waitTime' || step.action.type === 'waitForElement') && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-dark-400 mb-2">Wait Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateAction({ type: 'waitTime', duration: 2000 } as Partial<UIAction>)}
                    className={clsx(
                      'flex-1 px-3 py-2 rounded-lg text-sm transition-colors',
                      step.action.type === 'waitTime'
                        ? 'bg-accent text-white'
                        : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                    )}
                  >
                    Wait for Time
                  </button>
                  <button
                    onClick={() => {
                      updateAction({ type: 'waitForElement' } as Partial<UIAction>);
                      if (step.selectors.length === 0) {
                        onUpdate({ selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }] });
                      }
                    }}
                    className={clsx(
                      'flex-1 px-3 py-2 rounded-lg text-sm transition-colors',
                      step.action.type === 'waitForElement'
                        ? 'bg-accent text-white'
                        : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                    )}
                  >
                    Wait for Element
                  </button>
                </div>
              </div>

              {step.action.type === 'waitTime' && (
                <div>
                  <label className="block text-xs text-dark-400 mb-1">
                    Duration (milliseconds)
                  </label>
                  <input
                    type="number"
                    value={(step.action as { duration?: number }).duration || 2000}
                    onChange={(e) => updateAction({ duration: parseInt(e.target.value) || 2000 } as Partial<UIAction>)}
                    placeholder="2000"
                    min="100"
                    step="100"
                    className="input"
                  />
                  <p className="text-xs text-dark-500 mt-1">
                    {((step.action as { duration?: number }).duration || 2000) / 1000} seconds
                  </p>
                </div>
              )}

              {step.action.type === 'waitForElement' && (
                <div>
                  <label className="block text-xs text-dark-400 mb-1">
                    Element Selector <span className="text-dark-600">(CSS selector, or use Pick button)</span>
                  </label>
                  <SelectorInput
                    value={step.selectors[0]?.value || ''}
                    onChange={updateSelector}
                    suggestions={step.selectors}
                    onSuggestionsRequest={() => {
                      // Suggestions are already in step.selectors from element picker
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {result?.error && (
            <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-red-300 mb-1">Step Failed</div>
                  <div className="text-xs text-red-200">{result.error}</div>
                  {result.duration && (
                    <div className="text-xs text-red-400/60 mt-1">
                      Failed after {result.duration}ms
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onMove('up')}
                disabled={!canMoveUp}
                className="btn btn-icon btn-sm btn-ghost disabled:opacity-30"
                title="Move up"
              >
                <ChevronDown className="w-4 h-4 rotate-180" />
              </button>
              <button
                onClick={() => onMove('down')}
                disabled={!canMoveDown}
                className="btn btn-icon btn-sm btn-ghost disabled:opacity-30"
                title="Move down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onDelete}
              className="btn btn-sm btn-ghost text-red-400 hover:bg-red-400/10"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
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
      return {
        ...baseStep,
        name: 'Navigate to URL',
        action: { type: 'navigate', url: '' },
        selectors: [],
      };
    case 'click':
      return {
        ...baseStep,
        name: 'Click element',
        action: { type: 'click' },
        selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }],
      };
    case 'type':
      return {
        ...baseStep,
        name: 'Type text',
        action: { type: 'type', text: '' },
        selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }],
      };
    case 'select':
      return {
        ...baseStep,
        name: 'Select option',
        action: { type: 'select', value: '' },
        selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }],
      };
    case 'assert':
      return {
        ...baseStep,
        name: 'Assert element visible',
        action: { type: 'waitForElement' },
        selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }],
        assertions: [{ type: 'visibility', expected: 'visible' }],
      };
    case 'wait':
      return {
        ...baseStep,
        name: 'Wait',
        action: { type: 'waitTime', duration: 2000 },
        selectors: [],
      };
    default:
      return {
        ...baseStep,
        name: 'New step',
        action: { type: 'click' },
        selectors: [],
      };
  }
}
