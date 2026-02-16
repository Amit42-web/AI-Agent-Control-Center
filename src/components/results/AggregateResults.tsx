'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { aggregateIssuesWithLLM } from '@/services/openai';
import { aggregateScenarios, aggregateScenariosWithLLM, AggregatedScenario } from '@/utils/aggregateScenarios';
import { IssueType, Severity, AggregatedIssue, CheckConfig, DetectedIssue } from '@/types';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Target, Brain, PieChart, ArrowRight } from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

const issueTypeLabels: Record<string, string> = {
  flow_deviation: 'Flow Deviation',
  repetition_loop: 'Repetition Loop',
  language_mismatch: 'Language Mismatch',
  mid_call_restart: 'Mid-Call Restart',
  quality_issue: 'Quality Issue',
};

const severityClasses: Record<Severity, string> = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
};

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const DIMENSION_COLORS = [
  '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#6366f1', '#14b8a6', '#f43f5e'
];

const ROOT_CAUSE_COLORS: Record<string, string> = {
  knowledge: '#eab308',     // yellow-500 (Knowledge Gap)
  instruction: '#06b6d4',   // cyan-500 (Instruction Gap)
  execution: '#f97316',     // orange-500 (Execution Failure)
  conversation: '#8b5cf6',  // purple-500 (Conversation Design)
  model: '#10b981',         // green-500 (Model Limitation)
};

// Dimension short labels for cleaner display
const dimensionLabels: Record<string, { short: string; icon: string }> = {
  'Conversation Control & Flow Management': { short: 'Flow Control', icon: '🔄' },
  'Temporal Dynamics & Turn-Taking': { short: 'Turn-Taking', icon: '⏱️' },
  'Context Tracking & Intent Alignment': { short: 'Context & Intent', icon: '🎯' },
  'Language Quality & Human-Likeness': { short: 'Language Quality', icon: '💬' },
  'Knowledge & Accuracy': { short: 'Knowledge', icon: '📚' },
  'Process & Policy Adherence': { short: 'Process', icon: '📋' },
  'Novel & Emerging Issues': { short: 'Novel Issues', icon: '✨' },
};

// RCA Category labels for breakdown view
const rcaCategoryLabels: Record<string, { short: string; full: string; icon: string; color: string }> = {
  'knowledge': { short: 'Knowledge Gap', full: 'Knowledge Gap', icon: '📚', color: '#eab308' },
  'instruction': { short: 'Instruction Gap', full: 'Instruction Gap', icon: '📋', color: '#06b6d4' },
  'execution': { short: 'Execution Failure', full: 'Execution Failure', icon: '⚠️', color: '#f97316' },
  'conversation': { short: 'Conversation Design', full: 'Conversation Design', icon: '💬', color: '#8b5cf6' },
  'model': { short: 'Model Limitation', full: 'Model Limitation', icon: '🤖', color: '#10b981' },
};

// Helper function to find a matching issue for a scenario
function findMatchingIssue(scenario: { callId: string; lineNumbers: number[] }, issues: DetectedIssue[]): string | null {
  if (!scenario.lineNumbers || scenario.lineNumbers.length === 0) return null;

  // Find issues in the same call
  const callIssues = issues.filter(issue => issue.callId === scenario.callId);
  if (callIssues.length === 0) return null;

  // Try to find an issue with overlapping line numbers
  const scenarioLines = new Set(scenario.lineNumbers);
  const matchingIssue = callIssues.find(issue =>
    issue.lineNumbers && issue.lineNumbers.some(line => scenarioLines.has(line))
  );

  // Return matching issue ID or the first issue in the call
  return matchingIssue?.id || callIssues[0].id;
}

export function AggregateResults() {
  const { results, checks, scenarioResults, flowType, setResultsViewMode, setSelectedCallId, setSelectedIssueId, setSelectedDimension } = useAppStore();

  // State for auto-expanding scenarios when clicking from Impact Zone
  const [autoExpandTarget, setAutoExpandTarget] = React.useState<{ scenarioId: string; timestamp: number } | null>(null);
  const rcaBreakdownRef = React.useRef<HTMLDivElement>(null);

  // State for LLM-based aggregation
  const [aggregatedIssues, setAggregatedIssues] = useState<AggregatedIssue[]>([]);
  const [isAggregating, setIsAggregating] = useState(false);
  const [aggregationError, setAggregationError] = useState<string | null>(null);

  // State for LLM-based scenario aggregation
  const [aggregatedScenarios, setAggregatedScenarios] = useState<AggregatedScenario[]>([]);
  const [isAggregatingScenarios, setIsAggregatingScenarios] = useState(false);
  const lastProcessedScenariosRef = React.useRef<number>(0);

  const getIssueTypeLabel = (type: IssueType): string => {
    if (type in issueTypeLabels) {
      return issueTypeLabels[type];
    }
    const matchingCheck = checks.find(check => check.id === type);
    if (matchingCheck) {
      return matchingCheck.name;
    }
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // LLM-based aggregation for all issues
  useEffect(() => {
    const performAggregation = async () => {
      if (!results?.issues || results.issues.length === 0) {
        setAggregatedIssues([]);
        return;
      }

      setIsAggregating(true);
      setAggregationError(null);

      try {
        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
        const model = 'gpt-4o-mini'; // Fast and cost-effective for aggregation

        if (!apiKey) {
          console.warn('[LLM Aggregation] No API key found, using fallback aggregation');
          // Fallback: group by exact type
          const grouped = new Map<string, DetectedIssue[]>();
          results.issues.forEach(issue => {
            const key = issue.type;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(issue);
          });

          const fallbackAgg: AggregatedIssue[] = Array.from(grouped.entries()).map(([type, issues], idx) => {
            const affectedCallIds = Array.from(new Set(issues.map(i => i.callId)));
            return {
              id: `fallback-${idx}`,
              type: type as IssueType,
              pattern: `${affectedCallIds.length} occurrence${affectedCallIds.length !== 1 ? 's' : ''}`,
              severity: issues.reduce((max, i) => i.severity > max ? i.severity : max, 'low' as Severity),
              avgConfidence: Math.round(issues.reduce((sum, i) => sum + i.confidence, 0) / issues.length),
              occurrences: affectedCallIds.length,
              affectedCallIds,
              instances: issues,
              evidenceSnippets: Array.from(new Set(issues.map(i => i.evidenceSnippet))).slice(0, 3)
            };
          });

          setAggregatedIssues(fallbackAgg);
          setIsAggregating(false);
          return;
        }

        console.log(`[LLM Aggregation] Starting aggregation for ${results.issues.length} issues`);
        const aggregated = await aggregateIssuesWithLLM(apiKey, model, results.issues);
        console.log(`[LLM Aggregation] Completed - ${aggregated.length} categories created`);
        setAggregatedIssues(aggregated);
      } catch (error) {
        console.error('[LLM Aggregation] Error:', error);
        setAggregationError(error instanceof Error ? error.message : 'Aggregation failed');
        // Fallback on error
        setAggregatedIssues([]);
      } finally {
        setIsAggregating(false);
      }
    };

    performAggregation();
  }, [results?.issues]);

  // LLM-based scenario aggregation for open-ended flow
  useEffect(() => {
    const performScenarioAggregation = async () => {
      if (!scenarioResults?.scenarios || scenarioResults.scenarios.length === 0) {
        setAggregatedScenarios([]);
        setIsAggregatingScenarios(false);
        lastProcessedScenariosRef.current = 0;
        return;
      }

      // Prevent duplicate aggregations for the same scenarios
      if (lastProcessedScenariosRef.current === scenarioResults.scenarios.length && aggregatedScenarios.length > 0) {
        console.log('[LLM Scenario Aggregation] Skipping - already processed these scenarios');
        return;
      }

      lastProcessedScenariosRef.current = scenarioResults.scenarios.length;
      setIsAggregatingScenarios(true);

      // Add timeout to prevent indefinite loading
      const timeoutId = setTimeout(() => {
        console.warn('[LLM Scenario Aggregation] Timeout reached, using fallback');
        const fallbackAgg = aggregateScenarios(scenarioResults.scenarios);
        setAggregatedScenarios(fallbackAgg);
        setIsAggregatingScenarios(false);
      }, 30000); // 30 second timeout

      try {
        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
        const model = 'gpt-4o-mini';

        if (!apiKey) {
          console.warn('[LLM Scenario Aggregation] No API key found, using fallback aggregation');
          clearTimeout(timeoutId);
          // Fallback: use original aggregateScenarios function
          const fallbackAgg = aggregateScenarios(scenarioResults.scenarios);
          setAggregatedScenarios(fallbackAgg);
          setIsAggregatingScenarios(false);
          return;
        }

        console.log(`[LLM Scenario Aggregation] Starting aggregation for ${scenarioResults.scenarios.length} scenarios`);
        const aggregated = await aggregateScenariosWithLLM(scenarioResults.scenarios, apiKey, model);
        console.log(`[LLM Scenario Aggregation] Completed - ${aggregated.length} categories created`);
        clearTimeout(timeoutId);
        setAggregatedScenarios(aggregated);
      } catch (error) {
        console.error('[LLM Scenario Aggregation] Error:', error);
        clearTimeout(timeoutId);
        // Fallback on error: use original aggregateScenarios function
        const fallbackAgg = aggregateScenarios(scenarioResults.scenarios);
        setAggregatedScenarios(fallbackAgg);
      } finally {
        setIsAggregatingScenarios(false);
      }
    };

    performScenarioAggregation();
  }, [scenarioResults?.scenarios]);

  // Aggregate scenarios for open-ended flow
  const scenarioAggregation = useMemo(() => {
    if (!scenarioResults?.scenarios) return null;

    const scenarios = scenarioResults.scenarios;
    console.log('[AggregateResults] Total scenarios:', scenarios.length);
    console.log('[AggregateResults] First scenario:', scenarios[0]);

    console.log('[AggregateResults] Using LLM-aggregated scenarios:', aggregatedScenarios.length);
    console.log('[AggregateResults] First aggregated:', aggregatedScenarios[0]);

    // Group by dimension
    const byDimension: Record<string, number> = {};
    const byDimensionCalls: Record<string, Set<string>> = {}; // Track unique calls per dimension
    const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byRootCause: Record<string, number> = {};
    const byRootCauseCalls: Record<string, Set<string>> = {}; // Track unique calls per RCA category
    const byCall: Record<string, number> = {};
    let totalConfidence = 0;

    scenarios.forEach(scenario => {
      // Dimension - normalize by removing (A), (B), etc. suffix to match dimensionLabels
      const rawDimension = scenario.dimension || 'Uncategorized';
      const dimension = rawDimension.replace(/\s*\([A-G]\)\s*$/, '').trim();
      byDimension[dimension] = (byDimension[dimension] || 0) + 1;

      // Track unique calls per dimension
      if (!byDimensionCalls[dimension]) {
        byDimensionCalls[dimension] = new Set();
      }
      byDimensionCalls[dimension].add(scenario.callId);

      // Severity
      bySeverity[scenario.severity]++;

      // Root Cause - only count valid root cause types (strictly enforce to prevent N/A values)
      const validRootCauseTypes = ['knowledge', 'instruction', 'execution', 'conversation', 'model'];
      const normalizedRootCause = scenario.rootCauseType?.toLowerCase();
      if (normalizedRootCause && validRootCauseTypes.includes(normalizedRootCause)) {
        byRootCause[normalizedRootCause] = (byRootCause[normalizedRootCause] || 0) + 1;

        // Track unique calls per RCA category
        if (!byRootCauseCalls[normalizedRootCause]) {
          byRootCauseCalls[normalizedRootCause] = new Set();
        }
        byRootCauseCalls[normalizedRootCause].add(scenario.callId);
      }

      // Call
      byCall[scenario.callId] = (byCall[scenario.callId] || 0) + 1;

      // Confidence
      totalConfidence += scenario.confidence;
    });

    const avgConfidence = scenarios.length > 0 ? Math.round(totalConfidence / scenarios.length) : 0;

    // Prepare chart data - include ALL dimensions, even those with 0 scenarios
    const allDimensionNames = Object.keys(dimensionLabels);
    console.log('[AggregateResults] byDimension:', byDimension);
    console.log('[AggregateResults] allDimensionNames:', allDimensionNames);

    const dimensionChartData = allDimensionNames
      .map(fullName => {
        const value = byDimension[fullName] || 0;
        return {
          name: fullName,
          fullName,
          shortName: dimensionLabels[fullName]?.short || fullName,
          icon: dimensionLabels[fullName]?.icon || '📊',
          value,
          uniqueCalls: byDimensionCalls[fullName]?.size || 0,
          percentage: scenarios.length > 0 ? Math.round((value / scenarios.length) * 100) : 0,
          hasIssues: value > 0
        };
      })
      .sort((a, b) => {
        // Sort: dimensions with issues first (by count desc), then dimensions without issues
        if (a.hasIssues && !b.hasIssues) return -1;
        if (!a.hasIssues && b.hasIssues) return 1;
        return b.value - a.value;
      });

    console.log('[AggregateResults] dimensionChartData:', dimensionChartData);

    // Prepare RCA category chart data - include ALL RCA categories, even those with 0 scenarios
    const allRCACategories = Object.keys(rcaCategoryLabels);
    const rcaCategoryChartData = allRCACategories
      .map(category => {
        const value = byRootCause[category] || 0;
        return {
          name: category,
          fullName: rcaCategoryLabels[category].full,
          shortName: rcaCategoryLabels[category].short,
          icon: rcaCategoryLabels[category].icon,
          color: rcaCategoryLabels[category].color,
          value,
          uniqueCalls: byRootCauseCalls[category]?.size || 0,
          percentage: scenarios.length > 0 ? Math.round((value / scenarios.length) * 100) : 0,
          hasIssues: value > 0
        };
      })
      .sort((a, b) => {
        // Sort: categories with issues first (by count desc), then categories without issues
        if (a.hasIssues && !b.hasIssues) return -1;
        if (!a.hasIssues && b.hasIssues) return 1;
        return b.value - a.value;
      });

    console.log('[AggregateResults] rcaCategoryChartData:', rcaCategoryChartData);

    const severityChartData = Object.entries(bySeverity)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        percentage: Math.round((value / scenarios.length) * 100)
      }));

    const callDistributionData = Object.entries(byCall)
      .map(([callId, count]) => ({ callId, scenarios: count }))
      .sort((a, b) => b.scenarios - a.scenarios)
      .slice(0, 10); // Top 10 calls

    const rootCauseChartData = Object.entries(byRootCause)
      .map(([name, value]) => {
        // Map internal keys to user-friendly display names
        const displayNameMap: Record<string, string> = {
          'knowledge': 'Knowledge Gap',
          'instruction': 'Instruction Gap',
          'execution': 'Execution Failure',
          'conversation': 'Conversation Design',
          'model': 'Model Limitation'
        };
        const displayName = displayNameMap[name] || name.charAt(0).toUpperCase() + name.slice(1);
        return {
          name: displayName,
          value,
          percentage: Math.round((value / scenarios.length) * 100)
        };
      })
      .sort((a, b) => b.value - a.value);

    return {
      totalScenarios: scenarios.length,
      uniqueDimensions: Object.keys(byDimension).length,
      affectedCalls: Object.keys(byCall).length,
      avgConfidence,
      criticalCount: bySeverity.critical,
      highCount: bySeverity.high,
      dimensionChartData,
      rcaCategoryChartData,
      severityChartData,
      rootCauseChartData,
      callDistributionData,
      bySeverity,
      aggregatedScenarios
    };
  }, [scenarioResults, aggregatedScenarios]);

  // Calculate Impact Zone - unified view of top priority issues across all types
  const burningIssues = useMemo(() => {
    if (flowType !== 'open-ended' || !scenarioAggregation) return [];

    interface BurningIssue {
      id: string;
      title: string;
      type: 'scenario' | 'standard' | 'custom';
      severity: Severity;
      occurrences: number;
      affectedCalls: number;
      priority: number;
      dimension?: string;
      rootCause?: string;
      callIds: string[];
    }

    const issues: BurningIssue[] = [];

    // Add aggregated scenarios
    scenarioAggregation.aggregatedScenarios.forEach(scenario => {
      const severityWeight = {
        critical: 1000,
        high: 100,
        medium: 10,
        low: 1
      }[scenario.severity];

      const priority = severityWeight + (scenario.occurrences * 10) + (scenario.uniqueCalls * 5);

      issues.push({
        id: scenario.id,
        title: scenario.title,
        type: 'scenario',
        severity: scenario.severity,
        occurrences: scenario.occurrences,
        affectedCalls: scenario.uniqueCalls,
        priority,
        dimension: scenario.dimension,
        rootCause: scenario.rootCauseType,
        callIds: scenario.affectedCallIds
      });
    });

    // Sort by priority and take top 10
    return issues.sort((a, b) => b.priority - a.priority).slice(0, 10);
  }, [flowType, scenarioAggregation]);

  // Early return if no data
  if (!results && !scenarioResults) return null;

  // If open-ended flow, show scenario aggregation
  if (flowType === 'open-ended' && scenarioAggregation) {
    return (
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            className="glass-card p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{scenarioAggregation.totalScenarios}</p>
                <p className="text-xs text-[var(--color-slate-400)]">Total Scenarios</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="glass-card p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{scenarioAggregation.uniqueDimensions}</p>
                <p className="text-xs text-[var(--color-slate-400)]">Audit Dimensions</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="glass-card p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {scenarioAggregation.criticalCount + scenarioAggregation.highCount}
                </p>
                <p className="text-xs text-[var(--color-slate-400)]">High Priority</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="glass-card p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{scenarioAggregation.avgConfidence}%</p>
                <p className="text-xs text-[var(--color-slate-400)]">Avg Confidence</p>
              </div>
            </div>
          </motion.div>
        </div>


        {/* Root Cause Distribution Chart */}
        {scenarioAggregation.rootCauseChartData && scenarioAggregation.rootCauseChartData.length > 0 && (
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">Root Cause Analysis</h3>
            </div>
            <p className="text-sm text-[var(--color-slate-400)] mb-4">
              Understanding <span className="font-semibold text-white">WHY</span> issues happen enables targeted solutions
            </p>

            {/* Category Explanations Panel */}
            <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                What each category means:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="flex gap-2">
                  <span className="text-yellow-400 flex-shrink-0">📚 Knowledge Gap:</span>
                  <span className="text-slate-300"><strong>Information doesn't exist</strong> anywhere - bot didn't have the information</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-cyan-400 flex-shrink-0">📋 Instruction Gap:</span>
                  <span className="text-slate-300">Info exists but bot <strong>not told how/when to use it</strong> - needs clearer instructions</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-orange-400 flex-shrink-0">⚠️ Execution Failure:</span>
                  <span className="text-slate-300">Instructions exist but bot <strong>didn't follow them</strong> - needs reinforcement</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-purple-400 flex-shrink-0">💬 Conversation Design:</span>
                  <span className="text-slate-300">Technically correct but <strong>experience was poor</strong> - awkward or confusing</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-green-400 flex-shrink-0">🤖 Model Limitation:</span>
                  <span className="text-slate-300">Task <strong>exceeds model capability</strong> despite perfect setup (rare, {'<'}5%)</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-400">
                <strong className="text-cyan-300">Classification priority:</strong> Knowledge → Instruction → Execution → Conversation → Model. <strong>Always choose the earliest root cause.</strong>
              </div>
            </div>

            {/* Key Insight Box */}
            <div className="bg-gradient-to-r from-purple-500/10 to-transparent border-l-4 border-purple-500 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">💡</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-purple-300 mb-1">Actionable Insight:</p>
                  <p className="text-sm text-[var(--color-slate-300)]">
                    <span className="font-bold text-white">
                      {scenarioAggregation.rootCauseChartData[0]?.value || 0} scenarios
                    </span>
                    {' '}are <span className="font-semibold text-cyan-400">{
                      scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase()
                    }</span> issues
                    {scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'knowledge gap'
                      ? ' - Add missing information to knowledge base or reference materials'
                      : scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'instruction gap'
                      ? ' - Update system prompts with clearer instructions on how/when to use existing information'
                      : scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'execution failure'
                      ? ' - Reinforce prompts with constraints, examples, and guardrails. Check the Fixes tab for solutions!'
                      : scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'conversation design'
                      ? ' - Improve conversation design, tone rules, and phrasing guidance for better user experience'
                      : ' - AI model lacks fundamental capability; consider upgrading to a more capable model'
                    }
                  </p>
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <RechartsBarChart data={scenarioAggregation.rootCauseChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const rootCauseKey = data.name.toLowerCase();
                      return (
                        <div style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '8px',
                          padding: '12px',
                          color: '#fff',
                          maxWidth: '250px'
                        }}>
                          <p style={{ marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>{data.name} Issues</p>
                          <p style={{ color: '#60a5fa', marginBottom: '8px' }}>{data.value} scenarios ({data.percentage}%)</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
                            {rootCauseKey === 'knowledge gap' && '📚 Fix: Add missing information to knowledge base/documentation'}
                            {rootCauseKey === 'instruction gap' && '📋 Fix: Update system prompts with clearer how/when instructions'}
                            {rootCauseKey === 'execution failure' && '⚠️ Fix: Reinforce prompts with constraints, examples, and guardrails'}
                            {rootCauseKey === 'conversation design' && '💬 Fix: Improve conversation design, tone rules, and phrasing'}
                            {rootCauseKey === 'model limitation' && '🤖 Fix: Upgrade to more capable AI model (exceeds current model)'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" fill="#8884d8" radius={[8, 8, 0, 0]}>
                  {scenarioAggregation.rootCauseChartData.map((entry, index) => {
                    const displayKey = entry.name.toLowerCase();
                    // Map display names back to internal keys for color lookup
                    const colorKeyMap: Record<string, string> = {
                      'knowledge gap': 'knowledge',
                      'instruction gap': 'instruction',
                      'execution failure': 'execution',
                      'conversation design': 'conversation',
                      'model limitation': 'model'
                    };
                    const colorKey = colorKeyMap[displayKey] || displayKey;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={ROOT_CAUSE_COLORS[colorKey] || '#8884d8'}
                      />
                    );
                  })}
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>

            {/* Root Cause Legend with Icons */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
              {scenarioAggregation.rootCauseChartData.map((item, index) => {
                const rootCauseKey = item.name.toLowerCase();
                // Map display names back to internal keys for color lookup
                const colorKeyMap: Record<string, string> = {
                  'knowledge gap': 'knowledge',
                  'instruction gap': 'instruction',
                  'execution failure': 'execution',
                  'conversation design': 'conversation',
                  'model limitation': 'model'
                };
                const colorKey = colorKeyMap[rootCauseKey] || rootCauseKey;
                const icons: Record<string, string> = {
                  'knowledge gap': '📚',
                  'instruction gap': '📋',
                  'execution failure': '⚠️',
                  'conversation design': '💬',
                  'model limitation': '🤖'
                };
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-2 text-sm"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ROOT_CAUSE_COLORS[colorKey] || '#8884d8' }}
                    />
                    <span className="text-[var(--color-slate-300)]">
                      {icons[rootCauseKey]} {item.name}: {item.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Impact Zone - Top Priority Issues */}
        <motion.div
          className="relative glass-card p-6 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.02) 100%)',
            borderLeft: '3px solid rgba(239, 68, 68, 0.5)'
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/30">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">🎯 Impact Zone</h3>
              <p className="text-sm text-[var(--color-slate-400)]">Top 10 priorities • Click to investigate</p>
            </div>
            <div className="ml-auto px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-2xl font-bold text-red-400">{isAggregatingScenarios ? '...' : burningIssues.length}</p>
              <p className="text-xs text-[var(--color-slate-400)]">Issues</p>
            </div>
          </div>
          <div className="space-y-3">
            {isAggregatingScenarios ? (
              <div className="text-center py-12 text-[var(--color-slate-400)]">
                <div className="w-16 h-16 mx-auto mb-3 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                <p className="text-lg font-medium">Analyzing scenarios...</p>
                <p className="text-sm">Identifying high-impact issues</p>
              </div>
            ) : burningIssues.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-slate-400)]">
                <CheckCircle className="w-16 h-16 mx-auto mb-3 text-green-400" />
                <p className="text-lg font-medium">No high-impact issues found</p>
                <p className="text-sm">Your analysis is looking great!</p>
              </div>
            ) : (
              burningIssues.map((issue, index) => {
                // Get severity styling
                const severityStyles = {
                  critical: {
                    gradient: 'from-red-600 to-red-700',
                    glow: 'shadow-red-500/50',
                    border: 'border-red-500/30',
                    bg: 'bg-red-500/10',
                    icon: '🔴'
                  },
                  high: {
                    gradient: 'from-orange-500 to-orange-600',
                    glow: 'shadow-orange-500/40',
                    border: 'border-orange-500/30',
                    bg: 'bg-orange-500/10',
                    icon: '🟠'
                  },
                  medium: {
                    gradient: 'from-yellow-500 to-yellow-600',
                    glow: 'shadow-yellow-500/30',
                    border: 'border-yellow-500/30',
                    bg: 'bg-yellow-500/10',
                    icon: '🟡'
                  },
                  low: {
                    gradient: 'from-green-500 to-green-600',
                    glow: 'shadow-green-500/20',
                    border: 'border-green-500/30',
                    bg: 'bg-green-500/10',
                    icon: '🟢'
                  }
                };
                const style = severityStyles[issue.severity];

                // Calculate priority level based on multi-factor score
                const getPriorityLevel = (priority: number): 'High' | 'Medium' | 'Low' => {
                  if (priority >= 1000) return 'High';
                  if (priority >= 100) return 'Medium';
                  return 'Low';
                };
                const priorityLevel = getPriorityLevel(issue.priority);

                // Priority badge styling
                const priorityStyles = {
                  High: {
                    bg: 'bg-red-600',
                    text: 'text-white',
                    border: 'border-red-400',
                    icon: '🔴'
                  },
                  Medium: {
                    bg: 'bg-yellow-600',
                    text: 'text-white',
                    border: 'border-yellow-400',
                    icon: '🟡'
                  },
                  Low: {
                    bg: 'bg-blue-600',
                    text: 'text-white',
                    border: 'border-blue-400',
                    icon: '🔵'
                  }
                };
                const priorityStyle = priorityStyles[priorityLevel];

                return (
                  <motion.div
                    key={issue.id}
                    className={`relative group cursor-pointer rounded-xl border ${style.border} ${style.bg} backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-xl ${style.glow} hover:scale-[1.02] hover:border-opacity-60`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index, type: 'spring', stiffness: 100 }}
                    onClick={() => {
                      // Instead of navigating to a single call, expand the aggregated view
                      const aggregatedScenario = scenarioAggregation.aggregatedScenarios.find(
                        s => s.id === issue.id
                      );
                      if (aggregatedScenario) {
                        // Set target for auto-expansion with timestamp to trigger re-render
                        setAutoExpandTarget({ scenarioId: issue.id, timestamp: Date.now() });

                        // Scroll to the RCA breakdown section after a short delay
                        setTimeout(() => {
                          rcaBreakdownRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }, 100);
                      }
                    }}
                  >
                    {/* Rank badge with gradient */}
                    <div className={`absolute top-0 left-0 w-16 h-16 bg-gradient-to-br ${style.gradient} flex items-center justify-center`}>
                      <span className="text-2xl font-black text-white drop-shadow-lg">#{index + 1}</span>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                    </div>

                    <div className="pl-20 pr-6 py-5">
                      {/* Issue Title, Priority, and Severity */}
                      <div className="flex flex-col gap-3 mb-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Priority Badge */}
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${priorityStyle.bg} ${priorityStyle.text} shadow-lg border ${priorityStyle.border}`}>
                            {priorityLevel} Priority
                          </span>
                          {/* Severity Badge */}
                          <span className="text-xl">{style.icon}</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-gradient-to-r ${style.gradient} text-white shadow-lg`}>
                            {issue.severity}
                          </span>
                        </div>
                        <h4 className="text-white font-semibold text-base leading-snug pr-2 group-hover:text-white transition-colors line-clamp-2">
                          {issue.title}
                        </h4>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-white font-semibold">{issue.occurrences}</p>
                            <p className="text-xs text-[var(--color-slate-400)]">Occurrence{issue.occurrences !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                          </div>
                          <div>
                            <p className="text-white font-semibold">
                              {issue.affectedCalls}
                              <span className="text-xs text-purple-400 ml-1">
                                ({Math.round((issue.affectedCalls / scenarioAggregation.affectedCalls) * 100)}%)
                              </span>
                            </p>
                            <p className="text-xs text-[var(--color-slate-400)]">Call{issue.affectedCalls !== 1 ? 's' : ''} Affected</p>
                          </div>
                        </div>
                      </div>

                      {/* Tags and Navigation */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {issue.dimension && (
                            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-[var(--color-slate-300)] border border-white/10 flex items-center gap-1.5 whitespace-nowrap">
                              <span>{dimensionLabels[issue.dimension]?.icon || '📊'}</span>
                              <span>{dimensionLabels[issue.dimension]?.short || issue.dimension}</span>
                            </span>
                          )}
                          {issue.rootCause && (
                            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-[var(--color-slate-300)] border border-white/10 flex items-center gap-1.5 whitespace-nowrap">
                              <span>{rcaCategoryLabels[issue.rootCause]?.icon || '🔍'}</span>
                              <span>{rcaCategoryLabels[issue.rootCause]?.short || issue.rootCause}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[var(--color-slate-500)] group-hover:text-white transition-colors flex-shrink-0">
                          <ArrowRight className="w-5 h-5" />
                        </span>
                      </div>
                    </div>

                    {/* Hover gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* RCA Category Breakdown with Nested Aggregated Scenarios */}
        <div ref={rcaBreakdownRef}>
          <DimensionBreakdownWithAggregation
            dimensionChartData={scenarioAggregation.rcaCategoryChartData}
            aggregatedScenarios={scenarioAggregation.aggregatedScenarios}
            issues={results?.issues || []}
            autoExpandTarget={autoExpandTarget}
          />
        </div>
      </div>
    );
  }

  // Original objective flow content
  if (!results) return null;

  // Calculate overall statistics
  const totalIssues = results.issues.length;
  const criticalIssues = results.issues.filter(i => i.severity === 'critical').length;
  const highIssues = results.issues.filter(i => i.severity === 'high').length;
  const affectedCalls = new Set(results.issues.map(i => i.callId)).size;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          className="glass-card p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalIssues}</p>
              <p className="text-xs text-[var(--color-slate-400)]">Total Issues</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="glass-card p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{criticalIssues}</p>
              <p className="text-xs text-[var(--color-slate-400)]">Critical</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="glass-card p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{highIssues}</p>
              <p className="text-xs text-[var(--color-slate-400)]">High Priority</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="glass-card p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{affectedCalls}</p>
              <p className="text-xs text-[var(--color-slate-400)]">Calls Affected</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Loading state for LLM aggregation */}
      {isAggregating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[var(--color-navy-800)] p-6 rounded-lg border border-[var(--color-navy-700)]"
        >
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            <p className="text-sm text-[var(--color-slate-300)]">Intelligently categorizing issues with AI...</p>
          </div>
        </motion.div>
      )}

      {/* Error state */}
      {aggregationError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-900/20 p-4 rounded-lg border border-red-500/30"
        >
          <p className="text-sm text-red-400">Aggregation error: {aggregationError}</p>
        </motion.div>
      )}

      {/* Checks Overview by Pillar - Always show to display all enabled checks */}
      {!isAggregating && (
        <CheckPillarOverview
          aggregatedIssues={aggregatedIssues}
          checks={checks}
        />
      )}

      {/* LLM-Aggregated Issues - Unified View */}
      {!isAggregating && aggregatedIssues.length > 0 && (
        <ObjectiveIssuesBreakdown
          aggregatedIssues={aggregatedIssues}
          getIssueTypeLabel={getIssueTypeLabel}
          title="AI-Categorized Issues"
          subtitle={`${aggregatedIssues.length} intelligent categories identified from ${results?.issues.length || 0} detected issues`}
        />
      )}
    </div>
  );
}

// Component to display check pillar overview
function CheckPillarOverview({
  aggregatedIssues,
  checks
}: {
  aggregatedIssues: AggregatedIssue[];
  checks: CheckConfig[];
}) {
  // Early return if checks is not an array
  if (!Array.isArray(checks)) {
    console.error('CheckPillarOverview: checks is not an array', checks);
    return null;
  }

  const allIssues = aggregatedIssues;

  // Define all possible check categories (standard checks)
  const allCheckCategories: Record<string, { name: string; icon: string; color: string }> = {
    flow_compliance: { name: 'Flow Compliance', icon: '🔄', color: 'blue' },
    flow_deviation: { name: 'Flow Compliance', icon: '🔄', color: 'blue' },
    repetition: { name: 'Repetition Detection', icon: '🔁', color: 'orange' },
    repetition_loop: { name: 'Repetition Detection', icon: '🔁', color: 'orange' },
    language_alignment: { name: 'Language Alignment', icon: '🌐', color: 'green' },
    language_mismatch: { name: 'Language Alignment', icon: '🌐', color: 'green' },
    restart_reset: { name: 'Restart/Reset Detection', icon: '↻', color: 'purple' },
    mid_call_restart: { name: 'Restart/Reset Detection', icon: '↻', color: 'purple' },
    general_quality: { name: 'General Quality', icon: '✨', color: 'pink' },
    quality_issue: { name: 'General Quality', icon: '✨', color: 'pink' },
  };

  // Initialize pillar groups with ALL enabled checks (start with 0)
  const pillarGroups: Record<string, {
    name: string;
    icon: string;
    issues: AggregatedIssue[];
    totalCalls: number;
    totalOccurrences: number;
    color: string;
    hasIssues: boolean;
  }> = {};

  // Initialize all enabled checks in pillarGroups
  checks.forEach(check => {
    if (check.enabled) {
      const category = allCheckCategories[check.id] || {
        name: check.name,
        icon: '📊',
        color: 'cyan'
      };

      const key = category.name;
      if (!pillarGroups[key]) {
        pillarGroups[key] = {
          name: category.name,
          icon: category.icon,
          issues: [],
          totalCalls: 0,
          totalOccurrences: 0,
          color: category.color,
          hasIssues: false
        };
      }
    }
  });

  // Now populate with actual issues
  allIssues.forEach(issue => {
    const category = allCheckCategories[issue.type] || {
      name: issue.type.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      icon: '📊',
      color: 'cyan'
    };

    const key = category.name;
    if (!pillarGroups[key]) {
      pillarGroups[key] = {
        name: category.name,
        icon: category.icon,
        issues: [],
        totalCalls: 0,
        totalOccurrences: 0,
        color: category.color,
        hasIssues: false
      };
    }

    pillarGroups[key].issues.push(issue);
    pillarGroups[key].totalCalls += issue.affectedCallIds.length;
    pillarGroups[key].totalOccurrences += issue.occurrences;
    pillarGroups[key].hasIssues = true;
  });

  // Sort: pillars with issues first (by occurrences), then clean pillars
  const sortedPillars = Object.values(pillarGroups).sort((a, b) => {
    if (a.hasIssues && !b.hasIssues) return -1;
    if (!a.hasIssues && b.hasIssues) return 1;
    return b.totalOccurrences - a.totalOccurrences;
  });

  // Static color mapping for Tailwind CSS (can't use dynamic classes)
  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string }> = {
      blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
      orange: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
      green: { bg: 'bg-green-500/20', text: 'text-green-400' },
      purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
      pink: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
      cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    };
    return colorMap[color] || { bg: 'bg-cyan-500/20', text: 'text-cyan-400' };
  };

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="p-4 border-b border-[var(--color-navy-700)]">
        <h3 className="text-lg font-semibold text-white">Check Pillars Overview</h3>
        <p className="text-sm text-[var(--color-slate-400)] mt-1">
          Issues grouped by check category • {sortedPillars.length} active pillar{sortedPillars.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {sortedPillars.map((pillar, index) => {
          const colorClasses = getColorClasses(pillar.color);
          return (
            <motion.div
              key={pillar.name}
              className={`p-4 rounded-lg bg-gradient-to-br transition-colors ${
                pillar.hasIssues
                  ? 'from-[var(--color-navy-800)] to-[var(--color-navy-900)] border border-[var(--color-navy-700)] hover:border-[var(--color-navy-600)]'
                  : 'from-green-500/5 to-[var(--color-navy-900)] border border-green-500/20 opacity-60'
              }`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: pillar.hasIssues ? 1 : 0.6, scale: 1 }}
              transition={{ delay: 0.5 + index * 0.05 }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  pillar.hasIssues ? colorClasses.bg : 'bg-green-500/20'
                }`}>
                  {pillar.hasIssues ? (
                    <span className="text-xl">{pillar.icon}</span>
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-white">{pillar.name}</h4>
                    {!pillar.hasIssues && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                        No issues
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-slate-400)]">
                    {pillar.hasIssues ? (
                      `${pillar.issues.length} issue type${pillar.issues.length !== 1 ? 's' : ''}`
                    ) : (
                      '✓ Clean'
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 rounded bg-[var(--color-navy-950)]">
                  <p className={`text-2xl font-bold ${
                    pillar.hasIssues ? colorClasses.text : 'text-green-500'
                  }`}>{pillar.totalOccurrences}</p>
                  <p className="text-xs text-[var(--color-slate-400)]">Occurrences</p>
                </div>
                <div className="p-2 rounded bg-[var(--color-navy-950)]">
                  <p className={`text-2xl font-bold ${
                    pillar.hasIssues ? colorClasses.text : 'text-green-500'
                  }`}>{pillar.totalCalls}</p>
                  <p className="text-xs text-[var(--color-slate-400)]">Calls Affected</p>
                </div>
              </div>

              {/* Issue types in this pillar - only show if has issues */}
              {pillar.hasIssues && (
                <div className="mt-3 pt-3 border-t border-[var(--color-navy-700)]">
                  <p className="text-xs text-[var(--color-slate-500)] mb-2">Issues:</p>
                  <div className="flex flex-wrap gap-1">
                    {pillar.issues.map((issue, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 rounded bg-[var(--color-navy-950)] text-[var(--color-slate-300)]"
                      >
                        {issue.occurrences}× {issue.type.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Component to display objective flow issues with expandable details
function ObjectiveIssuesBreakdown({
  aggregatedIssues,
  getIssueTypeLabel,
  title,
  subtitle,
  customStyle = false
}: {
  aggregatedIssues: AggregatedIssue[];
  getIssueTypeLabel: (type: IssueType) => string;
  title: string;
  subtitle: string;
  customStyle?: boolean;
}) {
  const { setSelectedCallId, setSelectedIssueId, setResultsViewMode } = useAppStore();
  const [expandedIssues, setExpandedIssues] = React.useState<Set<string>>(new Set());

  const toggleIssue = (issueId: string) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId);
    } else {
      newExpanded.add(issueId);
    }
    setExpandedIssues(newExpanded);
  };

  const severityClasses: Record<Severity, string> = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
  };

  const checkIcons: Record<string, string> = {
    flow_compliance: '🔄',
    flow_deviation: '🔄',
    repetition: '🔁',
    repetition_loop: '🔁',
    language_alignment: '🌐',
    language_mismatch: '🌐',
    restart_reset: '↻',
    mid_call_restart: '↻',
    general_quality: '✨',
    quality_issue: '✨',
  };

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <div className={`p-4 border-b ${customStyle ? 'border-purple-500/30 bg-purple-500/5' : 'border-[var(--color-navy-700)]'}`}>
        <h3 className={`text-lg font-semibold ${customStyle ? 'text-purple-300' : 'text-white'}`}>{title}</h3>
        <p className="text-sm text-[var(--color-slate-400)] mt-1">
          {subtitle} • {aggregatedIssues.length} unique pattern{aggregatedIssues.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="divide-y divide-[var(--color-navy-700)]">
        {aggregatedIssues.map((issue, index) => {
          const isExpanded = expandedIssues.has(issue.id);
          const icon = checkIcons[issue.type] || '📊';

          return (
            <div key={issue.id}>
              {/* Issue Header */}
              <motion.div
                className="p-4 hover:bg-[var(--color-navy-800)] transition-colors cursor-pointer group"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.05 }}
                onClick={() => toggleIssue(issue.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ArrowRight className="w-4 h-4 text-[var(--color-slate-400)] flex-shrink-0" />
                    </motion.div>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-lg">{icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`badge ${severityClasses[issue.severity]}`}>
                            {issue.severity}
                          </span>
                          <h4 className={`text-base font-semibold group-hover:text-purple-300 transition-colors ${customStyle ? 'text-purple-300' : 'text-white'}`}>
                            {getIssueTypeLabel(issue.type)}
                          </h4>
                        </div>
                        <p className="text-sm text-[var(--color-slate-300)]">
                          {issue.pattern}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <p className={`text-2xl font-bold group-hover:text-purple-300 transition-colors ${customStyle ? 'text-purple-400' : 'text-white'}`}>
                        {issue.occurrences}
                      </p>
                      <p className="text-xs text-[var(--color-slate-400)]">occurrences</p>
                    </div>
                    <div className="text-right min-w-[60px]">
                      <p className={`text-lg font-semibold ${customStyle ? 'text-purple-400' : 'text-blue-400'}`}>
                        {issue.affectedCallIds.length}
                      </p>
                      <p className="text-xs text-[var(--color-slate-400)]">calls</p>
                    </div>
                    <div className="text-right min-w-[60px]">
                      <p className={`text-lg font-semibold ${customStyle ? 'text-purple-400' : 'text-green-400'}`}>
                        {issue.avgConfidence}%
                      </p>
                      <p className="text-xs text-[var(--color-slate-400)]">confidence</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Expanded Individual Issue Instances */}
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-[var(--color-navy-900)] border-t border-[var(--color-navy-700)]"
                >
                  <div className="px-4 py-3">
                    <p className="text-xs text-[var(--color-slate-400)] mb-3 font-semibold uppercase tracking-wide">
                      Individual Instances ({issue.instances.length}) • Click to view call details
                    </p>

                    <div className="space-y-2">
                      {issue.instances.map((instance: DetectedIssue) => (
                        <div
                          key={instance.id}
                          className="p-3 rounded-lg bg-[var(--color-navy-800)] hover:bg-[var(--color-navy-750)] transition-colors cursor-pointer border border-[var(--color-navy-700)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCallId(instance.callId);
                            setSelectedIssueId(instance.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline cursor-pointer">{instance.callId}</span>
                                <span className="text-xs text-[var(--color-slate-500)]">•</span>
                                <span className="text-xs text-[var(--color-slate-400)]">
                                  Lines {instance.lineNumbers[0]}-{instance.lineNumbers[instance.lineNumbers.length - 1]}
                                </span>
                                <span className="text-xs text-[var(--color-slate-500)]">•</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${severityClasses[instance.severity]}`}>
                                  {instance.severity}
                                </span>
                                <span className="text-xs text-[var(--color-slate-500)]">•</span>
                                <span className="text-xs text-green-400">{instance.confidence}% confidence</span>
                              </div>
                              <p className="text-sm text-[var(--color-slate-300)] mb-1">
                                {instance.explanation}
                              </p>
                              {instance.evidenceSnippet && (
                                <p className="text-xs text-[var(--color-slate-400)] italic line-clamp-2">
                                  "{instance.evidenceSnippet}"
                                </p>
                              )}
                            </div>
                            <ArrowRight className="w-4 h-4 text-[var(--color-slate-500)] flex-shrink-0 mt-1" />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Evidence Snippets Preview */}
                    {issue.evidenceSnippets && issue.evidenceSnippets.length > 0 && (
                      <div className="mt-4 p-3 rounded-lg bg-[var(--color-navy-950)] border border-[var(--color-navy-700)]">
                        <p className="text-xs text-[var(--color-slate-400)] mb-2 font-semibold">
                          Sample Evidence Snippets:
                        </p>
                        <div className="space-y-2">
                          {issue.evidenceSnippets.slice(0, 3).map((snippet: string, idx: number) => (
                            <p key={idx} className="text-xs text-[var(--color-slate-300)] italic">
                              "{snippet}"
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Component to display dimensions with nested aggregated scenarios
function DimensionBreakdownWithAggregation({
  dimensionChartData,
  aggregatedScenarios,
  issues,
  autoExpandTarget
}: {
  dimensionChartData: any[];
  aggregatedScenarios: AggregatedScenario[];
  issues: DetectedIssue[];
  autoExpandTarget?: { scenarioId: string; timestamp: number } | null;
}) {
  const { setSelectedCallId, setSelectedIssueId, setResultsViewMode, setSelectedDimension } = useAppStore();
  const [expandedDimensions, setExpandedDimensions] = React.useState<Set<string>>(new Set());
  const [expandedScenarios, setExpandedScenarios] = React.useState<Set<string>>(new Set());

  // Auto-expand when clicking from Impact Zone
  React.useEffect(() => {
    if (autoExpandTarget) {
      const targetScenario = aggregatedScenarios.find(s => s.id === autoExpandTarget.scenarioId);
      if (targetScenario) {
        // Find the dimension (RCA category) for this scenario
        const dimensionData = dimensionChartData.find(d => d.name === targetScenario.rootCauseType);
        if (dimensionData) {
          // Expand both dimension and scenario
          setExpandedDimensions(prev => new Set(prev).add(dimensionData.fullName));
          setExpandedScenarios(prev => new Set(prev).add(targetScenario.groupKey));
        }
      }
    }
  }, [autoExpandTarget, aggregatedScenarios, dimensionChartData]);

  const toggleDimension = (dimensionName: string) => {
    console.log('[DimensionBreakdown] toggleDimension called for:', dimensionName);
    console.log('[DimensionBreakdown] Current expandedDimensions:', Array.from(expandedDimensions));
    const newExpanded = new Set(expandedDimensions);
    if (newExpanded.has(dimensionName)) {
      newExpanded.delete(dimensionName);
      console.log('[DimensionBreakdown] Collapsing dimension:', dimensionName);
    } else {
      newExpanded.add(dimensionName);
      console.log('[DimensionBreakdown] Expanding dimension:', dimensionName);
    }
    setExpandedDimensions(newExpanded);
    console.log('[DimensionBreakdown] New expandedDimensions:', Array.from(newExpanded));
  };

  const toggleScenario = (scenarioKey: string) => {
    const newExpanded = new Set(expandedScenarios);
    if (newExpanded.has(scenarioKey)) {
      newExpanded.delete(scenarioKey);
    } else {
      newExpanded.add(scenarioKey);
    }
    setExpandedScenarios(newExpanded);
  };

  const severityClasses: Record<Severity, string> = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
  };

  const rootCauseColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    knowledge: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', icon: '📚' },
    instruction: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', icon: '📋' },
    execution: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', icon: '⚠️' },
    conversation: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', icon: '💬' },
    model: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', icon: '🤖' },
  };

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
    >
      <div className="p-4 border-b border-[var(--color-navy-700)]">
        <h3 className="text-lg font-semibold text-white">RCA Category Breakdown</h3>
        <p className="text-sm text-[var(--color-slate-400)] mt-1">
          Click any category to expand and view aggregated scenarios
        </p>
      </div>

      <div className="divide-y divide-[var(--color-navy-700)]">
        {dimensionChartData.map((dimension, dimensionIndex) => {
          const isDimensionExpanded = expandedDimensions.has(dimension.fullName);
          const hasIssues = dimension.value > 0;
          // Filter aggregated scenarios for this RCA category
          const dimensionAggregatedScenarios = aggregatedScenarios.filter(
            agg => agg.rootCauseType === dimension.name
          );

          console.log(`[DimensionBreakdown] Dimension: ${dimension.name} (${dimension.fullName})`);
          console.log(`[DimensionBreakdown] - isDimensionExpanded: ${isDimensionExpanded}`);
          console.log(`[DimensionBreakdown] - hasIssues: ${hasIssues} (value: ${dimension.value})`);
          console.log(`[DimensionBreakdown] - dimensionAggregatedScenarios.length: ${dimensionAggregatedScenarios.length}`);
          console.log(`[DimensionBreakdown] - Total aggregatedScenarios: ${aggregatedScenarios.length}`);
          console.log(`[DimensionBreakdown] - All aggregated rootCauseTypes:`, aggregatedScenarios.map(a => a.rootCauseType));
          if (dimensionAggregatedScenarios.length > 0) {
            console.log(`[DimensionBreakdown] - First scenario:`, dimensionAggregatedScenarios[0]);
          } else if (hasIssues) {
            console.warn(`[DimensionBreakdown] ⚠️ MISMATCH: Dimension shows ${dimension.value} scenarios but no aggregated scenarios match!`);
          }

          return (
            <div key={dimension.name}>
              {/* Dimension Header */}
              <motion.div
                className={`p-4 transition-colors ${hasIssues ? 'hover:bg-[var(--color-navy-800)] cursor-pointer' : 'cursor-default opacity-60'} group`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: hasIssues ? 1 : 0.6, x: 0 }}
                transition={{ delay: 0.9 + dimensionIndex * 0.05 }}
                onClick={() => hasIssues && toggleDimension(dimension.fullName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {hasIssues ? (
                      <motion.div
                        animate={{ rotate: isDimensionExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ArrowRight className="w-4 h-4 text-[var(--color-slate-400)] flex-shrink-0" />
                      </motion.div>
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform"
                      style={{
                        backgroundColor: hasIssues
                          ? dimension.color || DIMENSION_COLORS[dimensionIndex % DIMENSION_COLORS.length]
                          : 'rgba(34, 197, 94, 0.3)' // green with opacity
                      }}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{dimension.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-base font-medium transition-colors ${hasIssues ? 'text-white group-hover:text-purple-300' : 'text-[var(--color-slate-400)]'}`}>
                            {dimension.shortName}
                          </p>
                          {!hasIssues && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                              No issues
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-slate-500)]">{dimension.fullName}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <p className={`text-2xl font-bold transition-colors ${hasIssues ? 'text-white group-hover:text-purple-300' : 'text-green-500'}`}>
                        {hasIssues ? dimension.value : '✓'}
                      </p>
                      <p className="text-xs text-[var(--color-slate-400)]">
                        {hasIssues ? 'scenarios' : 'clean'}
                      </p>
                    </div>
                    {hasIssues && (
                      <>
                        <div className="text-right min-w-[60px]">
                          <p className="text-lg font-semibold text-blue-400">{dimension.uniqueCalls}</p>
                          <p className="text-xs text-[var(--color-slate-400)]">calls</p>
                        </div>
                        <div className="text-right min-w-[60px]">
                          <p className="text-lg font-semibold text-purple-400">{dimension.percentage}%</p>
                          <p className="text-xs text-[var(--color-slate-400)]">of total</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Expanded Aggregated Scenarios for this Dimension */}
              <AnimatePresence>
                {isDimensionExpanded && dimensionAggregatedScenarios.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-[var(--color-navy-900)]"
                  >
                  <div className="px-4 py-2">
                    <p className="text-xs text-[var(--color-slate-400)] mb-3 font-semibold uppercase tracking-wide">
                      {dimensionAggregatedScenarios.length} Aggregated Pattern{dimensionAggregatedScenarios.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {dimensionAggregatedScenarios.map((group, groupIndex) => {
                    const isScenarioExpanded = expandedScenarios.has(group.groupKey);

                    return (
                      <div
                        key={group.id}
                        className="border-t border-[var(--color-navy-700)]"
                      >
                        {/* Aggregated Scenario Header */}
                        <div
                          className="px-4 py-3 hover:bg-[var(--color-navy-800)] cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleScenario(group.groupKey);
                          }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              {/* Badges */}
                              <div className="flex items-center flex-wrap gap-2 mb-2">
                                <span className={`badge ${severityClasses[group.severity]}`}>
                                  {group.severity}
                                </span>
                                {group.rootCauseType && rootCauseColors[group.rootCauseType] && (
                                  <span className={`px-2 py-0.5 text-xs rounded-full ${rootCauseColors[group.rootCauseType].bg} ${rootCauseColors[group.rootCauseType].text} border ${rootCauseColors[group.rootCauseType].border} font-medium`}>
                                    {rootCauseColors[group.rootCauseType].icon} {group.rootCauseType}
                                  </span>
                                )}
                              </div>

                              {/* Title */}
                              <h4 className="text-sm font-semibold text-white mb-2">
                                {group.title}
                              </h4>

                              {/* Pattern */}
                              <p className="text-xs text-[var(--color-slate-300)] mb-2">
                                {group.pattern}
                              </p>

                              {/* Script/KB Reference for Execution Failures */}
                              {group.rootCauseType === 'execution' && group.scenarios.some(s => s.instructionReference) && (
                                <div className="mt-3 mb-2 p-2 rounded bg-orange-500/10 border border-orange-500/20">
                                  <div className="flex items-start gap-2">
                                    <span className="text-orange-400 text-xs mt-0.5">📋</span>
                                    <div className="flex-1">
                                      <p className="text-xs font-semibold text-orange-300 mb-1">Script/KB Reference Not Followed</p>
                                      {group.scenarios.filter(s => s.instructionReference).slice(0, 1).map(scenario => {
                                        const ref = scenario.instructionReference!;
                                        return (
                                          <div key={scenario.id} className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-medium uppercase">
                                                {ref.source}
                                              </span>
                                              {ref.documentName && (
                                                <span className="text-[10px] text-[var(--color-slate-400)]">{ref.documentName}</span>
                                              )}
                                              <span className="text-[10px] text-[var(--color-slate-500)]">•</span>
                                              <span className="text-[10px] text-[var(--color-slate-400)]">{ref.section}</span>
                                            </div>
                                            <p className="text-[11px] text-[var(--color-slate-300)]">
                                              <span className="text-orange-300 font-medium">Expected:</span> {ref.expectedBehavior}
                                            </p>
                                            <p className="text-[11px] text-[var(--color-slate-300)]">
                                              <span className="text-orange-300 font-medium">Actual:</span> {ref.actualBehavior}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Stats */}
                              <div className="flex items-center gap-4 text-xs flex-wrap">
                                <div>
                                  <span className="text-[var(--color-slate-400)]">Occurrences: </span>
                                  <span className="font-semibold text-purple-400">{group.occurrences}</span>
                                </div>
                                <div>
                                  <span className="text-[var(--color-slate-400)]">Calls: </span>
                                  <span className="font-semibold text-blue-400">{group.uniqueCalls}</span>
                                </div>
                                <div>
                                  <span className="text-[var(--color-slate-400)]">Confidence: </span>
                                  <span className="font-semibold text-green-400">{group.avgConfidence}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Expand Icon */}
                            <motion.div
                              animate={{ rotate: isScenarioExpanded ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                              className="flex-shrink-0"
                            >
                              <ArrowRight className="w-4 h-4 text-[var(--color-slate-400)]" />
                            </motion.div>
                          </div>
                        </div>

                        {/* Individual Scenario Instances */}
                        <AnimatePresence>
                          {isScenarioExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="bg-[var(--color-navy-950)] border-t border-[var(--color-navy-700)]"
                            >
                            <div className="px-4 py-3">
                              <p className="text-xs text-[var(--color-slate-500)] mb-2 font-semibold uppercase tracking-wide">
                                Individual Instances ({group.scenarios.length})
                              </p>

                              <div className="space-y-2">
                                {group.scenarios.map((scenario) => (
                                  <div
                                    key={scenario.id}
                                    className="p-2 rounded bg-[var(--color-navy-800)] hover:bg-[var(--color-navy-750)] transition-colors cursor-pointer border border-[var(--color-navy-700)]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCallId(scenario.callId);
                                      setSelectedIssueId(findMatchingIssue(scenario, issues));
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline cursor-pointer">{scenario.callId}</span>
                                          <span className="text-xs text-[var(--color-slate-500)]">•</span>
                                          <span className="text-xs text-[var(--color-slate-400)]">Lines {scenario.lineNumbers[0]}-{scenario.lineNumbers[scenario.lineNumbers.length - 1]}</span>
                                          {scenario.title !== group.title && (
                                            <>
                                              <span className="text-xs text-[var(--color-slate-500)]">•</span>
                                              <span className="text-xs text-[var(--color-slate-400)] italic">{scenario.title}</span>
                                            </>
                                          )}
                                        </div>
                                        <p className="text-xs text-[var(--color-slate-300)] truncate">
                                          {scenario.whatHappened}
                                        </p>
                                        {/* Show instruction reference if available */}
                                        {scenario.instructionReference && (
                                          <div className="mt-1.5 text-[10px] text-orange-300">
                                            <span className="font-medium">{scenario.instructionReference.source.toUpperCase()}:</span> {scenario.instructionReference.section}
                                          </div>
                                        )}
                                      </div>
                                      <ArrowRight className="w-3 h-3 text-[var(--color-slate-500)] flex-shrink-0 mt-0.5" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Component to display aggregated scenarios with expandable groups
function AggregatedScenariosView({ aggregated, issues }: { aggregated: AggregatedScenario[]; issues: DetectedIssue[] }) {
  const { setSelectedCallId, setSelectedIssueId, setResultsViewMode, setSelectedDimension } = useAppStore();
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const severityClasses: Record<Severity, string> = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
  };

  const rootCauseColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    knowledge: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', icon: '📚' },
    instruction: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', icon: '📋' },
    execution: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', icon: '⚠️' },
    conversation: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', icon: '💬' },
    model: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', icon: '🤖' },
  };

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
    >
      <div className="p-4 border-b border-[var(--color-navy-700)]">
        <h3 className="text-lg font-semibold text-white">Aggregated Scenarios</h3>
        <p className="text-sm text-[var(--color-slate-400)] mt-1">
          Similar scenarios grouped together • {aggregated.length} unique pattern{aggregated.length !== 1 ? 's' : ''} identified
        </p>
      </div>

      <div className="divide-y divide-[var(--color-navy-700)]">
        {aggregated.map((group, index) => {
          const isExpanded = expandedGroups.has(group.groupKey);

          return (
            <motion.div
              key={group.id}
              className="hover:bg-[var(--color-navy-800)] transition-colors"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 + index * 0.05 }}
            >
              {/* Group Header */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleGroup(group.groupKey)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Title and Badges */}
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className={`badge ${severityClasses[group.severity]}`}>
                        {group.severity}
                      </span>
                      {group.rootCauseType && rootCauseColors[group.rootCauseType] && (
                        <span className={`px-2.5 py-1 text-xs rounded-full ${rootCauseColors[group.rootCauseType].bg} ${rootCauseColors[group.rootCauseType].text} border ${rootCauseColors[group.rootCauseType].border} font-medium`}>
                          {rootCauseColors[group.rootCauseType].icon} {group.rootCauseType}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {group.dimension}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-base font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                      {group.title}
                    </h4>

                    {/* Pattern */}
                    <p className="text-sm text-[var(--color-slate-300)] mb-3">
                      {group.pattern}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm flex-wrap">
                      <div>
                        <span className="text-[var(--color-slate-400)]">Occurrences: </span>
                        <span className="font-semibold text-purple-400">{group.occurrences}</span>
                      </div>
                      <div>
                        <span className="text-[var(--color-slate-400)]">Calls Affected: </span>
                        <span className="font-semibold text-blue-400">{group.uniqueCalls}</span>
                      </div>
                      <div>
                        <span className="text-[var(--color-slate-400)]">Avg Confidence: </span>
                        <span className="font-semibold text-green-400">{group.avgConfidence}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Expand/Collapse Icon */}
                  <div className="flex-shrink-0">
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-[var(--color-slate-400)]"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Expanded Individual Scenarios */}
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-[var(--color-navy-900)] border-t border-[var(--color-navy-700)]"
                >
                  <div className="p-4">
                    <p className="text-xs text-[var(--color-slate-400)] mb-3 font-semibold uppercase tracking-wide">
                      Individual Instances ({group.scenarios.length})
                    </p>

                    <div className="space-y-2">
                      {group.scenarios.map((scenario) => (
                        <div
                          key={scenario.id}
                          className="p-3 rounded-lg bg-[var(--color-navy-800)] hover:bg-[var(--color-navy-750)] transition-colors cursor-pointer border border-[var(--color-navy-700)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCallId(scenario.callId);
                            setSelectedIssueId(findMatchingIssue(scenario, issues));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline cursor-pointer">{scenario.callId}</span>
                                <span className="text-xs text-[var(--color-slate-500)]">•</span>
                                <span className="text-xs text-[var(--color-slate-400)]">Lines {scenario.lineNumbers[0]}-{scenario.lineNumbers[scenario.lineNumbers.length - 1]}</span>
                                {scenario.title !== group.title && (
                                  <>
                                    <span className="text-xs text-[var(--color-slate-500)]">•</span>
                                    <span className="text-xs text-[var(--color-slate-400)] italic">{scenario.title}</span>
                                  </>
                                )}
                              </div>
                              <p className="text-sm text-[var(--color-slate-300)] truncate">
                                {scenario.whatHappened}
                              </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-[var(--color-slate-500)] flex-shrink-0 mt-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
