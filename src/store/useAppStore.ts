'use client';

import { create } from 'zustand';
import {
  AppState,
  CheckType,
  CheckConfig,
  Transcript,
  AnalysisResult,
  AggregatedIssue,
  AggregatedScenario,
  IssueType,
  Severity,
  DetectedIssue,
  Scenario,
  CriticalAlertId,
  CriticalAlertSummary,
  DetectedCriticalAlert,
  CallMetadataConfig,
} from '@/types';
import { DEFAULT_CRITICAL_ALERT_CONFIGS } from '@/data/criticalAlertConfigs';
import { runDeterministicChecks, runLLMChecks } from '@/utils/criticalAlertDetection';
import {
  defaultChecks,
  demoTranscript,
  defaultReferenceScript,
} from '@/data/demoData';
import { defaultAuditPrompt } from '@/data/defaultAuditPrompt';
import { DEFAULT_DIMENSION_PROMPTS } from '@/data/dimensionPrompts';
import {
  analyzeTranscript,
  generateFixSuggestions,
  generateConsolidatedFixes,
  analyzeTranscriptScenarios,
  generateEnhancedFixSuggestions,
  generateEnhancedFixesByRCACategory,
  aggregateScenariosWithLLM,
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
): Promise<{ results: R[]; errors: Error[] }> {
  const results: R[] = [];
  const errors: Error[] = [];
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
        const err = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
        console.error(`Error processing item ${i + batchIndex}:`, err);
        errors.push(err);
      }

      // Update progress after each item completes
      if (onProgress) {
        onProgress(completed, items.length);
      }
    });
  }

  return { results, errors };
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
  dimensionPrompts: DEFAULT_DIMENSION_PROMPTS.map(d => ({
    ...d,
    prompt: d.defaultPrompt,
    enabled: true,
  })),
  openaiConfig: {
    apiKey: '',
    model: 'gpt-4.1-mini',
  },
  deduplicationEnabled: true,
  isRunning: false,
  runProgress: 0,
  currentStep: 'analyses' as const,
  results: null,
  fixes: null,
  consolidatedFixes: null,
  scenarioResults: null,
  enhancedFixes: null,
  aggregatedIssues: null,
  aggregatedScenarios: null,
  selectedCallId: null,
  selectedIssueId: null,
  selectedDimension: null,
  currentAnalysisId: null,
  currentAnalysisName: null,
  fixesApplied: false,
  criticalAlertConfigs: DEFAULT_CRITICAL_ALERT_CONFIGS,
  criticalAlertResults: null,
  criticalAlertsEnabled: true,
  printReportOnLoad: false,
  callMetadataConfig: null,
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

  updateDimensionPrompt: (id, prompt) => {
    set({ dimensionPrompts: get().dimensionPrompts.map(d => d.id === id ? { ...d, prompt } : d) });
  },

  resetDimensionPrompt: (id) => {
    set({ dimensionPrompts: get().dimensionPrompts.map(d => d.id === id ? { ...d, prompt: d.defaultPrompt } : d) });
  },

  toggleDimensionPrompt: (id) => {
    set({ dimensionPrompts: get().dimensionPrompts.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d) });
  },

  setOpenAIConfig: (config) => {
    const currentConfig = get().openaiConfig;
    set({ openaiConfig: { ...currentConfig, ...config } });
  },

  setDeduplicationEnabled: (enabled: boolean) => set({ deduplicationEnabled: enabled }),

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
    const { transcripts, checks, referenceEnabled, referenceScript, knowledgeBaseEnabled, knowledgeBase, openaiConfig, flowType, auditPrompt, dimensionPrompts } = get();

    // Get API key from environment variable - check both possible names
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    // Validate OpenAI configuration
    if (!apiKey.trim()) {
      alert('OpenAI API key is not configured. Please set OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY in your environment variables.');
      return;
    }

    set({ isRunning: true, runProgress: 0, currentStep: 'running', aggregatedIssues: null, aggregatedScenarios: null, criticalAlertResults: null });

    try {
      if (flowType === 'objective') {
        // Objective Flow: Issue-based analysis
        const totalTranscripts = transcripts.length;

        console.log(`Starting parallel analysis of ${totalTranscripts} transcripts with concurrency limit of 10`);

        // Analyze transcripts in parallel with concurrency control
        const { results: allIssuesArrays, errors: issueErrors } = await processInParallel(
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

        if (issueErrors.length > 0 && allIssuesArrays.length === 0) {
          throw new Error(`All transcript analyses failed. First error: ${issueErrors[0].message}`);
        }

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

        set({ results });
      } else {
        // Open-Ended Flow: Scenario-based analysis
        const totalTranscripts = transcripts.length;

        const enabledDimensionCount = dimensionPrompts.filter(d => d.enabled).length;
        console.log(`[runAnalysis] Open-ended: ${enabledDimensionCount}/${dimensionPrompts.length} dimensions enabled`);
        if (enabledDimensionCount === 0) {
          set({ isRunning: false, runProgress: 0 });
          alert('No audit dimensions are enabled. Please enable at least one dimension in the Audit Config settings before running analysis.');
          return;
        }

        console.log(`Starting parallel scenario analysis of ${totalTranscripts} transcripts with concurrency limit of 10`);

        // Analyze transcripts for scenarios in parallel with concurrency control
        const { callMetadataConfig } = get();
        const { results: allScenariosArrays, errors: scenarioErrors } = await processInParallel(
          transcripts,
          async (transcript, index) => {
            console.log(`Starting scenario analysis of transcript ${transcript.id} (${index + 1}/${totalTranscripts})`);
            const callMetadata = callMetadataConfig
              ? (callMetadataConfig.rows[transcript.id.trim().toLowerCase()] ?? null)
              : null;
            const scenarios = await analyzeTranscriptScenarios(
              apiKey,
              openaiConfig.model,
              transcript,
              dimensionPrompts,
              referenceEnabled ? referenceScript : null,
              knowledgeBaseEnabled ? knowledgeBase : null,
              callMetadata
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

        if (scenarioErrors.length > 0 && allScenariosArrays.length === 0) {
          throw new Error(`Dimensional audit failed for all transcripts. Error: ${scenarioErrors[0].message}`);
        } else if (scenarioErrors.length > 0) {
          console.warn(`${scenarioErrors.length} transcript(s) failed scenario analysis:`, scenarioErrors.map(e => e.message));
        }

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

        set({ scenarioResults });
      }

      // ── Critical Alert Detection (runs for both flow types) ─────────────────
      set({ runProgress: 97 });
      const { criticalAlertConfigs, criticalAlertsEnabled } = get();
      let criticalAlertResults: CriticalAlertSummary | null = null;

      if (criticalAlertsEnabled) {
        try {
          const enabledConfigs = criticalAlertConfigs.filter((c) => c.enabled);

          const deterministicAlerts: DetectedCriticalAlert[] = transcripts.flatMap((t) =>
            runDeterministicChecks(t, enabledConfigs)
          );

          const llmEnabledConfigs = enabledConfigs.filter((c) => c.detectionMethod === 'llm');
          let llmAlerts: DetectedCriticalAlert[] = [];
          if (llmEnabledConfigs.length > 0) {
            const { results: llmResultArrays } = await processInParallel(
              transcripts,
              (t) => runLLMChecks(t, llmEnabledConfigs, apiKey, openaiConfig.model),
              5
            );
            llmAlerts = llmResultArrays.flat();
          }

          const allAlerts = [...deterministicAlerts, ...llmAlerts];
          const alertsByCall: Record<string, DetectedCriticalAlert[]> = {};
          for (const alert of allAlerts) {
            if (!alertsByCall[alert.callId]) alertsByCall[alert.callId] = [];
            alertsByCall[alert.callId].push(alert);
          }
          criticalAlertResults = {
            totalAlerts: allAlerts.length,
            callsWithAlerts: Object.keys(alertsByCall).length,
            alertsByCall,
            allAlerts,
          };
        } catch (err) {
          console.error('Critical alert detection failed:', err);
        }
      }

      set({ isRunning: false, runProgress: 100, currentStep: 'results', criticalAlertResults });
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
        // Objective flow: Generate one consolidated fix per RCA category
        const consolidatedFixes = await generateConsolidatedFixes(
          apiKey,
          openaiConfig.model,
          results.issues,
          referenceEnabled ? referenceScript : undefined,
          knowledgeBaseEnabled ? knowledgeBase : undefined
        );

        set({ consolidatedFixes, currentStep: 'fixes', isRunning: false });
      } else if (flowType === 'open-ended' && scenarioResults) {
        // Open-ended flow: Generate RCA-categorized fixes
        console.log(`Aggregating ${scenarioResults.scenarios.length} scenarios...`);
        set({ runProgress: 20 });

        // Step 1: Aggregate scenarios using LLM to group similar ones
        const aggregatedScenarios = await aggregateScenariosWithLLM(
          apiKey,
          openaiConfig.model,
          scenarioResults.scenarios
        );

        console.log(`Aggregated into ${aggregatedScenarios.length} scenario groups`);
        set({ runProgress: 50 });

        // Step 2: Generate RCA-categorized fixes (one fix per RCA category)
        console.log('Generating RCA-categorized fixes...');
        const enhancedFixes = await generateEnhancedFixesByRCACategory(
          apiKey,
          openaiConfig.model,
          aggregatedScenarios,
          referenceEnabled ? referenceScript : null,
          knowledgeBaseEnabled ? knowledgeBase : null
        );

        console.log(`Generated ${enhancedFixes.length} RCA-categorized fixes`);

        set({
          enhancedFixes: { fixes: enhancedFixes },
          currentStep: 'fixes',
          isRunning: false,
          runProgress: 100
        });
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

  setAggregatedIssues: (issues: AggregatedIssue[]) => set({ aggregatedIssues: issues }),

  setAggregatedScenarios: (scenarios: AggregatedScenario[]) => set({ aggregatedScenarios: scenarios }),

  toggleCriticalAlert: (id: CriticalAlertId) => {
    set({ criticalAlertConfigs: get().criticalAlertConfigs.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c) });
  },

  toggleCriticalAlertsEnabled: () => {
    set({ criticalAlertsEnabled: !get().criticalAlertsEnabled });
  },

  setPrintReportOnLoad: (v: boolean) => set({ printReportOnLoad: v }),

  setCallMetadataConfig: (config: CallMetadataConfig | null) => set({ callMetadataConfig: config }),

  markFixesApplied: async () => {
    set({ fixesApplied: true });
    const state = get();
    // Auto-save so the flag is persisted in the DB
    if (state.currentAnalysisName) {
      await get().saveAnalysis(state.currentAnalysisName);
    }
    get().goToStep('progress');
  },

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
      dimensionPrompts: state.dimensionPrompts,
      openaiConfig: state.openaiConfig,
      results: state.results,
      fixes: state.fixes,
      consolidatedFixes: state.consolidatedFixes,
      scenarioResults: state.scenarioResults,
      enhancedFixes: state.enhancedFixes,
      selectedCallId: state.selectedCallId,
      fixesApplied: state.fixesApplied,
      aggregatedScenarios: state.aggregatedScenarios,
      aggregatedIssues: state.aggregatedIssues,
      criticalAlertConfigs: state.criticalAlertConfigs,
      criticalAlertResults: state.criticalAlertResults,
      callMetadataConfig: state.callMetadataConfig,
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
      dimensionPrompts: (analysisState.dimensionPrompts || DEFAULT_DIMENSION_PROMPTS.map(d => ({ ...d, prompt: d.defaultPrompt, enabled: true }))).map(d => ({ ...d, enabled: d.enabled ?? true })),
      openaiConfig: analysisState.openaiConfig,
      results: analysisState.results,
      fixes: analysisState.fixes,
      consolidatedFixes: analysisState.consolidatedFixes || null,
      scenarioResults: analysisState.scenarioResults,
      enhancedFixes: analysisState.enhancedFixes,
      aggregatedIssues: analysisState.aggregatedIssues ?? null,
      aggregatedScenarios: analysisState.aggregatedScenarios ?? null,
      criticalAlertConfigs: analysisState.criticalAlertConfigs ?? DEFAULT_CRITICAL_ALERT_CONFIGS,
      criticalAlertResults: analysisState.criticalAlertResults ?? null,
      callMetadataConfig: analysisState.callMetadataConfig ?? null,
      selectedCallId: analysisState.selectedCallId,
      fixesApplied: analysisState.fixesApplied || false,
      currentStep: analysisState.enhancedFixes || analysisState.consolidatedFixes || analysisState.fixes
        ? 'fixes'
        : analysisState.scenarioResults || analysisState.results
        ? 'results'
        : 'input',
    });
  },

  createNewAnalysis: (name: string, flowType, auditPrompt?: string) => {
    set({
      ...initialState,
      flowType,
      currentAnalysisId: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      currentAnalysisName: name,
      currentStep: 'input',
      auditPrompt: auditPrompt !== undefined ? auditPrompt : initialState.auditPrompt,
      dimensionPrompts: DEFAULT_DIMENSION_PROMPTS.map(d => ({ ...d, prompt: d.defaultPrompt, enabled: true })),
      fixesApplied: false,
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
