'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { aggregateIssues } from '@/utils/aggregateIssues';
import { aggregateCustomAudits } from '@/utils/customAuditAggregation';
import { IssueType, Severity } from '@/types';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

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

export function AggregateResults() {
  const { results, checks } = useAppStore();

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

      {/* Standard Checks Aggregation */}
      {aggregatedStandardIssues.length > 0 && (
        <motion.div
          className="glass-card overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="p-4 border-b border-[var(--color-navy-700)]">
            <h3 className="text-lg font-semibold text-white">Standard Checks - Aggregated View</h3>
            <p className="text-sm text-[var(--color-slate-400)] mt-1">
              Issues grouped by type across all calls
            </p>
          </div>

          <div className="divide-y divide-[var(--color-navy-700)]">
            {aggregatedStandardIssues.map((issue, index) => (
              <motion.div
                key={issue.id}
                className="p-4 hover:bg-[var(--color-navy-800)] transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.05 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`badge ${severityClasses[issue.severity]}`}>
                        {issue.severity}
                      </span>
                      <span className="text-lg font-medium text-white">
                        {getIssueTypeLabel(issue.type)}
                      </span>
                      <span className="text-sm text-[var(--color-slate-400)]">
                        Confidence: {issue.avgConfidence}%
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-slate-300)] mb-3">
                      {issue.pattern}
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-[var(--color-slate-400)]">Occurrences: </span>
                        <span className="font-semibold text-blue-400">{issue.occurrences}</span>
                      </div>
                      <div>
                        <span className="text-[var(--color-slate-400)]">Calls Affected: </span>
                        <span className="font-semibold text-blue-400">{issue.affectedCallIds.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Custom Audits Aggregation */}
      {aggregatedCustomIssues.length > 0 && (
        <motion.div
          className="glass-card overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="p-4 border-b border-purple-500/30 bg-purple-500/5">
            <h3 className="text-lg font-semibold text-purple-300">Custom Audits - Aggregated View</h3>
            <p className="text-sm text-[var(--color-slate-400)] mt-1">
              Open-ended audit findings grouped by similarity
            </p>
          </div>

          <div className="divide-y divide-[var(--color-navy-700)]">
            {aggregatedCustomIssues.map((issue, index) => (
              <motion.div
                key={issue.id}
                className="p-4 hover:bg-[var(--color-navy-800)] transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + index * 0.05 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`badge ${severityClasses[issue.severity]}`}>
                        {issue.severity}
                      </span>
                      <span className="text-lg font-medium text-purple-300">
                        {getIssueTypeLabel(issue.type)}
                      </span>
                      <span className="text-sm text-[var(--color-slate-400)]">
                        Confidence: {issue.avgConfidence}%
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-slate-300)] mb-3">
                      {issue.pattern}
                    </p>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-[var(--color-slate-400)]">Occurrences: </span>
                        <span className="font-semibold text-purple-400">{issue.occurrences}</span>
                      </div>
                      <div>
                        <span className="text-[var(--color-slate-400)]">Calls Affected: </span>
                        <span className="font-semibold text-purple-400">{issue.affectedCallIds.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
