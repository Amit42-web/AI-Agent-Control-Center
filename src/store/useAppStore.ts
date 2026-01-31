'use client';

import { create } from 'zustand';
import {
  AppState,
  CheckType,
  CheckConfig,
  Transcript,
  AnalysisResult,
  IssueType,
  Severity,
  DetectedIssue,
  Scenario,
} from '@/types';
import {
  defaultChecks,
  demoTranscript,
  defaultReferenceScript,
} from '@/data/demoData';
import { defaultAuditPrompt } from '@/data/defaultAuditPrompt';
import {
  analyzeTranscript,
  generateFixSuggestions,
  analyzeTranscriptScenarios,
  generateEnhancedFixSuggestions,
} from '@/services/openai';

const STORAGE_KEY = 'voicebot-qa-storage-v1';

/**
 * Process items in parallel with concurrency control
 * @param items - Array of items to process
 * @param processFn - Async function to process each item
 * @param concurrency - Maximum number of concurrent operations (default: 10)
 * @param onProgress - Optional callback for progress updates (completed, total)
 */
async function processInParallel<T, R>(
  items: T[],
  processFn: (item: T, index: number) => Promise<R>,
  concurrency: number = 10,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let completed = 0;

  // Process items in batches with concurrency limit
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map((item, batchIndex) =>
      processFn(item, i + batchIndex)
    );

    const batchResults = await Promise.allSettled(batchPromises);

    // Extract successful results and log errors
    batchResults.forEach((result, batchIndex) => {
      completed++;
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`Error processing item ${i + batchIndex}:`, result.reason);
      }

      // Update progress after each item completes
      if (onProgress) {
        onProgress(completed, items.length);
      }
    });
  }

  return results;
}

const initialState = {
  flowType: 'objective' as const,
  resultsViewMode: 'detailed' as const,
  transcripts: [demoTranscript],
  referenceScript: defaultReferenceScript,
  referenceEnabled: true,
  knowledgeBase: '',
  knowledgeBaseEnabled: false,
  checks: defaultChecks,
  auditPrompt: defaultAuditPrompt,
  openaiConfig: {
    apiKey: '',
    model: 'gpt-4.1-mini',
  },
  isRunning: false,
  runProgress: 0,
  currentStep: 'analyses' as const,
  results: null,
  fixes: null,
  scenarioResults: null,
  enhancedFixes: null,
  selectedCallId: null,
  selectedIssueId: null,
  selectedDimension: null,
  currentAnalysisId: null,
  currentAnalysisName: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setFlowType: (flowType) => set({ flowType }),

  setResultsViewMode: (mode) => set({ resultsViewMode: mode }),

  setTranscripts: (transcripts: Transcript[]) => set({ transcripts }),

  setReferenceScript: (script: string) => set({ referenceScript: script }),

  setReferenceEnabled: (enabled: boolean) => {
    set({ referenceEnabled: enabled });
    // Auto-disable flow compliance if reference is disabled
    if (!enabled) {
      const checks = get().checks.map((check) =>
        check.id === 'flow_compliance' ? { ...check, enabled: false } : check
      );
      set({ checks });
    }
  },

  setKnowledgeBase: (kb: string) => set({ knowledgeBase: kb }),

  setKnowledgeBaseEnabled: (enabled: boolean) => set({ knowledgeBaseEnabled: enabled }),

  setAuditPrompt: (prompt: string) => set({ auditPrompt: prompt }),

  setOpenAIConfig: (config) => {
    const currentConfig = get().openaiConfig;
    set({ openaiConfig: { ...currentConfig, ...config } });
  },

  toggleCheck: (checkId: CheckType) => {
    const { checks, referenceEnabled } = get();
    set({
      checks: checks.map((check) => {
        if (check.id === checkId) {
          // Prevent enabling flow_compliance without reference
          if (check.requiresReference && !referenceEnabled) {
            return check;
          }
          return { ...check, enabled: !check.enabled };
        }
        return check;
      }),
    });
  },

  updateCheckInstructions: (checkId: CheckType, instructions: string) => {
    const { checks } = get();
    set({
      checks: checks.map((check) =>
        check.id === checkId ? { ...check, instructions } : check
      ),
    });
  },

  updateCheckName: (checkId: CheckType, name: string) => {
    const { checks } = get();
    set({
      checks: checks.map((check) =>
        check.id === checkId ? { ...check, name } : check
      ),
    });
  },

  addCustomCheck: (check: CheckConfig) => {
    const { checks } = get();
    set({ checks: [...checks, { ...check, custom: true }] });
  },

  deleteCustomCheck: (checkId: CheckType) => {
    const { checks } = get();
    const check = checks.find(c => c.id === checkId);
    if (check && check.custom) {
      set({ checks: checks.filter(c => c.id !== checkId) });
    }
  },

  resetCheckInstructions: (checkId: CheckType) => {
    const { checks } = get();
    set({
      checks: checks.map((check) =>
        check.id === checkId
          ? { ...check, instructions: check.defaultInstructions }
          : check
      ),
    });
  },

  resetAllToDefaults: () => {
    set({
      ...initialState,
      currentStep: 'input',
      results: null,
      fixes: null,
    });
  },

  runAnalysis: async () => {
    const { transcripts, checks, referenceEnabled, referenceScript, knowledgeBaseEnabled, knowledgeBase, openaiConfig, flowType, auditPrompt } = get();

    // Get API key from environment variable - check both possible names
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    // Validate OpenAI configuration
    if (!apiKey.trim()) {
      alert('OpenAI API key is not configured. Please set OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY in your environment variables.');
      return;
    }

    set({ isRunning: true, runProgress: 0, currentStep: 'running' });

    try {
      if (flowType === 'objective') {
        // Objective Flow: Issue-based analysis
        const totalTranscripts = transcripts.length;

        console.log(`Starting parallel analysis of ${totalTranscripts} transcripts with concurrency limit of 10`);

        // Analyze transcripts in parallel with concurrency control
        const allIssuesArrays = await processInParallel(
          transcripts,
          async (transcript, index) => {
            console.log(`Starting analysis of transcript ${transcript.id} (${index + 1}/${totalTranscripts})`);
            const issues = await analyzeTranscript(
              apiKey,
              openaiConfig.model,
              transcript,
              checks,
              referenceEnabled ? referenceScript : null,
              knowledgeBaseEnabled ? knowledgeBase : null
            );
            console.log(`Completed analysis of transcript ${transcript.id}, found ${issues.length} issues`);
            return issues;
          },
          10, // Concurrency limit: process 10 transcripts at a time
          (completed, total) => {
            // Update progress: reserve last 10% for aggregation
            const progress = Math.floor((completed / total) * 90);
            set({ runProgress: progress });
          }
        );

        // Flatten all issues into a single array
        const allIssues = allIssuesArrays.flat();

        set({ runProgress: 95 });

        console.log(`Analysis complete. Total issues found: ${allIssues.length}`);
        console.log('Issues by call:', allIssues.reduce((acc, issue) => {
          acc[issue.callId] = (acc[issue.callId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));

        // Calculate analytics
        const totalCalls = transcripts.length;
        const callsWithIssues = new Set(allIssues.map((i) => i.callId)).size;

        const issuesByType: Record<IssueType, number> = {
          flow_deviation: 0,
          repetition_loop: 0,
          language_mismatch: 0,
          mid_call_restart: 0,
          quality_issue: 0,
        };

        const severityDistribution: Record<Severity, number> = {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        };

        allIssues.forEach((issue) => {
          issuesByType[issue.type]++;
          severityDistribution[issue.severity]++;
        });

        const languageMismatchRate =
          totalCalls > 0
            ? (issuesByType.language_mismatch / totalCalls) * 100
            : 0;

        const results: AnalysisResult = {
          totalCalls,
          callsWithIssues,
          issues: allIssues,
          issuesByType,
          severityDistribution,
          languageMismatchRate,
        };

        set({
          isRunning: false,
          runProgress: 100,
          currentStep: 'results',
          results,
        });
      } else {
        // Open-Ended Flow: Scenario-based analysis
        const totalTranscripts = transcripts.length;

        console.log(`Starting parallel scenario analysis of ${totalTranscripts} transcripts with concurrency limit of 10`);

        // Analyze transcripts for scenarios in parallel with concurrency control
        const allScenariosArrays = await processInParallel(
          transcripts,
          async (transcript, index) => {
            console.log(`Starting scenario analysis of transcript ${transcript.id} (${index + 1}/${totalTranscripts})`);
            const scenarios = await analyzeTranscriptScenarios(
              apiKey,
              openaiConfig.model,
              transcript,
              auditPrompt,
              referenceEnabled ? referenceScript : null,
              knowledgeBaseEnabled ? knowledgeBase : null
            );
            console.log(`Completed scenario analysis of transcript ${transcript.id}, found ${scenarios.length} scenarios`);
            return scenarios;
          },
          10, // Concurrency limit: process 10 transcripts at a time
          (completed, total) => {
            // Update progress: reserve last 10% for aggregation
            const progress = Math.floor((completed / total) * 90);
            set({ runProgress: progress });
          }
        );

        // Flatten all scenarios into a single array
        const allScenarios = allScenariosArrays.flat();

        set({ runProgress: 95 });

        console.log(`Scenario analysis complete. Total scenarios found: ${allScenarios.length}`);

        // Calculate analytics for scenarios
        const severityDistribution: Record<Severity, number> = {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        };

        const scenariosByType: Record<string, number> = {
          script: 0,
          training: 0,
          process: 0,
          system: 0,
        };

        allScenarios.forEach((scenario) => {
          severityDistribution[scenario.severity]++;
          // We'll categorize based on what type of fix is likely needed later
          // For now, just count them
        });

        const scenarioResults = {
          totalScenarios: allScenarios.length,
          scenariosByType,
          scenarios: allScenarios,
          severityDistribution,
        };

        set({
          isRunning: false,
          runProgress: 100,
          currentStep: 'results',
          scenarioResults,
        });
      }
    } catch (error) {
      console.error('Error during analysis:', error);
      set({ isRunning: false, runProgress: 0 });
      alert(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  generateFixes: async () => {
    const { results, scenarioResults, referenceEnabled, referenceScript, knowledgeBaseEnabled, knowledgeBase, transcripts, openaiConfig, flowType } = get();

    if (!results && !scenarioResults) return;

    // Get API key from environment variable - check both possible names
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    // Validate OpenAI configuration
    if (!apiKey.trim()) {
      alert('OpenAI API key is not configured. Please set OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY in your environment variables.');
      return;
    }

    set({ isRunning: true, runProgress: 0 });

    try {
      if (flowType === 'objective' && results) {
        // Objective flow: Generate standard fixes
        const fixes = await generateFixSuggestions(
          apiKey,
          openaiConfig.model,
          results.issues,
          transcripts,
          referenceEnabled ? referenceScript : null,
          knowledgeBaseEnabled ? knowledgeBase : null
        );

        // Ensure fixes have the proper structure
        const validatedFixes = {
          scriptFixes: Array.isArray(fixes?.scriptFixes) ? fixes.scriptFixes : [],
          generalFixes: Array.isArray(fixes?.generalFixes) ? fixes.generalFixes : []
        };

        set({ fixes: validatedFixes, currentStep: 'fixes', isRunning: false });
      } else if (flowType === 'open-ended' && scenarioResults) {
        // Open-ended flow: Convert scenarios to issues format and use same fix generation
        const issuesFromScenarios = scenarioResults.scenarios.map((scenario, index) => ({
          id: scenario.id || `scenario-${index}`,
          type: scenario.dimension?.toLowerCase().replace(/\s+/g, '_') || 'general_quality',
          callId: scenario.callId,
          severity: scenario.severity,
          confidence: scenario.confidence,
          explanation: scenario.context,
          evidenceSnippet: scenario.context,
          lineNumbers: [1], // Scenarios don't have specific line numbers
          isCustomCheck: false
        }));

        // Generate fixes using the same function as objective flow
        const fixes = await generateFixSuggestions(
          apiKey,
          openaiConfig.model,
          issuesFromScenarios,
          transcripts,
          referenceEnabled ? referenceScript : null,
          knowledgeBaseEnabled ? knowledgeBase : null
        );

        // Ensure fixes have the proper structure
        const validatedFixes = {
          scriptFixes: Array.isArray(fixes?.scriptFixes) ? fixes.scriptFixes : [],
          generalFixes: Array.isArray(fixes?.generalFixes) ? fixes.generalFixes : []
        };

        set({ fixes: validatedFixes, currentStep: 'fixes', isRunning: false });
      }
    } catch (error) {
      console.error('Error generating fixes:', error);
      set({ isRunning: false });
      alert(`Failed to generate fixes: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or check the console for details.`);
    }
  },

  setSelectedCallId: (id: string | null) => set({ selectedCallId: id }),

  setSelectedIssueId: (id: string | null) => set({ selectedIssueId: id }),

  setSelectedDimension: (dimension: string | null) => set({ selectedDimension: dimension }),

  goToStep: (step) => {
    // Update the state
    set({ currentStep: step });

    // Push to browser history so back button works
    // Only push if running in browser (not SSR)
    if (typeof window !== 'undefined') {
      const currentState = window.history.state;
      // Only push if the step is different from current history state
      if (!currentState || currentState.step !== step) {
        window.history.pushState({ step }, '', `#${step}`);
      }
    }
  },

  // Analysis management
  getAnalysisState: () => {
    const state = get();
    return {
      flowType: state.flowType,
      transcripts: state.transcripts,
      referenceScript: state.referenceScript,
      referenceEnabled: state.referenceEnabled,
      knowledgeBase: state.knowledgeBase,
      knowledgeBaseEnabled: state.knowledgeBaseEnabled,
      checks: state.checks,
      auditPrompt: state.auditPrompt,
      openaiConfig: state.openaiConfig,
      results: state.results,
      fixes: state.fixes,
      scenarioResults: state.scenarioResults,
      enhancedFixes: state.enhancedFixes,
      selectedCallId: state.selectedCallId,
    };
  },

  restoreAnalysisState: (analysisState) => {
    set({
      flowType: analysisState.flowType,
      transcripts: analysisState.transcripts,
      referenceScript: analysisState.referenceScript,
      referenceEnabled: analysisState.referenceEnabled,
      knowledgeBase: analysisState.knowledgeBase,
      knowledgeBaseEnabled: analysisState.knowledgeBaseEnabled,
      checks: analysisState.checks,
      auditPrompt: analysisState.auditPrompt || defaultAuditPrompt,
      openaiConfig: analysisState.openaiConfig,
      results: analysisState.results,
      fixes: analysisState.fixes,
      scenarioResults: analysisState.scenarioResults,
      enhancedFixes: analysisState.enhancedFixes,
      selectedCallId: analysisState.selectedCallId,
      // Determine which step to show based on available data and flow type
      currentStep: analysisState.enhancedFixes || analysisState.fixes
        ? 'fixes'
        : analysisState.scenarioResults || analysisState.results
        ? 'results'
        : 'input',
    });
  },

  createNewAnalysis: (name: string, flowType) => {
    // Reset to initial state but keep the name and flowType
    set({
      ...initialState,
      flowType,
      currentAnalysisId: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      currentAnalysisName: name,
      currentStep: 'input',
    });
  },

  saveAnalysis: async (name: string) => {
    const state = get();
    const analysisState = get().getAnalysisState();

    // Generate ID if not exists
    let analysisId = state.currentAnalysisId;
    if (!analysisId) {
      analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      set({ currentAnalysisId: analysisId });
    }

    try {
      const response = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: analysisId,
          storageKey: STORAGE_KEY,
          name,
          state: analysisState,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save analysis');
      }

      set({ currentAnalysisName: name });
      console.log('Analysis saved successfully:', name);
    } catch (error) {
      console.error('Error saving analysis:', error);
      throw error;
    }
  },

  loadAnalysis: async (id: string) => {
    try {
      const response = await fetch(`/api/analyses?storageKey=${STORAGE_KEY}&id=${id}`);

      if (!response.ok) {
        throw new Error('Failed to load analysis');
      }

      const data = await response.json();
      const analysisState = data.state;

      set({
        currentAnalysisId: id,
        currentAnalysisName: data.name,
      });

      get().restoreAnalysisState(analysisState);
      console.log('Analysis loaded successfully:', data.name);
    } catch (error) {
      console.error('Error loading analysis:', error);
      throw error;
    }
  },
}));
