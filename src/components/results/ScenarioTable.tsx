'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Severity } from '@/types';

const severityClasses: Record<Severity, string> = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
};

export function ScenarioTable() {
  const { scenarioResults, setSelectedCallId } = useAppStore();
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());

  if (!scenarioResults) return null;

  const filteredScenarios = scenarioResults.scenarios.filter((scenario) => {
    if (severityFilter !== 'all' && scenario.severity !== severityFilter) return false;
    if (
      searchTerm &&
      !scenario.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !scenario.context.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !scenario.callId.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedScenarios);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedScenarios(newExpanded);
  };

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-purple-500/30 bg-purple-500/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold mb-1">Identified Scenarios</h3>
            <p className="text-sm text-[var(--color-slate-400)]">
              Holistic evaluation of agent performance and improvement opportunities
            </p>
          </div>
          <span className="text-sm text-[var(--color-slate-400)]">
            {filteredScenarios.length} scenario{filteredScenarios.length !== 1 ? 's' : ''}
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
              placeholder="Search scenarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Severity Filter */}
          <select
            className="input-field w-auto"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as Severity | 'all')}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Scenarios List */}
      <div className="divide-y divide-[var(--color-navy-700)]">
        {filteredScenarios.map((scenario, index) => (
          <motion.div
            key={scenario.id}
            className="p-4 hover:bg-[var(--color-navy-800)] transition-colors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {/* Header Row */}
                <div className="flex items-center gap-3 mb-2">
                  <span className={`badge ${severityClasses[scenario.severity]}`}>
                    {scenario.severity}
                  </span>
                  <span className="text-xs text-[var(--color-slate-400)]">
                    Confidence: {scenario.confidence}%
                  </span>
                  <button
                    className="px-2 py-1 text-xs bg-[var(--color-navy-700)] hover:bg-[var(--color-navy-600)] rounded font-mono text-[var(--color-slate-200)] transition-colors"
                    onClick={() => setSelectedCallId(scenario.callId)}
                  >
                    {scenario.callId}
                  </button>
                </div>

                {/* Title */}
                <h4 className="text-lg font-semibold text-purple-300 mb-2">
                  {scenario.title}
                </h4>

                {/* Context */}
                <div className="flex items-start gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[var(--color-slate-300)]">
                    <span className="text-[var(--color-slate-400)]">Context:</span> {scenario.context}
                  </p>
                </div>

                {/* Toggle Details */}
                <button
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                  onClick={() => toggleExpanded(scenario.id)}
                >
                  {expandedScenarios.has(scenario.id) ? 'Hide' : 'Show'} full details
                </button>

                {/* Expanded Details */}
                {expandedScenarios.has(scenario.id) && (
                  <motion.div
                    className="mt-4 space-y-3"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {/* What Happened */}
                    <div className="bg-[var(--color-navy-900)] rounded-lg p-3 border-l-2 border-orange-500">
                      <p className="text-xs font-semibold text-orange-400 mb-1">What Happened:</p>
                      <p className="text-sm text-[var(--color-slate-300)]">
                        {scenario.whatHappened}
                      </p>
                    </div>

                    {/* Impact */}
                    <div className="bg-[var(--color-navy-900)] rounded-lg p-3 border-l-2 border-red-500">
                      <p className="text-xs font-semibold text-red-400 mb-1">Impact:</p>
                      <p className="text-sm text-[var(--color-slate-300)]">
                        {scenario.impact}
                      </p>
                    </div>

                    {/* Evidence */}
                    <div className="bg-[var(--color-navy-900)] rounded-lg p-3 border-l-2 border-blue-500">
                      <p className="text-xs font-semibold text-blue-400 mb-1">
                        Evidence (Lines {scenario.lineNumbers.join(', ')}):
                      </p>
                      <p className="text-sm text-[var(--color-slate-300)] font-mono">
                        {scenario.evidenceSnippet}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {filteredScenarios.length === 0 && (
          <div className="p-8 text-center text-[var(--color-slate-400)]">
            No scenarios match your filters.
          </div>
        )}
      </div>
    </motion.div>
  );
}
