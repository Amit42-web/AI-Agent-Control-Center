'use client';

import { create } from 'zustand';
import {
  AppState,
  CheckType,
  Transcript,
  AnalysisResult,
  FixSuggestions,
  IssueType,
  Severity,
} from '@/types';
import {
  defaultChecks,
  demoTranscript,
  defaultReferenceScript,
  demoIssues,
  demoScriptFixes,
  demoGeneralFixes,
  demoBatchTranscripts,
} from '@/data/demoData';

const initialState = {
  transcripts: [demoTranscript],
  referenceScript: defaultReferenceScript,
  referenceEnabled: true,
  checks: defaultChecks,
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
    set({ isRunning: true, runProgress: 0, currentStep: 'running' });

    const { transcripts, checks, referenceEnabled } = get();

    // Simulate analysis with progress updates
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      set({ runProgress: i });
    }

    // Filter issues based on enabled checks and reference availability
    const enabledCheckTypes = checks
      .filter((c) => c.enabled)
      .map((c) => c.id);

    const issueTypeMapping: Record<CheckType, IssueType[]> = {
      flow_compliance: ['flow_deviation'],
      repetition: ['repetition_loop'],
      language_alignment: ['language_mismatch'],
      restart_reset: ['mid_call_restart'],
      general_quality: ['quality_issue'],
    };

    const allowedIssueTypes = enabledCheckTypes.flatMap(
      (ct) => issueTypeMapping[ct] || []
    );

    // If reference is disabled, remove flow_deviation issues
    const filteredIssueTypes = referenceEnabled
      ? allowedIssueTypes
      : allowedIssueTypes.filter((t) => t !== 'flow_deviation');

    // Filter demo issues based on which checks are enabled
    const filteredIssues = demoIssues.filter((issue) =>
      filteredIssueTypes.includes(issue.type)
    );

    // Calculate analytics
    const totalCalls = demoBatchTranscripts.length;
    const callsWithIssues = new Set(filteredIssues.map((i) => i.callId)).size;

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

    filteredIssues.forEach((issue) => {
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
      issues: filteredIssues,
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
  },

  generateFixes: () => {
    const { results, referenceEnabled, checks } = get();
    if (!results) return;

    const flowComplianceEnabled = checks.find(
      (c) => c.id === 'flow_compliance'
    )?.enabled;
    const generalQualityEnabled = checks.find(
      (c) => c.id === 'general_quality'
    )?.enabled;

    // Filter fixes based on what ran
    const scriptFixes =
      referenceEnabled && flowComplianceEnabled
        ? demoScriptFixes.filter((fix) =>
            results.issues.some((issue) =>
              fix.relatedIssueIds.includes(issue.id)
            )
          )
        : [];

    // General fixes for all transcript-only checks
    const generalFixes = generalQualityEnabled
      ? demoGeneralFixes.filter((fix) =>
          results.issues.some((issue) =>
            fix.relatedIssueIds.includes(issue.id)
          )
        )
      : [];

    const fixes: FixSuggestions = {
      scriptFixes,
      generalFixes,
    };

    set({ fixes, currentStep: 'fixes' });
  },

  setSelectedCallId: (id: string | null) => set({ selectedCallId: id }),

  goToStep: (step) => set({ currentStep: step }),
}));
