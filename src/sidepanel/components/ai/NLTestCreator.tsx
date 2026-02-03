import { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  CheckCircle,
  MousePointer,
  Type,
  Navigation,
  List,
  Clock,
  ChevronRight,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { AIService } from '@/core/services/AIService';
import { TestRepository, SuiteRepository } from '@/core/storage/repositories';
import type { UIStep, SuiteHooks } from '@/types/test';
import toast from 'react-hot-toast';
import { sendToContent } from '@/shared/utils';

interface NLTestCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCreated: (testId: string) => void;
  suiteId?: string;
}

type ViewState = 'input' | 'generating' | 'preview' | 'saving';

interface GeneratedTest {
  testName: string;
  testDescription: string;
  startUrl: string;
  steps: UIStep[];
  dataVariables: Record<string, string>;
}

// Example prompts to inspire users
const EXAMPLE_PROMPTS = [
  'Login with test@example.com and password 123456',
  'Search for "laptop" and add first result to cart',
  'Fill contact form with name John and email john@test.com',
  'Register new user with random data',
];

const EXAMPLE_PROMPTS_AR = [
  'تسجيل الدخول بـ test@example.com وكلمة مرور 123456',
  'البحث عن "لابتوب" وإضافة النتيجة الأولى للسلة',
  'ملء نموذج الاتصال بالاسم أحمد والإيميل ahmad@test.com',
];

export function NLTestCreator({ isOpen, onClose, onTestCreated, suiteId }: NLTestCreatorProps) {
  const [description, setDescription] = useState('');
  const [viewState, setViewState] = useState<ViewState>('input');
  const [generatedTest, setGeneratedTest] = useState<GeneratedTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [pageDirection, setPageDirection] = useState<'ltr' | 'rtl'>('ltr');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setViewState('input');
      setGeneratedTest(null);
      setError(null);
      setEditingName(false);

      // Try to detect page direction
      sendToContent<{ success: boolean; analysis: any }>({ type: 'analyzer:getFullAnalysis' })
        .then((response) => {
          if (response.success && response.analysis?.metadata?.direction) {
            setPageDirection(response.analysis.metadata.direction);
          }
        })
        .catch(() => {
          // Ignore errors, default to LTR
        });
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error('Please enter a test description');
      return;
    }

    setViewState('generating');
    setError(null);

    try {
      const aiService = new AIService();
      await aiService.initialize();

      // Get current page URL as base URL
      let baseUrl = '';
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        baseUrl = tab?.url || '';
      } catch {
        // Ignore if we can't get tab info
      }

      // Get page context for better selector generation
      let pageContext = '';
      try {
        const response = await sendToContent<{ success: boolean; analysis: any }>({
          type: 'analyzer:getFullAnalysis',
        });
        if (response.success && response.analysis) {
          // Build context string from analysis
          const analysis = response.analysis;
          const forms = analysis.forms?.map((f: any) =>
            `Form: ${f.fields?.map((field: any) => `${field.type}[name="${field.name}"]`).join(', ')}`
          ).join('\n') || '';
          const buttons = analysis.buttons?.map((b: any) => `Button: "${b.text}" [${b.selector}]`).join('\n') || '';
          pageContext = `${forms}\n${buttons}`;
        }
      } catch {
        // Ignore if we can't get page context
      }

      const result = await aiService.generateTestFromDescription(description, {
        baseUrl,
        direction: pageDirection,
        pageContext,
      });

      setGeneratedTest(result);
      setEditedName(result.testName);
      setViewState('preview');
    } catch (err) {
      console.error('Failed to generate test:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate test');
      setViewState('input');
    }
  };

  const handleCreateTest = async () => {
    if (!generatedTest) return;

    setViewState('saving');

    try {
      // Get or create a suite
      let targetSuiteId = suiteId;

      if (!targetSuiteId) {
        // Check if there's an existing suite, or create one
        const suites = await SuiteRepository.getAll();
        if (suites.length > 0) {
          targetSuiteId = suites[0].id;
        } else {
          const newSuite = await SuiteRepository.create({
            name: 'My Tests',
            order: 0,
            hooks: {} as SuiteHooks,
          });
          targetSuiteId = newSuite.id;
        }
      }

      // Create the test
      const testName = editingName ? editedName : generatedTest.testName;
      const test = await TestRepository.createNew(
        targetSuiteId,
        testName,
        generatedTest.startUrl
      );

      // Update test with steps and data
      await TestRepository.update(test.id, {
        description: generatedTest.testDescription,
        steps: generatedTest.steps,
        dataSource: {
          type: 'ai-generated',
          data: [generatedTest.dataVariables],
        },
      });

      toast.success('Test created successfully!');
      onTestCreated(test.id);
      onClose();
    } catch (err) {
      console.error('Failed to create test:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create test');
      setViewState('preview');
    }
  };

  const getStepIcon = (actionType: string) => {
    switch (actionType) {
      case 'navigate':
        return Navigation;
      case 'click':
        return MousePointer;
      case 'type':
        return Type;
      case 'select':
        return List;
      case 'waitTime':
      case 'waitForElement':
        return Clock;
      default:
        return MousePointer;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-850 rounded-xl border border-dark-700 shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-4 py-3 bg-dark-800 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-dark-100">Create Test with AI</h2>
              <p className="text-xs text-dark-500">Describe your test in plain language</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-dark-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Input View */}
          {viewState === 'input' && (
            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-xs text-dark-400 mb-2 uppercase tracking-wider">
                  Describe what you want to test
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Login with test@example.com and password 123456, then verify dashboard loads"
                  className="input w-full h-28 resize-none"
                  dir={pageDirection}
                  autoFocus
                />
              </div>

              {/* Example prompts */}
              <div>
                <p className="text-xs text-dark-500 mb-2">Examples:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(pageDirection === 'rtl' ? EXAMPLE_PROMPTS_AR : EXAMPLE_PROMPTS).map((example, i) => (
                    <button
                      key={i}
                      onClick={() => setDescription(example)}
                      className="px-2 py-1 text-xs bg-dark-800 text-dark-400 rounded hover:bg-dark-700 hover:text-dark-200 transition-colors truncate max-w-[200px]"
                      title={example}
                    >
                      {example.length > 35 ? example.substring(0, 35) + '...' : example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Generating View */}
          {viewState === 'generating' && (
            <div className="py-8 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
              </div>
              <p className="text-sm text-dark-300">Generating test steps...</p>
              <p className="text-xs text-dark-500 mt-1">Analyzing your description</p>
            </div>
          )}

          {/* Preview View */}
          {viewState === 'preview' && generatedTest && (
            <div className="space-y-4">
              {/* Test Name */}
              <div>
                <label className="block text-xs text-dark-500 mb-1 uppercase tracking-wider">
                  Test Name
                </label>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="input flex-1"
                      autoFocus
                    />
                    <button
                      onClick={() => setEditingName(false)}
                      className="btn btn-sm btn-secondary"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-dark-100">{editedName}</span>
                    <button
                      onClick={() => setEditingName(true)}
                      className="p-1 hover:bg-dark-700 rounded text-dark-500 hover:text-dark-300"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* URL */}
              {generatedTest.startUrl && (
                <div>
                  <label className="block text-xs text-dark-500 mb-1 uppercase tracking-wider">
                    Starting URL
                  </label>
                  <p className="text-xs text-dark-400 truncate">{generatedTest.startUrl}</p>
                </div>
              )}

              {/* Steps */}
              <div>
                <label className="block text-xs text-dark-500 mb-2 uppercase tracking-wider">
                  Generated Steps ({generatedTest.steps.length})
                </label>
                <div className="space-y-1 max-h-48 overflow-auto pr-1">
                  {generatedTest.steps.map((step, index) => {
                    const Icon = getStepIcon(step.action.type);
                    return (
                      <div
                        key={step.id}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-800 rounded-lg"
                      >
                        <span className="step-number">{index + 1}</span>
                        <Icon className="w-3.5 h-3.5 text-dark-500" />
                        <span className="flex-1 text-sm text-dark-300 truncate">
                          {step.name}
                        </span>
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Variables */}
              {Object.keys(generatedTest.dataVariables).length > 0 && (
                <div>
                  <label className="block text-xs text-dark-500 mb-2 uppercase tracking-wider">
                    Test Data Variables
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(generatedTest.dataVariables).map(([key, value]) => (
                      <div
                        key={key}
                        className="px-2 py-1 bg-dark-800 rounded text-xs"
                        title={`${key}: ${value}`}
                      >
                        <span className="text-purple-400">{`{{${key}}}`}</span>
                        <span className="text-dark-600 mx-1">=</span>
                        <span className="text-dark-400">
                          {String(value).length > 20 ? String(value).substring(0, 20) + '...' : value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Saving View */}
          {viewState === 'saving' && (
            <div className="py-8 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
              </div>
              <p className="text-sm text-dark-300">Creating test...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-dark-800/50 border-t border-dark-700 flex justify-end gap-2">
          {viewState === 'input' && (
            <>
              <button onClick={onClose} className="btn btn-sm btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!description.trim()}
                className="btn btn-sm btn-primary"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Test
              </button>
            </>
          )}

          {viewState === 'preview' && (
            <>
              <button
                onClick={() => setViewState('input')}
                className="btn btn-sm btn-ghost"
              >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                Back
              </button>
              <button onClick={handleCreateTest} className="btn btn-sm btn-primary">
                <CheckCircle className="w-3.5 h-3.5" />
                Create Test
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
