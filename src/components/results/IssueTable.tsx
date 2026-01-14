'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Filter, ExternalLink, Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { IssueType, Severity, DetectedIssue } from '@/types';

const issueTypeLabels: Record<IssueType, string> = {
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

export function IssueTable() {
  const { results, setSelectedCallId } = useAppStore();
  const [typeFilter, setTypeFilter] = useState<IssueType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!results) return null;

  const filteredIssues = results.issues.filter((issue) => {
    if (typeFilter !== 'all' && issue.type !== typeFilter) return false;
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (
      searchTerm &&
      !issue.evidenceSnippet.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !issue.callId.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-navy-700)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Detected Issues</h3>
          <span className="text-sm text-[var(--color-slate-400)]">
            {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-slate-400)]" />
            <input
              type="text"
              className="input-field pl-10"
              placeholder="Search issues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--color-slate-400)]" />
            <select
              className="input-field w-auto"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as IssueType | 'all')}
            >
              <option value="all">All Types</option>
              {Object.entries(issueTypeLabels).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <select
            className="input-field w-auto"
            value={severityFilter}
            onChange={(e) =>
              setSeverityFilter(e.target.value as Severity | 'all')
            }
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Call ID</th>
              <th>Issue Type</th>
              <th>Severity</th>
              <th>Confidence</th>
              <th>Evidence</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredIssues.map((issue, index) => (
              <motion.tr
                key={issue.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <td className="font-mono text-sm">{issue.callId}</td>
                <td>
                  <span className="text-[var(--color-slate-200)]">
                    {issueTypeLabels[issue.type]}
                  </span>
                </td>
                <td>
                  <span className={`badge ${severityClasses[issue.severity]}`}>
                    {issue.severity}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[var(--color-navy-700)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${issue.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm text-[var(--color-slate-400)]">
                      {issue.confidence}%
                    </span>
                  </div>
                </td>
                <td className="max-w-xs">
                  <p className="text-sm text-[var(--color-slate-300)] truncate">
                    {issue.evidenceSnippet}
                  </p>
                </td>
                <td>
                  <button
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                    onClick={() => setSelectedCallId(issue.callId)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    View
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredIssues.length === 0 && (
        <div className="p-8 text-center text-[var(--color-slate-400)]">
          No issues match your filters.
        </div>
      )}
    </motion.div>
  );
}
