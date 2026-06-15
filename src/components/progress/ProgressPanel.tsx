'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  BarChart2,
  RefreshCw,
  GitBranch,
  Layers,
  ListChecks,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { SavedAnalysis, Scenario, RootCauseType, Severity } from '@/types';

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

// ─── Issue pattern matching ────────────────────────────────────────────────────

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

interface IssuePattern {
  key: string;
  title: string;
  dimension?: string;
  rootCauseType?: RootCauseType;
  maxSeverity: Severity;
  baselineCount: number;
  currentCount: number;
  baselineCalls: number;
  currentCalls: number;
  status: 'resolved' | 'persistent' | 'new';
  // uptick = same issue but significantly more occurrences in current
  isUptick: boolean;
}

function extractIssuePatterns(baseline: Scenario[], current: Scenario[]): IssuePattern[] {
  // Group by normalized title
  const baselineMap = new Map<string, { title: string; dimension?: string; rootCauseType?: RootCauseType; maxSeverity: Severity; count: number; calls: Set<string> }>();
  const currentMap = new Map<string, { title: string; dimension?: string; rootCauseType?: RootCauseType; maxSeverity: Severity; count: number; calls: Set<string> }>();

  const addToMap = (
    map: typeof baselineMap,
    scenario: Scenario
  ) => {
    const key = normalizeTitle(scenario.title);
    if (!map.has(key)) {
      map.set(key, {
        title: scenario.title,
        dimension: scenario.dimension,
        rootCauseType: scenario.rootCauseType,
        maxSeverity: scenario.severity,
        count: 0,
        calls: new Set(),
      });
    }
    const entry = map.get(key)!;
    entry.count++;
    entry.calls.add(scenario.callId);
    // Keep highest severity
    if (SEVERITY_WEIGHT[scenario.severity] > SEVERITY_WEIGHT[entry.maxSeverity]) {
      entry.maxSeverity = scenario.severity;
    }
  };

  baseline.forEach(s => addToMap(baselineMap, s));
  current.forEach(s => addToMap(currentMap, s));

  const allKeys = new Set([...baselineMap.keys(), ...currentMap.keys()]);
  const patterns: IssuePattern[] = [];

  for (const key of allKeys) {
    const b = baselineMap.get(key);
    const c = currentMap.get(key);

    const baselineCount = b?.count ?? 0;
    const currentCount = c?.count ?? 0;
    const title = c?.title ?? b?.title ?? key;
    const dimension = c?.dimension ?? b?.dimension;
    const rootCauseType = c?.rootCauseType ?? b?.rootCauseType;
    const maxSeverity: Severity = (() => {
      const bw = b ? SEVERITY_WEIGHT[b.maxSeverity] : 0;
      const cw = c ? SEVERITY_WEIGHT[c.maxSeverity] : 0;
      const top = Math.max(bw, cw);
      return top >= 4 ? 'critical' : top >= 3 ? 'high' : top >= 2 ? 'medium' : 'low';
    })();

    let status: IssuePattern['status'];
    if (baselineCount > 0 && currentCount === 0) status = 'resolved';
    else if (baselineCount === 0 && currentCount > 0) status = 'new';
    else status = 'persistent';

    // Uptick: current count is more than 25% higher than baseline (and at least 1 more)
    const isUptick = status === 'persistent' && currentCount > baselineCount && (currentCount - baselineCount) / baselineCount >= 0.25;

    patterns.push({
      key,
      title,
      dimension,
      rootCauseType,
      maxSeverity,
      baselineCount,
      currentCount,
      baselineCalls: b?.calls.size ?? 0,
      currentCalls: c?.calls.size ?? 0,
      status,
      isUptick,
    });
  }

  // Sort: new/uptick first (by currentCount), then persistent (by currentCount), then resolved (by baselineCount)
  const statusOrder = { new: 0, persistent: 1, resolved: 2 };
  return patterns.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    return (b.currentCount || b.baselineCount) - (a.currentCount || a.baselineCount);
  });
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

// ─── Comparison table ─────────────────────────────────────────────────────────

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

// ─── Issue tracking tab ───────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-300 border-green-500/30',
};

function IssueRow({ pattern, showBaseline, i }: { pattern: IssuePattern; showBaseline: boolean; i: number }) {
  const dimLetter = pattern.dimension?.charAt(0).toUpperCase();

  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-navy-800)] last:border-0 hover:bg-[var(--color-navy-800)]/40 transition-colors"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.03 }}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 w-5">
        {pattern.status === 'resolved' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
        {pattern.status === 'new' && <XCircle className="w-4 h-4 text-red-400" />}
        {pattern.status === 'persistent' && pattern.isUptick && <TrendingUp className="w-4 h-4 text-orange-400" />}
        {pattern.status === 'persistent' && !pattern.isUptick && <Minus className="w-4 h-4 text-yellow-400" />}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium truncate ${
            pattern.status === 'resolved' ? 'text-[var(--color-slate-400)] line-through' :
            pattern.status === 'new' ? 'text-white' :
            pattern.isUptick ? 'text-orange-200' : 'text-[var(--color-slate-200)]'
          }`}>
            {pattern.title}
          </span>
          {pattern.isUptick && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 flex-shrink-0">
              uptick
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {dimLetter && DIMENSIONS[dimLetter] && (
            <span className="text-xs text-[var(--color-slate-500)]">
              {dimLetter} · {DIMENSIONS[dimLetter]}
            </span>
          )}
          {pattern.rootCauseType && (
            <span className={`text-xs px-1.5 py-0 rounded border ${RCA_CATEGORIES[pattern.rootCauseType].bg} ${RCA_CATEGORIES[pattern.rootCauseType].color} ${RCA_CATEGORIES[pattern.rootCauseType].border}`}>
              {RCA_ICONS[pattern.rootCauseType]} {RCA_CATEGORIES[pattern.rootCauseType].label}
            </span>
          )}
        </div>
      </div>

      {/* Counts */}
      <div className="flex items-center gap-3 flex-shrink-0 text-center">
        {showBaseline && (
          <>
            <div className="w-12">
              <div className="text-xs text-[var(--color-slate-500)]">prev</div>
              <div className={`font-mono font-semibold text-sm ${pattern.baselineCount > 0 ? 'text-[var(--color-slate-300)]' : 'text-[var(--color-slate-600)]'}`}>
                {pattern.baselineCount || '—'}
              </div>
            </div>
            <div className="w-12">
              <div className="text-xs text-[var(--color-slate-500)]">now</div>
              <div className={`font-mono font-semibold text-sm ${pattern.currentCount > 0 ? 'text-white' : 'text-[var(--color-slate-600)]'}`}>
                {pattern.currentCount || '—'}
              </div>
            </div>
            <div className="w-12">
              <div className="text-xs text-[var(--color-slate-500)]">delta</div>
              <DeltaCell delta={pattern.currentCount - pattern.baselineCount} />
            </div>
          </>
        )}
        {!showBaseline && (
          <div className="w-12">
            <div className="text-xs text-[var(--color-slate-500)]">count</div>
            <div className="font-mono font-semibold text-sm text-white">{pattern.currentCount}</div>
          </div>
        )}
      </div>

      {/* Severity */}
      <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${SEVERITY_BADGE[pattern.maxSeverity]}`}>
        {pattern.maxSeverity}
      </span>
    </motion.div>
  );
}

function IssueSection({
  title,
  icon,
  issues,
  accentColor,
  showBaseline,
  defaultOpen,
}: {
  title: string;
  icon: React.ReactNode;
  issues: IssuePattern[];
  accentColor: string;
  showBaseline: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (issues.length === 0) return null;

  return (
    <div className={`border-l-2 ${accentColor} mb-4 rounded-r-lg overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--color-navy-800)] hover:bg-[var(--color-navy-700)] transition-colors text-left"
      >
        {icon}
        <span className="font-medium text-white text-sm">{title}</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--color-navy-700)] text-[var(--color-slate-400)] font-mono">
          {issues.length}
        </span>
        {open
          ? <ChevronDown className="w-4 h-4 text-[var(--color-slate-400)]" />
          : <ChevronRight className="w-4 h-4 text-[var(--color-slate-400)]" />
        }
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden bg-[var(--color-navy-900)]"
          >
            {issues.map((p, i) => (
              <IssueRow key={p.key} pattern={p} showBaseline={showBaseline} i={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IssuesTab({
  currentScenarios,
  baselineScenarios,
}: {
  currentScenarios: Scenario[];
  baselineScenarios: Scenario[] | null;
}) {
  if (!baselineScenarios) {
    // No baseline — just show current run issues grouped by status-equivalent (all "current")
    const patterns = extractIssuePatterns([], currentScenarios);
    return (
      <div>
        <div className="px-4 py-3 border-b border-[var(--color-navy-700)] text-xs text-[var(--color-slate-400)]">
          Select a previous run above to see resolved / persistent / new breakdowns. Showing current run issues only.
        </div>
        <div className="p-4">
          {patterns.map((p, i) => (
            <IssueRow key={p.key} pattern={p} showBaseline={false} i={i} />
          ))}
          {patterns.length === 0 && (
            <p className="text-[var(--color-slate-500)] text-sm text-center py-8">No issues found in current run.</p>
          )}
        </div>
      </div>
    );
  }

  const patterns = extractIssuePatterns(baselineScenarios, currentScenarios);
  const resolved = patterns.filter(p => p.status === 'resolved');
  const persistent = patterns.filter(p => p.status === 'persistent');
  const uptick = persistent.filter(p => p.isUptick);
  const stable = persistent.filter(p => !p.isUptick);
  const newIssues = patterns.filter(p => p.status === 'new');

  return (
    <div>
      {/* Summary strip */}
      <div className="grid grid-cols-4 divide-x divide-[var(--color-navy-700)] border-b border-[var(--color-navy-700)]">
        <div className="px-4 py-3 text-center">
          <div className="text-lg font-bold text-green-400">{resolved.length}</div>
          <div className="text-xs text-[var(--color-slate-500)]">Resolved</div>
        </div>
        <div className="px-4 py-3 text-center">
          <div className="text-lg font-bold text-orange-400">{uptick.length}</div>
          <div className="text-xs text-[var(--color-slate-500)]">Uptick</div>
        </div>
        <div className="px-4 py-3 text-center">
          <div className="text-lg font-bold text-yellow-400">{stable.length}</div>
          <div className="text-xs text-[var(--color-slate-500)]">Persistent</div>
        </div>
        <div className="px-4 py-3 text-center">
          <div className="text-lg font-bold text-red-400">{newIssues.length}</div>
          <div className="text-xs text-[var(--color-slate-500)]">New</div>
        </div>
      </div>

      {/* Sections */}
      <div className="p-4">
        <IssueSection
          title="New Issues"
          icon={<XCircle className="w-4 h-4 text-red-400" />}
          issues={newIssues}
          accentColor="border-red-500"
          showBaseline
          defaultOpen={true}
        />
        <IssueSection
          title="Uptick — Worsening Issues"
          icon={<TrendingUp className="w-4 h-4 text-orange-400" />}
          issues={uptick}
          accentColor="border-orange-500"
          showBaseline
          defaultOpen={true}
        />
        <IssueSection
          title="Persistent — Still Occurring"
          icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />}
          issues={stable}
          accentColor="border-yellow-500"
          showBaseline
          defaultOpen={false}
        />
        <IssueSection
          title="Resolved — No Longer Detected"
          icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
          issues={resolved}
          accentColor="border-green-500"
          showBaseline
          defaultOpen={false}
        />
        {patterns.length === 0 && (
          <p className="text-[var(--color-slate-500)] text-sm text-center py-8">No issues to compare.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ViewTab = 'dimensions' | 'rca' | 'issues';

export function ProgressPanel() {
  const { scenarioResults, fixesApplied, currentAnalysisId, currentAnalysisName, transcripts } = useAppStore();
  const [allAnalyses, setAllAnalyses] = useState<SavedAnalysis[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string>('');
  const [baselineScenarios, setBaselineScenarios] = useState<Scenario[] | null>(null);
  const [baselineCalls, setBaselineCalls] = useState<number>(0);
  const [baselineName, setBaselineName] = useState<string>('');
  const [loadingBaseline, setLoadingBaseline] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('issues');

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

  const tabs: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
    { id: 'issues', label: 'Issues', icon: <ListChecks className="w-3.5 h-3.5" /> },
    { id: 'dimensions', label: 'Dimensions', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'rca', label: 'Root Cause', icon: <GitBranch className="w-3.5 h-3.5" /> },
  ];

  const tabColors: Record<ViewTab, { active: string }> = {
    issues: { active: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
    dimensions: { active: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
    rca: { active: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
  };

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

      {/* Comparison panel with tab toggle */}
      {!loadingBaseline && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-navy-700)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeTab === 'issues' && <ListChecks className="w-5 h-5 text-emerald-400" />}
              {activeTab === 'dimensions' && <BarChart2 className="w-5 h-5 text-blue-400" />}
              {activeTab === 'rca' && <GitBranch className="w-5 h-5 text-purple-400" />}
              <h4 className="font-semibold text-white">
                {activeTab === 'issues' ? 'Issue Tracking' : activeTab === 'dimensions' ? 'By Dimension' : 'By Root Cause'}
              </h4>
              {activeBaselineRows !== null && activeTab !== 'issues' && (
                <span className="text-xs text-[var(--color-slate-400)] ml-2">
                  <span className="text-blue-300">{currentAnalysisName || 'Current'}</span>
                  {' vs '}
                  <span className="text-purple-300">{baselineName}</span>
                </span>
              )}
              {baselineName && activeTab === 'issues' && (
                <span className="text-xs text-[var(--color-slate-400)] ml-2">
                  <span className="text-emerald-300">{currentAnalysisName || 'Current'}</span>
                  {' vs '}
                  <span className="text-purple-300">{baselineName}</span>
                </span>
              )}
            </div>

            {/* Tab toggle */}
            <div className="flex items-center gap-1 bg-[var(--color-navy-800)] p-1 rounded-lg border border-[var(--color-navy-700)]">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? tabColors[tab.id].active
                      : 'text-[var(--color-slate-400)] hover:text-white hover:bg-[var(--color-navy-700)]'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'issues' ? (
            <IssuesTab
              currentScenarios={currentScenarios}
              baselineScenarios={baselineScenarios}
            />
          ) : (
            <ComparisonTable
              rows={activeRows}
              baselineRows={activeBaselineRows}
              isRCA={activeTab === 'rca'}
              baselineStats={activeBaselineRows}
            />
          )}

          {/* Legend (dimension/rca only) */}
          {activeTab !== 'issues' && (
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
          )}
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
