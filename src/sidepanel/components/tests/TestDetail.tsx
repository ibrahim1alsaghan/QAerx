import { useState, useEffect, useRef } from 'react';
import { Play, Save, Loader2, CheckCircle, XCircle, Database, ListChecks, Sparkles, FileDown, Code, History, MoreVertical, Trash2, Pencil, Check, X, Link } from 'lucide-react';
import { TestRepository, ResultRepository } from '@/core/storage/repositories';
import type { TestRun } from '@/types/result';
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
import { logger, sendToContent } from '@/shared/utils';

interface TestDetailProps {
  testId: string;
  onBack: () => void;
  onDelete?: () => void;
}

type TabType = 'steps' | 'data';

export function TestDetail({ testId, onBack, onDelete }: TestDetailProps) {
  const [test, setTest] = useState<Test | null>(null);
  const [steps, setSteps] = useState<UIStep[]>([]);
  const [dataSets, setDataSets] = useState<Record<string, string>[]>([{}]);
  const [dataSetScenarios, setDataSetScenarios] = useState<ScenarioType[]>([]);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('steps');
  const [isRunning, setIsRunning] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
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
  // Edit mode state
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedUrl, setEditedUrl] = useState('');
  // Page direction for localized test data generation
  const [pageDirection, setPageDirection] = useState<{ direction: 'rtl' | 'ltr'; language?: string }>({ direction: 'ltr' });
  // Test run history (last 10 runs)
  const [testHistory, setTestHistory] = useState<TestRun[]>([]);

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

        // Load test run history (last 10 runs)
        ResultRepository.getByTest(testId, 10).then(setTestHistory).catch(console.error);
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

      const loadingToast = toast.loading('Detecting page direction...');

      // Get current page direction for localized data
      let direction: 'rtl' | 'ltr' = pageDirection.direction;
      let language = pageDirection.language;

      try {
        const response = await sendToContent<{ success: boolean; analysis: any }>(
          { type: 'analyzer:getFullAnalysis' }
        );
        if (response.success && response.analysis?.metadata) {
          direction = response.analysis.metadata.direction || 'ltr';
          language = response.analysis.metadata.language;
          setPageDirection({ direction, language });
        }
      } catch {
        // Use cached direction if content script fails
      }

      toast.loading('Generating test data with AI...', { id: loadingToast });

      const aiService = new AIService();
      await aiService.initialize();

      // Generate 3 data sets by default with localization
      const count = dataSets.length > 0 ? dataSets.length : 3;
      const generatedData = await aiService.generateTestData(steps, count, { direction, language });

      setDataSets(generatedData);
      setIsAIGenerated(true);
      setHasChanges(true);

      toast.dismiss(loadingToast);
      const localeMsg = direction === 'rtl' ? ' (Arabic)' : '';
      toast.success(`Generated ${generatedData.length} data sets${localeMsg} ✨`);
    } catch (error: any) {
      logger.error('AI generation error:', error);
      toast.error(error.message || 'Failed to generate data with AI');
    }
  };

  const handleGenerateScenarioData = async () => {
    try {
      if (steps.length === 0) {
        toast.error('Add test steps first before generating data');
        return;
      }

      const loadingToast = toast.loading('Detecting page direction...');

      // Get current page direction for localized data
      let direction: 'rtl' | 'ltr' = pageDirection.direction;
      let language = pageDirection.language;

      try {
        const response = await sendToContent<{ success: boolean; analysis: any }>(
          { type: 'analyzer:getFullAnalysis' }
        );
        if (response.success && response.analysis?.metadata) {
          direction = response.analysis.metadata.direction || 'ltr';
          language = response.analysis.metadata.language;
          setPageDirection({ direction, language });
        }
      } catch {
        // Use cached direction if content script fails
      }

      toast.loading('Generating scenario-based test data with AI...', { id: loadingToast });

      const aiService = new AIService();
      await aiService.initialize();

      // Generate scenario-based data sets with localization
      const result = await aiService.generateScenarioTestData(steps, { direction, language });

      setDataSets(result.dataSets);
      setDataSetScenarios(result.scenarios);
      setIsAIGenerated(true);
      setHasChanges(true);

      toast.dismiss(loadingToast);
      const localeMsg = direction === 'rtl' ? ' (Arabic)' : '';
      toast.success(`Generated ${result.dataSets.length} test scenarios${localeMsg}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate scenario data with AI';
      logger.error('AI scenario generation error:', error);
      toast.error(errorMessage);
    }
  };

  // Helper: Create steps from page analysis
  const createStepsFromAnalysis = (analysis: any, startOrder: number): UIStep[] => {
    const newSteps: UIStep[] = [];
    let order = startOrder;

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

    return newSteps;
  };

  // Smart Collect: Scan page fields + enhance with AI
  const handleSmartCollect = async () => {
    let collectedSteps: UIStep[] = [];

    try {
      setIsAnalyzing(true);
      const loadingToast = toast.loading('Scanning page...');

      // Step 1: Get full page analysis from content script
      const response = await sendToContent<{ success: boolean; analysis: any; error?: string }>(
        { type: 'analyzer:getFullAnalysis' }
      );

      if (!response.success) {
        toast.dismiss(loadingToast);
        throw new Error(response.error || 'Failed to analyze page');
      }

      const analysis = response.analysis;

      // Save page direction for localized data generation
      if (analysis.metadata) {
        setPageDirection({
          direction: analysis.metadata.direction || 'ltr',
          language: analysis.metadata.language,
        });
      }

      // Step 2: Create basic steps from analysis
      collectedSteps = createStepsFromAnalysis(analysis, steps.length);

      if (collectedSteps.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('No form fields found on this page');
        return;
      }

      // Step 3: Try to enhance with AI
      toast.loading('Enhancing with AI...', { id: loadingToast });

      try {
        const aiService = new AIService();
        await aiService.initialize();

        const enhancedSteps = await aiService.enhanceCollectedSteps(
          collectedSteps,
          analysis.metadata
        );

        setSteps((prev) => [...prev, ...enhancedSteps]);
        setHasChanges(true);

        toast.dismiss(loadingToast);
        toast.success(`Added ${enhancedSteps.length} steps with smart variables ✨`);
      } catch (aiError) {
        // AI failed - still add the basic steps
        logger.warn('AI enhancement failed, using basic steps:', aiError);
        setSteps((prev) => [...prev, ...collectedSteps]);
        setHasChanges(true);

        toast.dismiss(loadingToast);
        toast.success(`Added ${collectedSteps.length} steps (AI enhancement unavailable)`);
      }
    } catch (error: any) {
      logger.error('Smart collect error:', error);

      // If we have collected steps but got an error later, still add them
      if (collectedSteps.length > 0) {
        setSteps((prev) => [...prev, ...collectedSteps]);
        setHasChanges(true);
        toast.success(`Added ${collectedSteps.length} steps`);
      } else {
        toast.error(error.message || 'Failed to collect fields');
      }
    } finally {
      setIsAnalyzing(false);
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
      logger.error('PDF generation error:', error);
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

  const handleSaveName = async () => {
    if (!test || !editedName.trim()) return;

    try {
      await TestRepository.update(testId, { name: editedName.trim() });
      setTest({ ...test, name: editedName.trim() });
      setIsEditingName(false);
      toast.success('Test name updated');
    } catch (error) {
      toast.error('Failed to update test name');
    }
  };

  const handleSaveUrl = async () => {
    if (!test) return;

    try {
      await TestRepository.update(testId, { url: editedUrl.trim() || 'https://' });
      setTest({ ...test, url: editedUrl.trim() || 'https://' });
      setIsEditingUrl(false);
      toast.success('Test URL updated');
    } catch (error) {
      toast.error('Failed to update test URL');
    }
  };

  const startEditingName = () => {
    setEditedName(test?.name || '');
    setIsEditingName(true);
  };

  const startEditingUrl = () => {
    setEditedUrl(test?.url || '');
    setIsEditingUrl(true);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const cancelEditingUrl = () => {
    setIsEditingUrl(false);
    setEditedUrl('');
  };

  const handleDeleteTest = async () => {
    if (!test) return;

    // Confirm deletion
    const confirmed = window.confirm(`Are you sure you want to delete "${test.name}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await TestRepository.delete(testId);
      toast.success('Test deleted');
      onDelete?.();
      onBack();
    } catch (error) {
      logger.error('Failed to delete test:', error);
      toast.error('Failed to delete test');
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

    // Track results in local variable to avoid stale closure issues with React state
    const collectedResults: Array<{
      dataSetIndex: number;
      stepId: string;
      status: 'passed' | 'failed';
      error?: string;
      duration: number;
      pageResponse?: string;
      aiValidation?: any;
    }> = [];

    // Initialize AI validation service
    const validationService = new AIValidationService();
    try {
      await validationService.initialize();
    } catch (error) {
      logger.warn('AI validation not available, using fallback:', error);
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

                  // Handle page navigation during execution (message channel closed)
                  if (response?.navigated === true) {
                    logger.warn('Page navigated during step execution, some steps may not have completed');
                    // Continue without error - navigation is expected in some test flows
                  } else if (response?.result?.stepResults) {
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
                        collectedResults.push(validatedResult);
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
                  // Check if this is a navigation-related error
                  const errorMsg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
                  if (errorMsg.includes('message channel closed') ||
                      errorMsg.includes('receiving end does not exist') ||
                      errorMsg.includes('context invalidated')) {
                    logger.warn('Page navigation detected during step execution');
                    // Continue without throwing - this is expected when page navigates
                  } else {
                    logger.error('Error executing steps before navigation:', error);
                    throw new Error(`Step execution failed: ${error instanceof Error ? error.message : String(error)}`);
                  }
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
                const passedResult = { dataSetIndex, stepId: step.id, status: 'passed' as const, duration };
                collectedResults.push(passedResult);
                setRunProgress((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    currentStepId: null,
                    results: [...prev.results, passedResult],
                  };
                });
              } catch (error) {
                // Mark step as failed
                const failedResult = {
                  dataSetIndex,
                  stepId: step.id,
                  status: 'failed' as const,
                  error: `${step.action.type === 'navigate' ? 'Navigation' : 'Wait'} failed: ${error instanceof Error ? error.message : String(error)}`,
                  duration: 0
                };
                collectedResults.push(failedResult);
                setRunProgress((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    currentStepId: null,
                    results: [...prev.results, failedResult],
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

              // Handle page navigation during execution (message channel closed)
              if (response?.navigated === true) {
                logger.warn('Page navigated during remaining step execution');
                // Continue without error - navigation may be expected
              } else if (response?.result?.stepResults) {
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
                    collectedResults.push(validatedResult);
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
              // Check if this is a navigation-related error
              const errorMsg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
              if (errorMsg.includes('message channel closed') ||
                  errorMsg.includes('receiving end does not exist') ||
                  errorMsg.includes('context invalidated')) {
                logger.warn('Page navigation detected during remaining step execution');
                // Continue without throwing - this is expected when page navigates
              } else {
                logger.error('Error executing remaining steps:', error);
                throw new Error(`Step execution failed: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
          }
        } finally {
          chrome.runtime.onMessage.removeListener(progressListener);
        }
      }

      toast.success('Test completed!');

      // Save test run to history using collectedResults (not runProgress which has stale closure)
      if (test) {
        try {
          const passed = collectedResults.filter(r => r.status === 'passed').length;
          const failed = collectedResults.filter(r => r.status === 'failed').length;
          // Mark as error if no steps were executed (empty test somehow got through)
          const status = collectedResults.length === 0 ? 'error' : (failed > 0 ? 'failed' : 'passed');

          const testRun = await ResultRepository.create(test.id, test.suiteId);
          await ResultRepository.update(testRun.id, {
            completedAt: Date.now(),
            status,
            summary: {
              totalSteps: collectedResults.length,
              passedSteps: passed,
              failedSteps: failed,
              skippedSteps: 0,
              duration: Date.now() - testRun.startedAt,
            },
          });

          // Refresh history
          const history = await ResultRepository.getByTest(test.id, 10);
          setTestHistory(history);
        } catch (historyError) {
          logger.warn('Failed to save test run to history:', historyError);
        }
      }
    } catch (error) {
      logger.error('Test execution error:', error);
      toast.error('Test execution failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsRunning(false);
    }
  };

  // Close dropdown when clicking outside (must be before conditional returns)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      {/* Clean Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group flex-1 min-w-0">
          {/* Test info */}
          <div className="min-w-0 flex-1">
            {/* Test Name */}
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') cancelEditingName();
                    }}
                    className="input text-sm py-0.5 px-2 flex-1 min-w-0"
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="p-1 hover:bg-dark-700 rounded text-green-400">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={cancelEditingName} className="p-1 hover:bg-dark-700 rounded text-dark-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-dark-100 truncate">{test.name}</span>
                  <button
                    onClick={startEditingName}
                    className="p-1 hover:bg-dark-700 rounded text-dark-500 hover:text-dark-300"
                    title="Edit test name"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  {testHistory.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs" title={`Last ${testHistory.length} runs`}>
                      <History className="w-3 h-3 text-dark-500" />
                      <span className="text-green-400">{testHistory.filter(r => r.status === 'passed').length}</span>
                      <span className="text-dark-600">/</span>
                      <span className="text-red-400">{testHistory.filter(r => r.status === 'failed').length}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Test URL */}
            <div className="flex items-center gap-1 mt-0.5">
              {isEditingUrl ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="text"
                    value={editedUrl}
                    onChange={(e) => setEditedUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveUrl();
                      if (e.key === 'Escape') cancelEditingUrl();
                    }}
                    placeholder="https://example.com"
                    className="input text-xs py-0.5 px-2 flex-1 min-w-0"
                    autoFocus
                  />
                  <button onClick={handleSaveUrl} className="p-1 hover:bg-dark-700 rounded text-green-400">
                    <Check className="w-3 h-3" />
                  </button>
                  <button onClick={cancelEditingUrl} className="p-1 hover:bg-dark-700 rounded text-dark-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <Link className="w-3 h-3 text-dark-500 flex-shrink-0" />
                  <span className="text-xs text-dark-500 truncate max-w-[200px]" title={test.url}>
                    {test.url || 'No URL set'}
                  </span>
                  <button
                    onClick={startEditingUrl}
                    className="p-0.5 hover:bg-dark-700 rounded text-dark-500 hover:text-dark-300"
                    title="Edit test URL"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="toolbar-group">
          {/* More menu (secondary actions) */}
          {!isRunning && (
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="btn btn-sm btn-ghost"
                title="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMoreMenu && (
                <div className="dropdown-menu right-0 top-full mt-1 animate-fade-in">
                  {activeTab === 'steps' && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleSmartCollect();
                      }}
                      disabled={isAnalyzing}
                      className="dropdown-item w-full text-left"
                    >
                      {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-cyan-400" />}
                      Smart Collect
                    </button>
                  )}
                  {steps.length > 0 && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowExportModal(true);
                      }}
                      className="dropdown-item w-full text-left"
                    >
                      <Code className="w-4 h-4 text-orange-400" />
                      Export to Code
                    </button>
                  )}
                  {runProgress && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleDownloadReport();
                      }}
                      className="dropdown-item w-full text-left"
                    >
                      <FileDown className="w-4 h-4 text-blue-400" />
                      Download Report
                    </button>
                  )}
                  <div className="dropdown-divider" />
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleDeleteTest();
                    }}
                    className="dropdown-item-danger w-full text-left"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Test
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Save button (only when changes) */}
          {hasChanges && (
            <button onClick={handleSave} className="btn btn-sm btn-secondary">
              <Save className="w-4 h-4" />
              Save
            </button>
          )}

          {/* Primary action: Run Test */}
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
                Run
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
