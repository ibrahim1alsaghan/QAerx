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
} from 'lucide-react';
import type { UIStep, UIAction, SelectorStrategy } from '@/types/test';
import { clsx } from 'clsx';

interface StepEditorProps {
  steps: UIStep[];
  onStepsChange: (steps: UIStep[]) => void;
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

export function StepEditor({ steps, onStepsChange }: StepEditorProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

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

  const updateSelector = (selector: string) => {
    const newSelectors: SelectorStrategy[] = [
      { type: 'css', value: selector, priority: 0, confidence: 1 },
    ];
    onUpdate({ selectors: newSelectors });
  };

  return (
    <div
      className={clsx(
        'border rounded-lg transition-colors',
        isExpanded ? 'border-accent bg-dark-850' : 'border-dark-700 bg-dark-800'
      )}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={onToggle}
      >
        <GripVertical className="w-4 h-4 text-dark-600 cursor-grab" />
        <span className="w-6 h-6 flex items-center justify-center bg-dark-700 rounded text-xs text-dark-400">
          {index + 1}
        </span>
        <Icon className="w-4 h-4 text-accent" />
        <span className="flex-1 text-sm text-dark-200 truncate">
          {step.name}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-dark-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-dark-500" />
        )}
      </div>

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
                Element Selector <span className="text-dark-600">(CSS selector)</span>
              </label>
              <input
                type="text"
                value={step.selectors[0]?.value || ''}
                onChange={(e) => updateSelector(e.target.value)}
                placeholder="#email, .btn-submit, [data-testid='login']"
                className="input font-mono text-sm"
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
        name: 'Wait for element',
        action: { type: 'waitForElement' },
        selectors: [{ type: 'css', value: '', priority: 0, confidence: 1 }],
        waitConfig: { strategy: 'visible', timeout: 30000 },
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
