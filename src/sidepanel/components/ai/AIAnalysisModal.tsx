import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, CheckCircle, FormInput, MousePointer, Link2, AlertCircle } from 'lucide-react';
import { AIService } from '@/core/services/AIService';
import type { UIStep } from '@/types/test';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface PageAnalysisResult {
  url: string;
  title: string;
  forms: Array<{
    id?: string;
    name?: string;
    fields: Array<{
      type: string;
      name?: string;
      id?: string;
      placeholder?: string;
      label?: string;
      selector: string;
      required: boolean;
    }>;
  }>;
  buttons: Array<{
    text: string;
    selector: string;
  }>;
  links: Array<{
    text: string;
    href: string;
    selector: string;
  }>;
  metadata: {
    hasLogin: boolean;
    hasSignup: boolean;
    hasSearch: boolean;
    hasCheckout: boolean;
  };
}

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSteps: (steps: UIStep[]) => void;
}

export function AIAnalysisModal({ isOpen, onClose, onAddSteps }: AIAnalysisModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pageAnalysis, setPageAnalysis] = useState<PageAnalysisResult | null>(null);
  const [suggestedSteps, setSuggestedSteps] = useState<UIStep[]>([]);
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      analyzeCurrentPage();
    } else {
      // Reset state when modal closes
      setPageAnalysis(null);
      setSuggestedSteps([]);
      setSelectedSteps(new Set());
      setError(null);
    }
  }, [isOpen]);

  const analyzeCurrentPage = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found. Please open a web page first.');
      }

      // Inject content script if needed
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
      } catch {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Get full page analysis from content script
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'analyzer:getFullAnalysis' });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to analyze page');
      }

      setPageAnalysis(response.analysis);
    } catch (err: any) {
      console.error('Page analysis error:', err);
      setError(err.message || 'Failed to analyze page');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateTestSteps = async () => {
    if (!pageAnalysis) return;

    setIsGenerating(true);
    setError(null);

    try {
      const aiService = new AIService();
      await aiService.initialize();

      // Create context string from analysis
      const context = formatPageContext(pageAnalysis);

      const steps = await aiService.analyzePageAndSuggestTests(context);
      setSuggestedSteps(steps);

      // Select all steps by default
      setSelectedSteps(new Set(steps.map(s => s.id)));
    } catch (err: any) {
      console.error('AI generation error:', err);
      setError(err.message || 'Failed to generate test steps');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatPageContext = (analysis: PageAnalysisResult): string => {
    let context = `URL: ${analysis.url}\nTitle: ${analysis.title}\n\n`;

    if (analysis.forms.length > 0) {
      context += `Forms (${analysis.forms.length}):\n`;
      analysis.forms.forEach((form, i) => {
        context += `  Form ${i + 1}${form.id ? ` (id="${form.id}")` : ''}:\n`;
        form.fields.forEach(field => {
          const label = field.label || field.placeholder || field.name || 'field';
          context += `    - ${field.type}: ${label} [${field.selector}]${field.required ? ' *required' : ''}\n`;
        });
      });
    }

    if (analysis.buttons.length > 0) {
      context += `\nButtons (${Math.min(analysis.buttons.length, 10)}):\n`;
      analysis.buttons.slice(0, 10).forEach(btn => {
        context += `  - "${btn.text}" [${btn.selector}]\n`;
      });
    }

    if (analysis.metadata.hasLogin) context += `\nDetected: Login page\n`;
    if (analysis.metadata.hasSignup) context += `Detected: Signup page\n`;
    if (analysis.metadata.hasSearch) context += `Detected: Search functionality\n`;
    if (analysis.metadata.hasCheckout) context += `Detected: Checkout/Payment page\n`;

    return context;
  };

  const toggleStep = (stepId: string) => {
    const newSelected = new Set(selectedSteps);
    if (newSelected.has(stepId)) {
      newSelected.delete(stepId);
    } else {
      newSelected.add(stepId);
    }
    setSelectedSteps(newSelected);
  };

  const handleAddSelected = () => {
    const stepsToAdd = suggestedSteps.filter(s => selectedSteps.has(s.id));
    if (stepsToAdd.length > 0) {
      onAddSteps(stepsToAdd);
      toast.success(`Added ${stepsToAdd.length} test steps`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-dark-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-gradient-to-r from-purple-900/30 to-blue-900/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-dark-100">AI Page Analysis</h2>
          </div>
          <button onClick={onClose} className="btn btn-icon btn-sm btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[60vh] p-4">
          {/* Error State */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium">Error</p>
                  <p className="text-red-200/80 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-4" />
              <p className="text-dark-300">Analyzing page elements...</p>
            </div>
          )}

          {/* Page Analysis Results */}
          {pageAnalysis && !isAnalyzing && (
            <div className="space-y-4">
              {/* Page Info */}
              <div className="bg-dark-800 rounded-lg p-3">
                <p className="text-sm text-dark-400">Page</p>
                <p className="text-dark-100 font-medium truncate">{pageAnalysis.title}</p>
                <p className="text-xs text-dark-500 truncate">{pageAnalysis.url}</p>
              </div>

              {/* Detected Patterns */}
              {(pageAnalysis.metadata.hasLogin || pageAnalysis.metadata.hasSignup ||
                pageAnalysis.metadata.hasSearch || pageAnalysis.metadata.hasCheckout) && (
                <div className="flex flex-wrap gap-2">
                  {pageAnalysis.metadata.hasLogin && (
                    <span className="px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-full">Login Page</span>
                  )}
                  {pageAnalysis.metadata.hasSignup && (
                    <span className="px-2 py-1 bg-green-900/30 text-green-300 text-xs rounded-full">Signup Page</span>
                  )}
                  {pageAnalysis.metadata.hasSearch && (
                    <span className="px-2 py-1 bg-yellow-900/30 text-yellow-300 text-xs rounded-full">Search</span>
                  )}
                  {pageAnalysis.metadata.hasCheckout && (
                    <span className="px-2 py-1 bg-purple-900/30 text-purple-300 text-xs rounded-full">Checkout</span>
                  )}
                </div>
              )}

              {/* Detected Elements */}
              <div className="grid grid-cols-3 gap-3">
                {/* Forms */}
                <div className="bg-dark-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FormInput className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-dark-200">Forms</span>
                  </div>
                  <p className="text-2xl font-bold text-dark-100">{pageAnalysis.forms.length}</p>
                  <p className="text-xs text-dark-500">
                    {pageAnalysis.forms.reduce((sum, f) => sum + f.fields.length, 0)} fields
                  </p>
                </div>

                {/* Buttons */}
                <div className="bg-dark-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MousePointer className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-dark-200">Buttons</span>
                  </div>
                  <p className="text-2xl font-bold text-dark-100">{pageAnalysis.buttons.length}</p>
                  <p className="text-xs text-dark-500">clickable</p>
                </div>

                {/* Links */}
                <div className="bg-dark-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-dark-200">Links</span>
                  </div>
                  <p className="text-2xl font-bold text-dark-100">{pageAnalysis.links.length}</p>
                  <p className="text-xs text-dark-500">navigation</p>
                </div>
              </div>

              {/* Form Fields Detail */}
              {pageAnalysis.forms.length > 0 && (
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-dark-200 mb-2">Detected Form Fields</p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {pageAnalysis.forms.flatMap((form, fi) =>
                      form.fields.map((field, i) => (
                        <div key={`${fi}-${i}`} className="flex items-center gap-2 text-xs">
                          <span className="px-1.5 py-0.5 bg-dark-700 rounded text-dark-400">
                            {field.type}
                          </span>
                          <span className="text-dark-300 truncate">
                            {field.label || field.placeholder || field.name || field.selector}
                          </span>
                          {field.required && (
                            <span className="text-red-400">*</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Generate Button */}
              {suggestedSteps.length === 0 && (
                <button
                  onClick={generateTestSteps}
                  disabled={isGenerating}
                  className="w-full btn btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating test steps...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Test Steps with AI
                    </>
                  )}
                </button>
              )}

              {/* Suggested Steps */}
              {suggestedSteps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-dark-200">
                    Suggested Test Steps ({selectedSteps.size}/{suggestedSteps.length} selected)
                  </p>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {suggestedSteps.map((step) => (
                      <button
                        key={step.id}
                        onClick={() => toggleStep(step.id)}
                        className={clsx(
                          'w-full text-left p-3 rounded-lg border transition-all',
                          selectedSteps.has(step.id)
                            ? 'bg-purple-900/20 border-purple-500/50'
                            : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={clsx(
                            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                            selectedSteps.has(step.id)
                              ? 'bg-purple-500 border-purple-500'
                              : 'border-dark-500'
                          )}>
                            {selectedSteps.has(step.id) && (
                              <CheckCircle className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-dark-100">{step.name}</p>
                            {step.description && (
                              <p className="text-xs text-dark-400 mt-0.5">{step.description}</p>
                            )}
                            <p className="text-xs text-dark-500 mt-1 font-mono truncate">
                              {step.selectors?.[0]?.value || 'No selector'}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700 bg-dark-850">
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          {suggestedSteps.length > 0 && (
            <button
              onClick={handleAddSelected}
              disabled={selectedSteps.size === 0}
              className="btn btn-primary"
            >
              Add {selectedSteps.size} Steps
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
