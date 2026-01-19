'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Filter, ExternalLink, Search, BarChart3, List } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { IssueType, Severity } from '@/types';
import { aggregateIssues } from '@/utils/aggregateIssues';
import { aggregateCustomAudits } from '@/utils/customAuditAggregation';

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
  const { results, setSelectedCallId, checks } = useAppStore();

  // Dynamic label lookup that handles custom checks
  const getIssueTypeLabel = (type: IssueType): string => {
    // First, check if it's a predefined type
    if (type in issueTypeLabels) {
      return issueTypeLabels[type];
    }

    // Try to find a check with matching ID
    const matchingCheck = checks.find(check => check.id === type);
    if (matchingCheck) {
      return matchingCheck.name;
    }

    // Fallback: format the type nicely
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  const [typeFilter, setTypeFilter] = useState<IssueType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'aggregated' | 'detailed'>('aggregated');
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  if (!results) return null;

  // Split issues into standard checks and custom audits
  const standardIssues = useMemo(() =>
    results.issues.filter(issue => !issue.isCustomCheck),
    [results.issues]
  );

  const customIssues = useMemo(() =>
    results.issues.filter(issue => issue.isCustomCheck),
    [results.issues]
  );

  // Aggregate issues with different logic
  const aggregatedStandardIssues = useMemo(() =>
    aggregateIssues(standardIssues),
    [standardIssues]
  );

  const aggregatedCustomIssues = useMemo(() =>
    aggregateCustomAudits(customIssues),
    [customIssues]
  );

  // Combined for legacy views
  const aggregatedIssues = useMemo(() =>
    [...aggregatedStandardIssues, ...aggregatedCustomIssues],
    [aggregatedStandardIssues, aggregatedCustomIssues]
  );

  // Get unique issue types from actual results
  const uniqueIssueTypes = Array.from(new Set(results.issues.map(issue => issue.type)));

  // Separate filtering for standard and custom issues
  const filteredStandardIssues = standardIssues.filter((issue) => {
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

  const filteredCustomIssues = customIssues.filter((issue) => {
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

  const filteredAggregatedStandardIssues = aggregatedStandardIssues.filter((issue) => {
    if (typeFilter !== 'all' && issue.type !== typeFilter) return false;
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (
      searchTerm &&
      !issue.pattern.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  const filteredAggregatedCustomIssues = aggregatedCustomIssues.filter((issue) => {
    if (typeFilter !== 'all' && issue.type !== typeFilter) return false;
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (
      searchTerm &&
      !issue.pattern.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIssues(newExpanded);
  };

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
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-[var(--color-navy-800)] rounded-lg p-1">
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                  viewMode === 'aggregated'
                    ? 'bg-blue-500 text-white'
                    : 'text-[var(--color-slate-400)] hover:text-white'
                }`}
                onClick={() => setViewMode('aggregated')}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Aggregated
              </button>
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                  viewMode === 'detailed'
                    ? 'bg-blue-500 text-white'
                    : 'text-[var(--color-slate-400)] hover:text-white'
                }`}
                onClick={() => setViewMode('detailed')}
              >
                <List className="w-3.5 h-3.5" />
                Detailed
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm text-[var(--color-slate-400)]">
              {viewMode === 'aggregated' ? (
                <>
                  <span>Standard: {filteredAggregatedStandardIssues.length}</span>
                  {customIssues.length > 0 && (
                    <span>Custom: {filteredAggregatedCustomIssues.length}</span>
                  )}
                </>
              ) : (
                <>
                  <span>Standard: {filteredStandardIssues.length}</span>
                  {customIssues.length > 0 && (
                    <span>Custom: {filteredCustomIssues.length}</span>
                  )}
                </>
              )}
            </div>
          </div>
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
              {uniqueIssueTypes.map((type) => (
                <option key={type} value={type}>
                  {getIssueTypeLabel(type)}
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

      {/* Aggregated View */}
      {viewMode === 'aggregated' && (
        <div className="space-y-6">
          {/* Standard Checks Section */}
          {filteredAggregatedStandardIssues.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-[var(--color-navy-800)] border-b border-[var(--color-navy-700)]">
                <h4 className="text-sm font-semibold text-white">Standard Checks</h4>
              </div>
              <div className="divide-y divide-[var(--color-navy-700)]">
                {filteredAggregatedStandardIssues.map((issue, index) => (
                  <motion.div
                    key={issue.id}
                    className="p-4 hover:bg-[var(--color-navy-800)] transition-colors"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`badge ${severityClasses[issue.severity]}`}>
                            {issue.severity}
                          </span>
                          <span className="text-[var(--color-slate-200)] font-medium">
                            {getIssueTypeLabel(issue.type)}
                          </span>
                          <span className="text-xs text-[var(--color-slate-400)]">
                            Avg Confidence: {issue.avgConfidence}%
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-slate-300)] mb-2">
                          {issue.pattern}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-[var(--color-slate-400)]">
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-blue-400">{issue.occurrences}</span>
                            call{issue.occurrences !== 1 ? 's' : ''} affected
                          </span>
                          <button
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                            onClick={() => toggleExpanded(issue.id)}
                          >
                            {expandedIssues.has(issue.id) ? 'Hide' : 'Show'} details
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedIssues.has(issue.id) && (
                      <motion.div
                        className="mt-4 space-y-3"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {/* All Patterns/Findings */}
                        {(() => {
                          const uniquePatterns = Array.from(new Set(issue.instances.map(i => i.explanation)));
                          if (uniquePatterns.length > 1) {
                            return (
                              <div className="bg-[var(--color-navy-900)] rounded-lg p-3">
                                <p className="text-xs text-[var(--color-slate-400)] mb-2">All Findings ({uniquePatterns.length}):</p>
                                <div className="space-y-2">
                                  {uniquePatterns.map((pattern, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      <span className="text-blue-400 font-semibold text-xs mt-0.5">{idx + 1}.</span>
                                      <p className="text-xs text-[var(--color-slate-300)] flex-1">
                                        {pattern}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        <div className="bg-[var(--color-navy-900)] rounded-lg p-3">
                          <p className="text-xs text-[var(--color-slate-400)] mb-2">Affected Calls:</p>
                          <div className="flex flex-wrap gap-2">
                            {issue.affectedCallIds.map(callId => (
                              <button
                                key={callId}
                                className="px-2 py-1 bg-[var(--color-navy-700)] hover:bg-[var(--color-navy-600)] rounded text-xs font-mono text-[var(--color-slate-200)] transition-colors"
                                onClick={() => setSelectedCallId(callId)}
                              >
                                {callId}
                              </button>
                            ))}
                          </div>
                        </div>

                        {issue.evidenceSnippets.length > 0 && (
                          <div className="bg-[var(--color-navy-900)] rounded-lg p-3">
                            <p className="text-xs text-[var(--color-slate-400)] mb-2">Sample Evidence:</p>
                            <div className="space-y-2">
                              {issue.evidenceSnippets.map((snippet, idx) => (
                                <p key={idx} className="text-xs text-[var(--color-slate-300)] border-l-2 border-blue-500 pl-2">
                                  {snippet}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Audits Section */}
          {filteredAggregatedCustomIssues.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/30">
                <h4 className="text-sm font-semibold text-purple-300">Custom Audits</h4>
              </div>
              <div className="divide-y divide-[var(--color-navy-700)]">
                {filteredAggregatedCustomIssues.map((issue, index) => (
            <motion.div
              key={issue.id}
              className="p-4 hover:bg-[var(--color-navy-800)] transition-colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`badge ${severityClasses[issue.severity]}`}>
                      {issue.severity}
                    </span>
                    <span className="text-[var(--color-slate-200)] font-medium">
                      {getIssueTypeLabel(issue.type)}
                    </span>
                    <span className="text-xs text-[var(--color-slate-400)]">
                      Avg Confidence: {issue.avgConfidence}%
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-slate-300)] mb-2">
                    {issue.pattern}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-slate-400)]">
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-blue-400">{issue.occurrences}</span>
                      call{issue.occurrences !== 1 ? 's' : ''} affected
                    </span>
                    <button
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={() => toggleExpanded(issue.id)}
                    >
                      {expandedIssues.has(issue.id) ? 'Hide' : 'Show'} details
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedIssues.has(issue.id) && (
                <motion.div
                  className="mt-4 space-y-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {/* All Patterns/Findings */}
                  {(() => {
                    const uniquePatterns = Array.from(new Set(issue.instances.map(i => i.explanation)));
                    if (uniquePatterns.length > 1) {
                      return (
                        <div className="bg-[var(--color-navy-900)] rounded-lg p-3">
                          <p className="text-xs text-[var(--color-slate-400)] mb-2">All Findings ({uniquePatterns.length}):</p>
                          <div className="space-y-2">
                            {uniquePatterns.map((pattern, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="text-blue-400 font-semibold text-xs mt-0.5">{idx + 1}.</span>
                                <p className="text-xs text-[var(--color-slate-300)] flex-1">
                                  {pattern}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="bg-[var(--color-navy-900)] rounded-lg p-3">
                    <p className="text-xs text-[var(--color-slate-400)] mb-2">Affected Calls:</p>
                    <div className="flex flex-wrap gap-2">
                      {issue.affectedCallIds.map(callId => (
                        <button
                          key={callId}
                          className="px-2 py-1 bg-[var(--color-navy-700)] hover:bg-[var(--color-navy-600)] rounded text-xs font-mono text-[var(--color-slate-200)] transition-colors"
                          onClick={() => setSelectedCallId(callId)}
                        >
                          {callId}
                        </button>
                      ))}
                    </div>
                  </div>

                  {issue.evidenceSnippets.length > 0 && (
                    <div className="bg-[var(--color-navy-900)] rounded-lg p-3">
                      <p className="text-xs text-[var(--color-slate-400)] mb-2">Sample Evidence:</p>
                      <div className="space-y-2">
                        {issue.evidenceSnippets.map((snippet, idx) => (
                          <p key={idx} className="text-xs text-[var(--color-slate-300)] border-l-2 border-blue-500 pl-2">
                            {snippet}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
              </div>
            </div>
          )}

          {/* No Results Message */}
          {filteredAggregatedStandardIssues.length === 0 && filteredAggregatedCustomIssues.length === 0 && (
            <div className="p-8 text-center text-[var(--color-slate-400)]">
              No issues match your filters.
            </div>
          )}
        </div>
      )}

      {/* Detailed View */}
      {viewMode === 'detailed' && (
        <div className="space-y-6">
          {/* Standard Checks Section */}
          {filteredStandardIssues.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-[var(--color-navy-800)] border-b border-[var(--color-navy-700)]">
                <h4 className="text-sm font-semibold text-white">Standard Checks</h4>
              </div>
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
                    {filteredStandardIssues.map((issue, index) => (
                      <motion.tr
                        key={issue.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <td className="font-mono text-sm">{issue.callId}</td>
                        <td>
                          <span className="text-[var(--color-slate-200)]">
                            {getIssueTypeLabel(issue.type)}
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
            </div>
          )}

          {/* Custom Audits Section */}
          {filteredCustomIssues.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/30">
                <h4 className="text-sm font-semibold text-purple-300">Custom Audits</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Call ID</th>
                      <th>Issue Type</th>
                      <th>Severity</th>
                      <th>Confidence</th>
                      <th>Evidence</th>
                      <th>Source Check</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomIssues.map((issue, index) => (
                      <motion.tr
                        key={issue.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <td className="font-mono text-sm">{issue.callId}</td>
                        <td>
                          <span className="text-[var(--color-slate-200)]">
                            {getIssueTypeLabel(issue.type)}
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
                                className="h-full bg-purple-500 rounded-full"
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
                        <td className="text-xs text-purple-300">
                          {issue.sourceCheckName || 'Custom'}
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
            </div>
          )}

          {/* No Results Message */}
          {filteredStandardIssues.length === 0 && filteredCustomIssues.length === 0 && (
            <div className="p-8 text-center text-[var(--color-slate-400)]">
              No issues match your filters.
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
