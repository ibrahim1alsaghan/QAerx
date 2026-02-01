import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Save, Loader2, CheckCircle, XCircle, Database, ListChecks, Sparkles, FileDown, Code, Scan } from 'lucide-react';
import { TestRepository } from '@/core/storage/repositories';
import { StepEditor } from '../steps/StepEditor';
import { DataPanel } from '../data/DataPanel';
import { ExportModal } from '../export/ExportModal';
import type { Test, UIStep, ScenarioType } from '@/types/test';
import type { ValidationContext, AIValidationData } from '@/types/validation';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { AIService } from '@/core/services/AIService';
import { AIValidationService } from '@/core/services/AIValidationService';
import { PDFReportService } from '@/core/services/PDFReportService';

interface TestDetailProps {
  testId: string;
  onBack: () => void;
}

type TabType = 'steps' | 'data';

export function TestDetail({ testId, onBack }: TestDetailProps) {
  const [test, setTest] = useState<Test | null>(null);
  const [steps, setSteps] = useState<UIStep[]>([]);
  const [dataSets, setDataSets] = useState<Record<string, string>[]>([{}]);
  const [dataSetScenarios, setDataSetScenarios] = useState<ScenarioType[]>([]);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('steps');
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<{
    currentStep: number;
    total: number;
    currentDataSet: number;
    totalDataSets: number;
    currentStepId: string | null;
    results: Array<{
      dataSetIndex: number;
      stepId: string;
      status: 'passed' | 'failed';
      error?: string;
      duration?: number;
      pageResponse?: string;
      aiValidation?: AIValidationData;
    }>;
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    TestRepository.getById(testId).then((t) => {
      if (t) {
        setTest(t);
        setSteps(t.steps as UIStep[]);
        setDataSets(t.dataSource?.data as Record<string, string>[] || [{}]);
        // Restore scenarios from storage
        const storedScenarios = t.dataSource?.scenarios;
        if (storedScenarios && Array.isArray(storedScenarios)) {
          setDataSetScenarios(storedScenarios as ScenarioType[]);
        }
        setIsAIGenerated(t.dataSource?.type === 'ai-generated');
      }
    });
  }, [testId]);

  const handleStepsChange = (newSteps: UIStep[]) => {
    setSteps(newSteps);
    setHasChanges(true);
  };

  const handleDataSetsChange = (newDataSets: Record<string, string>[]) => {
    setDataSets(newDataSets);
    setDataSetScenarios([]); // Clear scenarios on manual edit
    setIsAIGenerated(false); // Manual edits = not AI generated
    setHasChanges(true);
  };

  const handleGenerateWithAI = async () => {
    try {
      if (steps.length === 0) {
        toast.error('Add test steps first before generating data');
        return;
      }

      const loadingToast = toast.loading('Generating test data with AI...');

      const aiService = new AIService();
      await aiService.initialize();

      // Generate 3 data sets by default
      const count = dataSets.length > 0 ? dataSets.length : 3;
      const generatedData = await aiService.generateTestData(steps, count);

      setDataSets(generatedData);
      setIsAIGenerated(true);
      setHasChanges(true);

      toast.dismiss(loadingToast);
      toast.success(`Generated ${generatedData.length} data sets with AI ✨`);
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast.error(error.message || 'Failed to generate data with AI');
    }
  };

  const handleGenerateScenarioData = async () => {
    try {
      if (steps.length === 0) {
        toast.error('Add test steps first before generating data');
        return;
      }

      const loadingToast = toast.loading('Generating scenario-based test data with AI...');

      const aiService = new AIService();
      await aiService.initialize();

      // Generate scenario-based data sets (best case, worst case, edge case, boundary)
      const result = await aiService.generateScenarioTestData(steps, {
        bestCase: 1,
        worstCase: 2,
        edgeCase: 1,
        boundary: 1,
      });

      setDataSets(result.dataSets);
      setDataSetScenarios(result.scenarios);
      setIsAIGenerated(true);
      setHasChanges(true);

      toast.dismiss(loadingToast);
      toast.success(`Generated ${result.dataSets.length} scenario data sets (Best/Worst/Edge/Boundary) ✨`);
    } catch (error: any) {
      console.error('AI scenario generation error:', error);
      toast.error(error.message || 'Failed to generate scenario data with AI');
    }
  };

  const handleAIAnalyzePage = async () => {
    try {
      setIsAnalyzing(true);
      const loadingToast = toast.loading('Analyzing page with AI...');

      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
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

      // Get page context from content script
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'analyzer:getPageContext' });

      const aiService = new AIService();
      await aiService.initialize();

      // Analyze page and get suggested test steps
      const suggestedSteps = await aiService.analyzePageAndSuggestTests(response.context);

      // Add suggested steps to current test
      setSteps((prev) => [...prev, ...suggestedSteps]);
      setHasChanges(true);

      toast.dismiss(loadingToast);
      toast.success(`AI suggested ${suggestedSteps.length} test steps ✨`);
    } catch (error: any) {
      console.error('AI analysis error:', error);
      toast.error(error.message || 'Failed to analyze page with AI');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCollectFields = async () => {
    try {
      const loadingToast = toast.loading('Scanning page for form fields...');

      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
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

      if (!response.success) {
        throw new Error(response.error || 'Failed to analyze page');
      }

      const analysis = response.analysis;

      // Create steps from detected fields
      const newSteps: UIStep[] = [];
      let order = steps.length;

      // Track used variable names to avoid collisions
      const usedVarNames = new Set<string>();
      const getUniqueVarName = (baseName: string): string => {
        let sanitized = baseName
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .toLowerCase();
        if (/^\d/.test(sanitized)) sanitized = 'field_' + sanitized;
        if (!sanitized) sanitized = 'field';

        let finalName = sanitized;
        let counter = 1;
        while (usedVarNames.has(finalName)) {
          finalName = `${sanitized}_${counter}`;
          counter++;
        }
        usedVarNames.add(finalName);
        return finalName;
      };

      // Process all forms
      analysis.forms.forEach((form: any) => {
        form.fields.forEach((field: any) => {
          const fieldName = field.label || field.placeholder || field.name || field.id || 'field';
          const varName = getUniqueVarName(field.name || field.id || fieldName);
          // Use confidence from PageAnalyzer, fallback to 0.75 if not provided
          const confidence = field.confidence ?? 0.75;

          if (field.type === 'text' || field.type === 'email' || field.type === 'password' || field.type === 'tel' || field.type === 'number' || field.type === 'textarea' || field.type === 'search' || field.type === 'url') {
            newSteps.push({
              id: crypto.randomUUID(),
              type: 'ui',
              order: order++,
              name: `Enter ${fieldName}`,
              enabled: true,
              continueOnFailure: false,
              action: { type: 'type', text: `{{${varName}}}` },
              selectors: [{ type: 'css', value: field.selector, priority: 0, confidence }],
            });
          } else if (field.type === 'select' || field.type === 'select-one' || field.type === 'select-multiple') {
            newSteps.push({
              id: crypto.randomUUID(),
              type: 'ui',
              order: order++,
              name: `Select ${fieldName}`,
              enabled: true,
              continueOnFailure: false,
              action: { type: 'select', value: `{{${varName}}}` },
              selectors: [{ type: 'css', value: field.selector, priority: 0, confidence }],
            });
          } else if (field.type === 'checkbox' || field.type === 'radio') {
            newSteps.push({
              id: crypto.randomUUID(),
              type: 'ui',
              order: order++,
              name: `Check ${fieldName}`,
              enabled: true,
              continueOnFailure: false,
              action: { type: 'check' },
              selectors: [{ type: 'css', value: field.selector, priority: 0, confidence }],
            });
          } else if (field.type === 'date' || field.type === 'datetime-local' || field.type === 'time' || field.type === 'month' || field.type === 'week') {
            newSteps.push({
              id: crypto.randomUUID(),
              type: 'ui',
              order: order++,
              name: `Enter ${fieldName}`,
              enabled: true,
              continueOnFailure: false,
              action: { type: 'type', text: `{{${varName}}}` },
              selectors: [{ type: 'css', value: field.selector, priority: 0, confidence }],
            });
          }
        });
      });

      // Process standalone inputs
      analysis.inputs.forEach((input: any) => {
        const fieldName = input.label || input.placeholder || input.name || input.id || 'field';
        const varName = getUniqueVarName(input.name || input.id || fieldName);
        const confidence = input.confidence ?? 0.75;

        if (input.type === 'text' || input.type === 'email' || input.type === 'password' || input.type === 'tel' || input.type === 'number' || input.type === 'textarea' || input.type === 'search' || input.type === 'url') {
          newSteps.push({
            id: crypto.randomUUID(),
            type: 'ui',
            order: order++,
            name: `Enter ${fieldName}`,
            enabled: true,
            continueOnFailure: false,
            action: { type: 'type', text: `{{${varName}}}` },
            selectors: [{ type: 'css', value: input.selector, priority: 0, confidence }],
          });
        }
      });

      // Add submit button if found - prefer login/signin buttons for login forms
      let submitButton = analysis.buttons.find((btn: any) =>
        btn.text.toLowerCase().includes('login') ||
        btn.text.toLowerCase().includes('sign in') ||
        btn.text.toLowerCase().includes('log in')
      );

      if (!submitButton) {
        submitButton = analysis.buttons.find((btn: any) =>
          btn.type === 'submit' ||
          btn.text.toLowerCase().includes('submit') ||
          btn.text.toLowerCase().includes('save') ||
          btn.text.toLowerCase().includes('create') ||
          btn.text.toLowerCase().includes('register') ||
          btn.text.toLowerCase().includes('sign up')
        );
      }

      if (submitButton) {
        const confidence = submitButton.confidence ?? 0.75;
        newSteps.push({
          id: crypto.randomUUID(),
          type: 'ui',
          order: order++,
          name: `Click ${submitButton.text}`,
          enabled: true,
          continueOnFailure: false,
          action: { type: 'click' },
          selectors: [{ type: 'css', value: submitButton.selector, priority: 0, confidence }],
        });
      }

      if (newSteps.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('No form fields found on this page');
        return;
      }

      setSteps((prev) => [...prev, ...newSteps]);
      setHasChanges(true);

      toast.dismiss(loadingToast);
      const formCount = analysis.forms.length;
      const inputCount = analysis.inputs.length;
      toast.success(`Added ${newSteps.length} steps from ${formCount} form${formCount !== 1 ? 's' : ''} and ${inputCount} standalone input${inputCount !== 1 ? 's' : ''}`);
    } catch (error: any) {
      console.error('Collect fields error:', error);
      toast.error(error.message || 'Failed to collect fields');
    }
  };

  const handleDownloadReport = async () => {
    if (!test || !runProgress) return;

    try {
      const loadingToast = toast.loading('Generating PDF report...');

      // Create test object with current steps from state (not stale test.steps)
      const testWithCurrentSteps = {
        ...test,
        steps: steps,
      };

      await PDFReportService.generateReport({
        test: testWithCurrentSteps,
        dataSets,
        dataSetScenarios: dataSetScenarios.length > 0 ? dataSetScenarios : undefined,
        results: runProgress.results,
        startedAt: Date.now() - (runProgress.results.reduce((sum, r) => sum + (r.duration || 0), 0)),
        completedAt: Date.now(),
      });

      toast.dismiss(loadingToast);
      toast.success('PDF report downloaded ✨');
    } catch (error: any) {
      console.error('PDF generation error:', error);
      toast.error(error.message || 'Failed to generate PDF report');
    }
  };

  const handleSave = async () => {
    if (!test) return;

    try {
      await TestRepository.update(testId, {
        steps,
        dataSource: {
          type: isAIGenerated ? 'ai-generated' : 'manual',
          data: dataSets,
          scenarios: dataSetScenarios.length > 0 ? dataSetScenarios : undefined,
        },
      });

      // Update the test state to keep it in sync
      setTest({
        ...test,
        steps,
        dataSource: {
          type: isAIGenerated ? 'ai-generated' : 'manual',
          data: dataSets,
          scenarios: dataSetScenarios.length > 0 ? dataSetScenarios : undefined,
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

    // Initialize AI validation service
    const validationService = new AIValidationService();
    try {
      await validationService.initialize();
    } catch (error) {
      console.warn('AI validation not available, using fallback:', error);
    }

    // Helper function to validate a step result with AI
    const validateStepResult = async (
      stepResult: { stepId: string; status: string; error?: string; pageResponse?: string; context?: any },
      step: UIStep,
      dataSetIndex: number,
      variables: Record<string, string>,
      previousUrl: string
    ) => {
      const scenario = dataSetScenarios[dataSetIndex] || 'normal';

      // If step already failed due to execution error, keep it as failed
      if (stepResult.status === 'failed' && stepResult.error) {
        return {
          dataSetIndex,
          stepId: stepResult.stepId,
          status: 'failed' as const,
          error: stepResult.error,
          duration: (stepResult as any).duration || 0,
          pageResponse: stepResult.pageResponse,
        };
      }

      // Build validation context
      const validationContext: ValidationContext = {
        stepName: step.name,
        stepIndex: steps.findIndex(s => s.id === step.id),
        totalSteps: steps.length,
        actionType: step.action.type,
        actionDescription: getActionDescription(step),
        pageResponse: stepResult.pageResponse,
        urlBefore: previousUrl,
        urlAfter: stepResult.context?.urlAfter || previousUrl,
        titleBefore: stepResult.context?.titleBefore || '',
        titleAfter: stepResult.context?.titleAfter || '',
        scenario,
        variables,
      };

      // Validate with AI
      const validation = await validationService.validateStep(validationContext);

      return {
        dataSetIndex,
        stepId: stepResult.stepId,
        status: validation.status,
        error: validation.status === 'failed' ? validation.reason : undefined,
        duration: (stepResult as any).duration || 0,
        pageResponse: stepResult.pageResponse,
        aiValidation: validationService.toAIValidationData(validation),
      };
    };

    // Helper to get action description for AI context
    const getActionDescription = (step: UIStep): string => {
      const action = step.action as any;
      switch (action.type) {
        case 'type': return `Type "${action.text}" into field`;
        case 'click': return `Click on element`;
        case 'navigate': return `Navigate to ${action.url}`;
        case 'select': return `Select option "${action.value}"`;
        case 'waitTime': return `Wait ${action.duration}ms`;
        default: return action.type;
      }
    };

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
                    // Validate each step result with AI
                    for (const stepResult of response.result.stepResults) {
                      const step = currentSteps.find(s => s.id === stepResult.stepId);
                      if (step) {
                        const validatedResult = await validateStepResult(
                          stepResult,
                          step,
                          dataSetIndex,
                          variables,
                          tab.url || ''
                        );
                        setRunProgress((prev) => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            results: [...prev.results, validatedResult],
                          };
                        });
                      }
                    }
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
                // Validate each step result with AI
                for (const stepResult of response.result.stepResults) {
                  const step = currentSteps.find(s => s.id === stepResult.stepId);
                  if (step) {
                    const validatedResult = await validateStepResult(
                      stepResult,
                      step,
                      dataSetIndex,
                      variables,
                      tab.url || ''
                    );
                    setRunProgress((prev) => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        results: [...prev.results, validatedResult],
                      };
                    });
                  }
                }
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
          {activeTab === 'steps' && !isRunning && (
            <>
              <button
                onClick={handleCollectFields}
                className="btn btn-sm btn-ghost text-cyan-400 hover:bg-cyan-400/10"
                title="Scan page and collect all form fields"
              >
                <Scan className="w-4 h-4" />
                Collect Fields
              </button>
              <button
                onClick={handleAIAnalyzePage}
                disabled={isAnalyzing}
                className="btn btn-sm btn-ghost text-purple-400 hover:bg-purple-400/10"
                title="AI analyze page and suggest test steps"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI Analyze
              </button>
            </>
          )}
          {steps.length > 0 && !isRunning && (
            <button
              onClick={() => setShowExportModal(true)}
              className="btn btn-sm btn-ghost text-orange-400 hover:bg-orange-400/10"
              title="Export test to Playwright, Cypress, or Selenium"
            >
              <Code className="w-4 h-4" />
              Export
            </button>
          )}
          {runProgress && !isRunning && (
            <button
              onClick={handleDownloadReport}
              className="btn btn-sm btn-ghost text-blue-400 hover:bg-blue-400/10"
              title="Download PDF test report"
            >
              <FileDown className="w-4 h-4" />
              Report
            </button>
          )}
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
            onGenerateWithAI={handleGenerateWithAI}
            onGenerateScenarioData={handleGenerateScenarioData}
            dataSetScenarios={dataSetScenarios}
          />
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        test={{ ...test, steps }}
        dataSets={dataSets}
      />
    </div>
  );
}
