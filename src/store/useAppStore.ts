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
} from '@/types';
import {
  defaultChecks,
  demoTranscript,
  defaultReferenceScript,
} from '@/data/demoData';
import { analyzeTranscript, generateFixSuggestions } from '@/services/openai';

const initialState = {
  transcripts: [demoTranscript],
  referenceScript: defaultReferenceScript,
  referenceEnabled: true,
  knowledgeBase: '',
  knowledgeBaseEnabled: false,
  checks: defaultChecks,
  openaiConfig: {
    apiKey: '',
    model: 'gpt-4.1-mini',
  },
  isRunning: false,
  runProgress: 0,
  currentStep: 'input' as const,
  results: null,
  fixes: null,
  selectedCallId: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

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
    const { transcripts, checks, referenceEnabled, referenceScript, knowledgeBaseEnabled, knowledgeBase, openaiConfig } = get();

    // Get API key from environment variable - check both possible names
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    // Validate OpenAI configuration
    if (!apiKey.trim()) {
      alert('OpenAI API key is not configured. Please set OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY in your environment variables.');
      return;
    }

    set({ isRunning: true, runProgress: 0, currentStep: 'running' });

    try {
      const allIssues: DetectedIssue[] = [];
      const totalTranscripts = transcripts.length;

      // Analyze each transcript
      for (let i = 0; i < totalTranscripts; i++) {
        const transcript = transcripts[i];
        const progress = Math.floor(((i + 1) / totalTranscripts) * 90); // Reserve last 10% for aggregation
        set({ runProgress: progress });

        try {
          console.log(`Starting analysis of transcript ${transcript.id} (${i + 1}/${totalTranscripts})`);
          const issues = await analyzeTranscript(
            apiKey,
            openaiConfig.model,
            transcript,
            checks,
            referenceEnabled ? referenceScript : null,
            knowledgeBaseEnabled ? knowledgeBase : null
          );
          console.log(`Completed analysis of transcript ${transcript.id}, found ${issues.length} issues`);
          allIssues.push(...issues);
        } catch (error) {
          console.error(`Error analyzing transcript ${transcript.id}:`, error);
          alert(`Error analyzing transcript ${transcript.id}: ${error instanceof Error ? error.message : String(error)}`);
          // Continue with other transcripts
        }
      }

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
    } catch (error) {
      console.error('Error during analysis:', error);
      set({ isRunning: false, runProgress: 0 });
      alert(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  generateFixes: async () => {
    const { results, referenceEnabled, referenceScript, knowledgeBaseEnabled, knowledgeBase, transcripts, openaiConfig } = get();
    if (!results) return;

    // Get API key from environment variable - check both possible names
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    // Validate OpenAI configuration
    if (!apiKey.trim()) {
      alert('OpenAI API key is not configured. Please set OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY in your environment variables.');
      return;
    }

    set({ isRunning: true, runProgress: 0 });

    try {
      const fixes = await generateFixSuggestions(
        apiKey,
        openaiConfig.model,
        results.issues,
        transcripts,
        referenceEnabled ? referenceScript : null,
        knowledgeBaseEnabled ? knowledgeBase : null
      );

      set({ fixes, currentStep: 'fixes', isRunning: false });
    } catch (error) {
      console.error('Error generating fixes:', error);
      set({ isRunning: false });
      alert(`Failed to generate fixes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  setSelectedCallId: (id: string | null) => set({ selectedCallId: id }),

  goToStep: (step) => set({ currentStep: step }),
}));
