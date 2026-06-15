'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  AlertCircle,
  BarChart2,
  RefreshCw,
  GitBranch,
  Layers,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { SavedAnalysis, Scenario, RootCauseType } from '@/types';

const STORAGE_KEY = 'voicebot-qa-storage-v1';

// ─── Dimensions ───────────────────────────────────────────────────────────────

const DIMENSIONS: Record<string, string> = {
  A: 'Conversation Control & Flow',
  B: 'Temporal Dynamics & Turn Taking',
  C: 'Context Tracking & Intent',
  D: 'Language Quality & Human-likeness',
  E: 'Knowledge & Accuracy',
  F: 'Process & Policy Adherence',
  G: 'Novel & Emerging Issues',
};

// ─── RCA Categories ───────────────────────────────────────────────────────────

const RCA_CATEGORIES: Record<RootCauseType, { label: string; description: string; color: string; bg: string; border: string }> = {
  execution: {
    label: 'Execution Failure',
    description: 'Agent knew what to do but didn\'t do it',
    color: 'text-orange-300',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30',
  },
  instruction: {
    label: 'Instruction Gap',
    description: 'Missing or unclear instruction in script/KB',
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/30',
  },
  knowledge: {
    label: 'Knowledge Gap',
    description: 'Agent lacked domain knowledge',
    color: 'text-yellow-300',
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/30',
  },
  conversation: {
    label: 'Conversation Failure',
    description: 'Context or conversational flow breakdown',
    color: 'text-purple-300',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
  },
  model: {
    label: 'Model Limitation',
    description: 'Inherent model capability constraint',
    color: 'text-green-300',
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
  },
};

const RCA_ICONS: Record<RootCauseType, string> = {
  execution: '⚠️',
  instruction: '📋',
  knowledge: '📚',
  conversation: '💬',
  model: '🤖',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function severityLabel(avg: number) {
  if (avg === 0) return '—';
  if (avg < 1.5) return 'Low';
  if (avg < 2.5) return 'Medium';
  if (avg < 3.5) return 'High';
  return 'Critical';
}

function severityColor(avg: number) {
  if (avg === 0) return 'text-[var(--color-slate-500)]';
  if (avg < 1.5) return 'text-green-400';
  if (avg < 2.5) return 'text-yellow-400';
  if (avg < 3.5) return 'text-orange-400';
  return 'text-red-400';
}

function extractDimensionStats(scenarios: Scenario[], totalCalls: number) {
  const stats: Record<string, { count: number; severity: number; calls: Set<string> }> = {};
  for (const dim of Object.keys(DIMENSIONS)) {
    stats[dim] = { count: 0, severity: 0, calls: new Set() };
  }
  for (const s of scenarios) {
    if (!s.dimension) continue;
    const letter = s.dimension.charAt(0).toUpperCase();
    if (!stats[letter]) continue;
    stats[letter].count++;
    stats[letter].severity += SEVERITY_WEIGHT[s.severity] ?? 1;
    stats[letter].calls.add(s.callId);
  }
  return Object.entries(stats).map(([dim, s]) => ({
    key: dim,
    label: DIMENSIONS[dim],
    count: s.count,
    affectedCalls: s.calls.size,
    avgSeverity: s.count > 0 ? +(s.severity / s.count).toFixed(1) : 0,
    totalCalls,
  }));
}

function extractRCAStats(scenarios: Scenario[], totalCalls: number) {
  const stats: Record<string, { count: number; severity: number; calls: Set<string> }> = {};
  for (const rca of Object.keys(RCA_CATEGORIES)) {
    stats[rca] = { count: 0, severity: 0, calls: new Set() };
  }
  for (const s of scenarios) {
    if (!s.rootCauseType || !stats[s.rootCauseType]) continue;
    stats[s.rootCauseType].count++;
    stats[s.rootCauseType].severity += SEVERITY_WEIGHT[s.severity] ?? 1;
    stats[s.rootCauseType].calls.add(s.callId);
  }
  return Object.entries(stats).map(([rca, s]) => ({
    key: rca as RootCauseType,
    label: RCA_CATEGORIES[rca as RootCauseType].label,
    description: RCA_CATEGORIES[rca as RootCauseType].description,
    count: s.count,
    affectedCalls: s.calls.size,
    avgSeverity: s.count > 0 ? +(s.severity / s.count).toFixed(1) : 0,
    totalCalls,
  }));
}

// ─── Delta cell ───────────────────────────────────────────────────────────────

function DeltaCell({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-[var(--color-slate-600)]">—</span>;
  if (delta === 0) return (
    <span className="flex items-center justify-center gap-1 text-[var(--color-slate-400)]">
      <Minus className="w-3 h-3" /><span className="font-mono text-xs">0</span>
    </span>
  );
  if (delta < 0) return (
    <span className="flex items-center justify-center gap-1 text-green-400">
      <TrendingDown className="w-3.5 h-3.5" /><span className="font-mono text-xs font-semibold">{delta}</span>
    </span>
  );
  return (
    <span className="flex items-center justify-center gap-1 text-red-400">
      <TrendingUp className="w-3.5 h-3.5" /><span className="font-mono text-xs font-semibold">+{delta}</span>
    </span>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

type RowData = ReturnType<typeof extractDimensionStats>[number] | ReturnType<typeof extractRCAStats>[number];

function ComparisonTable({
  rows,
  baselineRows,
  isRCA,
  baselineStats,
}: {
  rows: RowData[];
  baselineRows: RowData[] | null;
  isRCA: boolean;
  baselineStats: RowData[] | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-navy-700)] text-[var(--color-slate-400)] text-xs uppercase">
            <th className="text-left px-4 py-3 font-medium">{isRCA ? 'Root Cause' : 'Dimension'}</th>
            <th className="text-center px-4 py-3 font-medium">
              {baselineStats !== null ? 'Previous' : 'Scenarios'}
            </th>
            {baselineStats !== null && <th className="text-center px-4 py-3 font-medium">Current</th>}
            {baselineStats !== null && <th className="text-center px-4 py-3 font-medium">Change</th>}
            <th className="text-center px-4 py-3 font-medium">Affected Calls</th>
            <th className="text-center px-4 py-3 font-medium">Avg Severity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-navy-800)]">
          {rows.map((row, i) => {
            const baseline = baselineRows?.find((b) => b.key === row.key);
            const delta = baseline !== undefined ? row.count - baseline.count : null;
            const isG = !isRCA && row.key === 'G';
            const rcaMeta = isRCA ? RCA_CATEGORIES[row.key as RootCauseType] : null;

            return (
              <motion.tr
                key={row.key}
                className="hover:bg-[var(--color-navy-800)/50] transition-colors"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {isRCA && rcaMeta ? (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${rcaMeta.bg} ${rcaMeta.color} border ${rcaMeta.border} font-medium whitespace-nowrap`}>
                        {RCA_ICONS[row.key as RootCauseType]} {rcaMeta.label}
                      </span>
                    ) : (
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isG ? 'bg-purple-500/20 text-purple-300' :
                        row.count > 0 ? 'bg-blue-500/20 text-blue-300' :
                        'bg-[var(--color-navy-700)] text-[var(--color-slate-500)]'
                      }`}>
                        {row.key}
                      </span>
                    )}
                    {!isRCA && (
                      <div>
                        <div className="text-white font-medium text-sm">{row.label}</div>
                        {isG && <div className="text-xs text-purple-400">Discovery metric</div>}
                      </div>
                    )}
                    {isRCA && rcaMeta && (
                      <div className="text-xs text-[var(--color-slate-500)] hidden md:block">
                        {rcaMeta.description}
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3 text-center">
                  <span className={`font-mono font-semibold ${
                    baseline !== undefined
                      ? baseline.count > 0 ? 'text-[var(--color-slate-300)]' : 'text-[var(--color-slate-600)]'
                      : row.count > 0 ? 'text-white' : 'text-[var(--color-slate-600)]'
                  }`}>
                    {baseline !== undefined ? baseline.count : row.count}
                  </span>
                </td>

                {baselineStats !== null && (
                  <td className="px-4 py-3 text-center">
                    <span className={`font-mono font-semibold ${row.count > 0 ? 'text-white' : 'text-[var(--color-slate-600)]'}`}>
                      {row.count}
                    </span>
                  </td>
                )}

                {baselineStats !== null && (
                  <td className="px-4 py-3 text-center">
                    <DeltaCell delta={delta} />
                  </td>
                )}

                <td className="px-4 py-3 text-center">
                  <span className="text-[var(--color-slate-300)] font-mono text-sm">
                    {row.affectedCalls > 0 ? `${row.affectedCalls}/${row.totalCalls}` : '—'}
                  </span>
                </td>

                <td className="px-4 py-3 text-center">
                  <span className={`text-sm font-medium ${severityColor(row.avgSeverity)}`}>
                    {severityLabel(row.avgSeverity)}
                  </span>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ViewTab = 'dimensions' | 'rca';

export function ProgressPanel() {
  const { scenarioResults, fixesApplied, currentAnalysisId, currentAnalysisName, transcripts } = useAppStore();
  const [allAnalyses, setAllAnalyses] = useState<SavedAnalysis[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string>('');
  const [baselineScenarios, setBaselineScenarios] = useState<Scenario[] | null>(null);
  const [baselineCalls, setBaselineCalls] = useState<number>(0);
  const [baselineName, setBaselineName] = useState<string>('');
  const [loadingBaseline, setLoadingBaseline] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('dimensions');

  useEffect(() => { loadAnalysesList(); }, []);

  const loadAnalysesList = async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch(`/api/analyses?storageKey=${STORAGE_KEY}`);
      if (res.ok) {
        const data: SavedAnalysis[] = await res.json();
        setAllAnalyses(data.filter((a) => a.id !== currentAnalysisId));
      }
    } catch { /* ignore */ } finally { setIsLoadingList(false); }
  };

  const handleSelectBaseline = async (id: string) => {
    setSelectedBaselineId(id);
    if (!id) { setBaselineScenarios(null); setBaselineName(''); return; }
    setLoadingBaseline(true);
    try {
      const res = await fetch(`/api/analyses?storageKey=${STORAGE_KEY}&id=${id}`);
      if (res.ok) {
        const data = await res.json();
        const state = data.state;
        setBaselineScenarios(state?.scenarioResults?.scenarios ?? []);
        setBaselineCalls(state?.transcripts?.length ?? 0);
        setBaselineName(data.name);
      }
    } catch { /* ignore */ } finally { setLoadingBaseline(false); }
  };

  const currentScenarios = scenarioResults?.scenarios ?? [];
  const currentCalls = transcripts.length;

  const currentDimStats = extractDimensionStats(currentScenarios, currentCalls);
  const currentRCAStats = extractRCAStats(currentScenarios, currentCalls);
  const baselineDimStats = baselineScenarios !== null ? extractDimensionStats(baselineScenarios, baselineCalls) : null;
  const baselineRCAStats = baselineScenarios !== null ? extractRCAStats(baselineScenarios, baselineCalls) : null;

  const totalCurrentIssues = currentScenarios.length;
  const totalBaselineIssues = baselineScenarios?.length ?? 0;
  const totalDelta = baselineDimStats !== null ? totalCurrentIssues - totalBaselineIssues : null;

  const activeRows = activeTab === 'dimensions' ? currentDimStats : currentRCAStats;
  const activeBaselineRows = activeTab === 'dimensions' ? baselineDimStats : baselineRCAStats;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="glass-card p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">Progress Tracker</h3>
            <p className="text-sm text-[var(--color-slate-400)]">
              Compare this run against a previous run to measure improvement.
              {!fixesApplied && (
                <span className="ml-2 text-amber-400">
                  Tip: mark fixes as applied on the previous run before comparing.
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 min-w-[320px]">
            <label className="text-sm text-[var(--color-slate-400)] whitespace-nowrap">
              Compare against:
            </label>
            {isLoadingList ? (
              <div className="flex-1 h-10 rounded-lg bg-[var(--color-navy-800)] animate-pulse" />
            ) : (
              <div className="relative flex-1">
                <select
                  value={selectedBaselineId}
                  onChange={(e) => handleSelectBaseline(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
                >
                  <option value="">-- Select a run --</option>
                  {allAnalyses.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-slate-400)] pointer-events-none" />
              </div>
            )}
            <button
              onClick={loadAnalysesList}
              className="p-2 rounded-lg hover:bg-[var(--color-navy-700)] transition-colors"
              title="Refresh list"
            >
              <RefreshCw className="w-4 h-4 text-[var(--color-slate-400)]" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {baselineDimStats !== null && (
        <motion.div
          className="grid grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="glass-card p-4 text-center">
            <div className="text-xs text-[var(--color-slate-400)] mb-1">Previous Run</div>
            <div className="text-3xl font-bold text-white">{totalBaselineIssues}</div>
            <div className="text-xs text-[var(--color-slate-500)] mt-1">total scenarios</div>
            <div className="text-xs text-[var(--color-slate-500)]">{baselineCalls} calls · {baselineName}</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-xs text-[var(--color-slate-400)] mb-1">Current Run</div>
            <div className="text-3xl font-bold text-white">{totalCurrentIssues}</div>
            <div className="text-xs text-[var(--color-slate-500)] mt-1">total scenarios</div>
            <div className="text-xs text-[var(--color-slate-500)]">{currentCalls} calls · {currentAnalysisName || 'This run'}</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-xs text-[var(--color-slate-400)] mb-1">Overall Change</div>
            <div className={`text-3xl font-bold ${
              totalDelta === null ? 'text-[var(--color-slate-500)]' :
              totalDelta < 0 ? 'text-green-400' :
              totalDelta > 0 ? 'text-red-400' : 'text-[var(--color-slate-300)]'
            }`}>
              {totalDelta === null ? '—' : totalDelta > 0 ? `+${totalDelta}` : `${totalDelta}`}
            </div>
            <div className="text-xs text-[var(--color-slate-500)] mt-1">scenario delta</div>
            <div className={`text-xs mt-1 font-medium ${
              totalDelta === null ? '' :
              totalDelta < 0 ? 'text-green-400' :
              totalDelta > 0 ? 'text-red-400' : 'text-[var(--color-slate-400)]'
            }`}>
              {totalDelta === null ? '' : totalDelta < 0 ? 'Improved' : totalDelta > 0 ? 'Regressed' : 'No change'}
            </div>
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {loadingBaseline && (
        <div className="glass-card p-8 flex items-center justify-center gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <RefreshCw className="w-5 h-5 text-blue-400" />
          </motion.div>
          <span className="text-[var(--color-slate-400)]">Loading baseline data...</span>
        </div>
      )}

      {/* Comparison table with tab toggle */}
      {!loadingBaseline && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-navy-700)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeTab === 'dimensions'
                ? <BarChart2 className="w-5 h-5 text-blue-400" />
                : <GitBranch className="w-5 h-5 text-purple-400" />
              }
              <h4 className="font-semibold text-white">
                {activeTab === 'dimensions' ? 'By Dimension' : 'By Root Cause'}
              </h4>
              {activeBaselineRows !== null && (
                <span className="text-xs text-[var(--color-slate-400)] ml-2">
                  <span className="text-blue-300">{currentAnalysisName || 'Current'}</span>
                  {' vs '}
                  <span className="text-purple-300">{baselineName}</span>
                </span>
              )}
            </div>

            {/* Tab toggle */}
            <div className="flex items-center gap-1 bg-[var(--color-navy-800)] p-1 rounded-lg border border-[var(--color-navy-700)]">
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'dimensions'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-[var(--color-slate-400)] hover:text-white hover:bg-[var(--color-navy-700)]'
                }`}
                onClick={() => setActiveTab('dimensions')}
              >
                <Layers className="w-3.5 h-3.5" />
                Dimensions
              </button>
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'rca'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-[var(--color-slate-400)] hover:text-white hover:bg-[var(--color-navy-700)]'
                }`}
                onClick={() => setActiveTab('rca')}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Root Cause
              </button>
            </div>
          </div>

          <ComparisonTable
            rows={activeRows}
            baselineRows={activeBaselineRows}
            isRCA={activeTab === 'rca'}
            baselineStats={activeBaselineRows}
          />

          {/* Legend */}
          <div className="px-4 py-3 border-t border-[var(--color-navy-700)] flex flex-wrap items-center gap-4 text-xs text-[var(--color-slate-400)]">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="w-3 h-3 text-green-400" />
              Fewer scenarios = improvement
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-red-400" />
              More scenarios = regression
            </span>
            {activeTab === 'dimensions' && (
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-bold">G</span>
                Discovery — track separately
              </span>
            )}
            {activeTab === 'rca' && (
              <span className="flex items-center gap-1.5 text-amber-400">
                🤖 Model — training-level change, not a prompt fix
              </span>
            )}
            {activeBaselineRows === null && (
              <span className="ml-auto text-[var(--color-slate-500)]">
                Select a previous run above to see deltas
              </span>
            )}
          </div>
        </div>
      )}

      {/* No scenarios warning */}
      {currentScenarios.length === 0 && (
        <div className="glass-card p-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-[var(--color-slate-400)]">
            No scenarios found in this run. Run an open-ended analysis first to see progress.
          </p>
        </div>
      )}
    </div>
  );
}
