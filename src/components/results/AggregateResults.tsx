'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { aggregateIssues } from '@/utils/aggregateIssues';
import { aggregateCustomAudits } from '@/utils/customAuditAggregation';
import { aggregateScenarios, AggregatedScenario } from '@/utils/aggregateScenarios';
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
  prompt: '#a855f7',    // purple-500
  flow: '#06b6d4',      // cyan-500 (Conversation Design)
  training: '#10b981',  // green-500 (Model Limitations)
  process: '#f97316',   // orange-500
  system: '#ef4444',    // red-500
  knowledge: '#eab308', // yellow-500
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

export function AggregateResults() {
  const { results, checks, scenarioResults, flowType, setResultsViewMode, setSelectedCallId, setSelectedDimension } = useAppStore();

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

  // Split issues into standard checks and custom audits
  const standardIssues = useMemo(() =>
    results?.issues.filter(issue => !issue.isCustomCheck) || [],
    [results?.issues]
  );

  const customIssues = useMemo(() =>
    results?.issues.filter(issue => issue.isCustomCheck) || [],
    [results?.issues]
  );

  // Aggregate both types
  const aggregatedStandardIssues = useMemo(() =>
    aggregateIssues(standardIssues),
    [standardIssues]
  );

  const aggregatedCustomIssues = useMemo(() =>
    aggregateCustomAudits(customIssues),
    [customIssues]
  );

  // Aggregate scenarios for open-ended flow
  const scenarioAggregation = useMemo(() => {
    if (!scenarioResults?.scenarios) return null;

    const scenarios = scenarioResults.scenarios;
    console.log('[AggregateResults] Total scenarios:', scenarios.length);
    console.log('[AggregateResults] First scenario:', scenarios[0]);

    // Aggregate similar scenarios
    const aggregatedScenarios = aggregateScenarios(scenarios);
    console.log('[AggregateResults] Aggregated scenarios:', aggregatedScenarios.length);
    console.log('[AggregateResults] First aggregated:', aggregatedScenarios[0]);

    // Group by dimension
    const byDimension: Record<string, number> = {};
    const byDimensionCalls: Record<string, Set<string>> = {}; // Track unique calls per dimension
    const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byRootCause: Record<string, number> = {};
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
      const validRootCauseTypes = ['prompt', 'flow', 'training', 'process', 'system', 'knowledge'];
      const normalizedRootCause = scenario.rootCauseType?.toLowerCase();
      if (normalizedRootCause && validRootCauseTypes.includes(normalizedRootCause)) {
        byRootCause[normalizedRootCause] = (byRootCause[normalizedRootCause] || 0) + 1;
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
        const displayName = name === 'training' ? 'Model' : name === 'flow' ? 'Design' : name.charAt(0).toUpperCase() + name.slice(1);
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
      severityChartData,
      rootCauseChartData,
      callDistributionData,
      bySeverity,
      aggregatedScenarios
    };
  }, [scenarioResults]);

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

        {/* Interactive Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audit Dimensions Distribution */}
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <PieChart className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Scenarios by Audit Dimension</h3>
              </div>
              <p className="text-xs text-[var(--color-slate-400)] ml-7">Click any segment to filter scenarios</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart
                onClick={(data) => {
                  if (data && data.activeLabel) {
                    const clickedDimension = scenarioAggregation.dimensionChartData
                      .filter(d => d.hasIssues)
                      .find(d => d.shortName === data.activeLabel);
                    if (clickedDimension) {
                      setSelectedDimension(clickedDimension.fullName);
                      setResultsViewMode('detailed');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }
                }}
              >
                <Pie
                  data={scenarioAggregation.dimensionChartData.filter(d => d.hasIssues)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.icon} ${entry.shortName} (${entry.percentage}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  cursor="pointer"
                >
                  {scenarioAggregation.dimensionChartData.filter(d => d.hasIssues).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={DIMENSION_COLORS[index % DIMENSION_COLORS.length]} />
                  ))}
                </Pie>
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
                      return (
                        <div style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: '#fff'
                        }}>
                          <p style={{ marginBottom: '4px', fontWeight: 'bold' }}>{data.icon} {data.shortName}</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>{data.fullName}</p>
                          <p style={{ color: '#60a5fa' }}>{data.value} scenarios across {data.uniqueCalls} calls</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Click to filter</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Severity Distribution */}
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-orange-400" />
              <h3 className="text-lg font-semibold text-white">Severity Distribution</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsBarChart data={scenarioAggregation.severityChartData}>
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
                />
                <Bar dataKey="value" fill="#8884d8" radius={[8, 8, 0, 0]}>
                  {scenarioAggregation.severityChartData.map((entry, index) => {
                    const colorKey = entry.name.toLowerCase() as Severity;
                    return <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[colorKey] || '#8884d8'} />;
                  })}
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
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
                  <span className="text-purple-400 flex-shrink-0">📝 Prompt:</span>
                  <span className="text-slate-300">Agent's <strong>system instructions</strong> need updates (quick config fix)</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-green-400 flex-shrink-0">🤖 Model:</span>
                  <span className="text-slate-300">AI model's <strong>inherent capabilities/limitations</strong> insufficient (needs better model)</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-cyan-400 flex-shrink-0">🎨 Design:</span>
                  <span className="text-slate-300">Conversation <strong>design/architecture</strong> has structural gaps or errors</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-yellow-400 flex-shrink-0">📚 Knowledge:</span>
                  <span className="text-slate-300"><strong>Information missing</strong> from knowledge base or docs</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-orange-400 flex-shrink-0">⚙️ Process:</span>
                  <span className="text-slate-300">Business <strong>workflow/procedures</strong> are flawed</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-red-400 flex-shrink-0">💻 System:</span>
                  <span className="text-slate-300"><strong>Technical limitations</strong>, bugs, or system capability issues</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-400">
                <strong className="text-purple-300">Key difference:</strong> <span className="text-purple-400">Prompt</span> = change <em>instructions</em> (config) • <span className="text-green-400">Model</span> = AI lacks <em>capability</em> (upgrade model) • <span className="text-cyan-400">Design</span> = <em>conversation structure</em> flawed
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
                    {' '}are <span className="font-semibold text-purple-400">{
                      scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'training'
                        ? 'model limitation'
                        : scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'flow'
                        ? 'conversation design'
                        : scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase()
                    }</span> issues
                    {scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'prompt'
                      ? ' - Update agent system instructions/prompts. Check the Fixes tab for exact solutions!'
                      : scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'flow'
                      ? ' - Redesign conversation structure/architecture. Check the Fixes tab for exact solutions!'
                      : scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'training'
                      ? ' - AI model lacks capability; consider upgrading to a more capable model'
                      : scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'knowledge'
                      ? ' - Add missing information to knowledge base or reference materials'
                      : scenarioAggregation.rootCauseChartData[0]?.name.toLowerCase() === 'process'
                      ? ' - Revise business workflows, procedures, and policies'
                      : ' - Address technical limitations, bugs, or system capability issues'
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
                            {rootCauseKey === 'prompt' && '📝 Fix: Update agent\'s system instructions/prompts (configuration change)'}
                            {rootCauseKey === 'design' && '🎨 Fix: Redesign conversation structure/architecture'}
                            {rootCauseKey === 'model' && '🤖 Fix: Upgrade to more capable AI model (current model insufficient)'}
                            {rootCauseKey === 'process' && '⚙️ Fix: Revise business workflows & procedures'}
                            {rootCauseKey === 'system' && '💻 Fix: Address technical limitations or system bugs'}
                            {rootCauseKey === 'knowledge' && '📚 Fix: Add missing information to knowledge base'}
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
                    const colorKey = displayKey === 'model' ? 'training' : displayKey === 'design' ? 'flow' : displayKey;
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
                const colorKey = rootCauseKey === 'model' ? 'training' : rootCauseKey === 'design' ? 'flow' : rootCauseKey;
                const icons: Record<string, string> = {
                  prompt: '📝', design: '🎨', model: '🤖',
                  process: '⚙️', system: '💻', knowledge: '📚'
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

        {/* Call Distribution Chart */}
        <motion.div
          className="glass-card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Scenarios per Call (Top 10)</h3>
            <span className="ml-auto text-sm text-[var(--color-slate-400)]">
              {scenarioAggregation.affectedCalls} calls with scenarios • Click bar to view call details
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsBarChart
              data={scenarioAggregation.callDistributionData}
              layout="vertical"
              onClick={(data) => {
                if (data && data.activeLabel) {
                  setSelectedCallId(String(data.activeLabel));
                  setResultsViewMode('detailed');
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis
                type="number"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                type="category"
                dataKey="callId"
                stroke="#94a3b8"
                style={{ fontSize: '11px' }}
                width={100}
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
                    return (
                      <div style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#fff'
                      }}>
                        <p style={{ marginBottom: '4px', fontWeight: 'bold' }}>{payload[0].payload.callId}</p>
                        <p style={{ color: '#60a5fa' }}>{payload[0].value} scenarios</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Click to view call details</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="scenarios"
                fill="#3b82f6"
                radius={[0, 8, 8, 0]}
                cursor="pointer"
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Dimension Breakdown with Nested Aggregated Scenarios */}
        <DimensionBreakdownWithAggregation
          dimensionChartData={scenarioAggregation.dimensionChartData}
          aggregatedScenarios={scenarioAggregation.aggregatedScenarios}
        />
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

      {/* Checks Overview by Pillar - Always show to display all enabled checks */}
      <CheckPillarOverview
        standardIssues={aggregatedStandardIssues}
        customIssues={aggregatedCustomIssues}
        checks={checks}
      />

      {/* Standard Checks Aggregation - Hierarchical View */}
      {aggregatedStandardIssues.length > 0 && (
        <ObjectiveIssuesBreakdown
          aggregatedIssues={aggregatedStandardIssues}
          getIssueTypeLabel={getIssueTypeLabel}
          title="Standard Checks - Aggregated View"
          subtitle="Issues grouped by type with expandable details"
        />
      )}

      {/* Custom Audits Aggregation - Hierarchical View */}
      {aggregatedCustomIssues.length > 0 && (
        <ObjectiveIssuesBreakdown
          aggregatedIssues={aggregatedCustomIssues}
          getIssueTypeLabel={getIssueTypeLabel}
          title="Custom Audits - Aggregated View"
          subtitle="Open-ended audit findings grouped by similarity"
          customStyle={true}
        />
      )}
    </div>
  );
}

// Component to display check pillar overview
function CheckPillarOverview({
  standardIssues,
  customIssues,
  checks
}: {
  standardIssues: AggregatedIssue[];
  customIssues: AggregatedIssue[];
  checks: CheckConfig[];
}) {
  // Early return if checks is not an array
  if (!Array.isArray(checks)) {
    console.error('CheckPillarOverview: checks is not an array', checks);
    return null;
  }

  const allIssues = [...standardIssues, ...customIssues];

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
  const { setSelectedCallId, setResultsViewMode } = useAppStore();
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
                            setResultsViewMode('detailed');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-mono text-blue-400">{instance.callId}</span>
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
  aggregatedScenarios
}: {
  dimensionChartData: any[];
  aggregatedScenarios: AggregatedScenario[];
}) {
  const { setSelectedCallId, setResultsViewMode, setSelectedDimension } = useAppStore();
  const [expandedDimensions, setExpandedDimensions] = React.useState<Set<string>>(new Set());
  const [expandedScenarios, setExpandedScenarios] = React.useState<Set<string>>(new Set());

  const toggleDimension = (dimensionName: string) => {
    const newExpanded = new Set(expandedDimensions);
    if (newExpanded.has(dimensionName)) {
      newExpanded.delete(dimensionName);
    } else {
      newExpanded.add(dimensionName);
    }
    setExpandedDimensions(newExpanded);
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
    prompt: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', icon: '📝' },
    flow: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', icon: '🎨' },
    training: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', icon: '🤖' },
    process: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', icon: '⚙️' },
    system: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', icon: '💻' },
    knowledge: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', icon: '📚' },
  };

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
    >
      <div className="p-4 border-b border-[var(--color-navy-700)]">
        <h3 className="text-lg font-semibold text-white">Audit Dimension Breakdown</h3>
        <p className="text-sm text-[var(--color-slate-400)] mt-1">
          Click any dimension to expand and view aggregated scenarios
        </p>
      </div>

      <div className="divide-y divide-[var(--color-navy-700)]">
        {dimensionChartData.map((dimension, dimensionIndex) => {
          const isDimensionExpanded = expandedDimensions.has(dimension.fullName);
          const hasIssues = dimension.value > 0;
          // Filter aggregated scenarios for this dimension
          const dimensionAggregatedScenarios = aggregatedScenarios.filter(
            agg => agg.dimension === dimension.fullName
          );

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
                          ? DIMENSION_COLORS[dimensionIndex % DIMENSION_COLORS.length]
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
                                    {rootCauseColors[group.rootCauseType].icon} {group.rootCauseType === 'training' ? 'model' : group.rootCauseType === 'flow' ? 'design' : group.rootCauseType}
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
                                      setResultsViewMode('detailed');
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-mono text-blue-400">{scenario.callId}</span>
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
                                      </div>
                                      <ArrowRight className="w-3 h-3 text-[var(--color-slate-500)] flex-shrink-0 mt-0.5" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Component to display aggregated scenarios with expandable groups
function AggregatedScenariosView({ aggregated }: { aggregated: AggregatedScenario[] }) {
  const { setSelectedCallId, setResultsViewMode, setSelectedDimension } = useAppStore();
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
    prompt: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', icon: '📝' },
    flow: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', icon: '🎨' },
    training: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', icon: '🤖' },
    process: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', icon: '⚙️' },
    system: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', icon: '💻' },
    knowledge: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', icon: '📚' },
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
                          {rootCauseColors[group.rootCauseType].icon} {group.rootCauseType === 'training' ? 'model' : group.rootCauseType === 'flow' ? 'design' : group.rootCauseType}
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
                            setResultsViewMode('detailed');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-blue-400">{scenario.callId}</span>
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
