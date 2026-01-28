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

const rootCauseColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  prompt: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', icon: '📝' },
  flow: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', icon: '🔄' },
  training: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', icon: '🎓' },
  process: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', icon: '⚙️' },
  system: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', icon: '💻' },
  knowledge: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', icon: '📚' },
};

export function ScenarioTable() {
  const { scenarioResults, transcripts, setSelectedCallId, setSelectedIssueId, selectedDimension, setSelectedDimension } = useAppStore();
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());

  if (!scenarioResults) return null;

  // Helper to get transcript lines for a scenario
  const getTranscriptLines = (callId: string, lineNumbers: number[]) => {
    const transcript = transcripts.find(t => t.id === callId);
    if (!transcript || !lineNumbers || lineNumbers.length === 0) return [];

    return lineNumbers.map(lineNum => {
      const line = transcript.lines[lineNum - 1]; // lineNumbers are 1-indexed
      if (!line) return null;
      return {
        lineNumber: lineNum,
        speaker: line.speaker,
        text: line.text,
        timestamp: line.timestamp
      };
    }).filter(Boolean);
  };

  const filteredScenarios = scenarioResults.scenarios.filter((scenario) => {
    if (severityFilter !== 'all' && scenario.severity !== severityFilter) return false;
    if (selectedDimension && scenario.dimension !== selectedDimension) return false;
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

        {/* Active Dimension Filter */}
        {selectedDimension && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-[var(--color-slate-400)]">Filtered by dimension:</span>
            <button
              onClick={() => setSelectedDimension(null)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors text-purple-300 text-sm border border-purple-500/30"
            >
              <span>📊 {selectedDimension}</span>
              <span className="text-xs hover:text-white transition-colors">✕</span>
            </button>
          </div>
        )}
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
                {/* Header Row with Badges */}
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <span className={`badge ${severityClasses[scenario.severity]}`}>
                    {scenario.severity}
                  </span>
                  {scenario.dimension && (
                    <span className="px-2.5 py-1 text-xs rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                      {scenario.dimension}
                    </span>
                  )}
                  {scenario.rootCauseType && rootCauseColors[scenario.rootCauseType] && (
                    <span className={`px-2.5 py-1 text-xs rounded-full ${rootCauseColors[scenario.rootCauseType].bg} ${rootCauseColors[scenario.rootCauseType].text} border ${rootCauseColors[scenario.rootCauseType].border} font-medium`}>
                      {rootCauseColors[scenario.rootCauseType].icon} {scenario.rootCauseType}
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-slate-400)] ml-auto">
                    {scenario.confidence}% confidence
                  </span>
                  <button
                    className="px-2.5 py-1 text-xs bg-[var(--color-navy-700)] hover:bg-[var(--color-navy-600)] rounded font-mono text-[var(--color-slate-200)] transition-colors"
                    onClick={() => {
                      setSelectedCallId(scenario.callId);
                      setSelectedIssueId(null);
                    }}
                  >
                    {scenario.callId}
                  </button>
                </div>

                {/* Title - More Prominent */}
                <h4 className="text-xl font-bold text-white mb-3 leading-tight">
                  {scenario.title}
                </h4>

                {/* Context - More Visual */}
                <div className="bg-[var(--color-navy-800)] rounded-lg p-3 mb-3 border-l-3 border-blue-500">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-400 mb-1">Context</p>
                      <p className="text-sm text-[var(--color-slate-200)] leading-relaxed">
                        {scenario.context}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Preview of Impact */}
                <div className="mb-3">
                  <p className="text-sm text-[var(--color-slate-300)] leading-relaxed">
                    <span className="font-semibold text-orange-400">Impact:</span> {scenario.impact}
                  </p>
                </div>

                {/* Toggle Details - More Prominent */}
                <button
                  className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-purple-500/10"
                  onClick={() => toggleExpanded(scenario.id)}
                >
                  {expandedScenarios.has(scenario.id) ? (
                    <>
                      <span>Hide full details</span>
                      <span className="text-xs">▲</span>
                    </>
                  ) : (
                    <>
                      <span>View complete analysis with transcript evidence</span>
                      <span className="text-xs">▼</span>
                    </>
                  )}
                </button>

                {/* Expanded Details */}
                {expandedScenarios.has(scenario.id) && (
                  <motion.div
                    className="mt-4 space-y-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {/* What Happened - Detailed Analysis */}
                    <div className="bg-gradient-to-r from-orange-500/10 to-transparent rounded-lg p-4 border-l-3 border-orange-500">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                        <p className="text-sm font-bold text-orange-400">What Happened</p>
                      </div>
                      <p className="text-sm text-[var(--color-slate-200)] leading-relaxed">
                        {scenario.whatHappened}
                      </p>
                    </div>

                    {/* Impact - Business & Customer Effect */}
                    <div className="bg-gradient-to-r from-red-500/10 to-transparent rounded-lg p-4 border-l-3 border-red-500">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <p className="text-sm font-bold text-red-400">Customer & Business Impact</p>
                      </div>
                      <p className="text-sm text-[var(--color-slate-200)] leading-relaxed">
                        {scenario.impact}
                      </p>
                    </div>

                    {/* Evidence - Actual Transcript with Better Styling */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-transparent rounded-lg p-4 border-l-3 border-blue-500">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="w-4 h-4 text-blue-400" />
                        <p className="text-sm font-bold text-blue-400">
                          Transcript Evidence
                        </p>
                        <span className="text-xs text-[var(--color-slate-400)] ml-auto">
                          Lines {scenario.lineNumbers.join(', ')}
                        </span>
                      </div>
                      <div className="space-y-2 bg-[var(--color-navy-900)] rounded-lg p-3">
                        {getTranscriptLines(scenario.callId, scenario.lineNumbers).map((line: any, idx: number) => (
                          <div key={idx} className="text-sm border-l-2 border-[var(--color-navy-700)] pl-3 py-1">
                            <div className="flex items-start gap-3">
                              <span className="text-[var(--color-slate-500)] font-mono text-xs flex-shrink-0 min-w-[50px]">
                                [{line.lineNumber}]
                                {line.timestamp && (
                                  <span className="block text-[10px] text-[var(--color-slate-600)] mt-0.5">
                                    {line.timestamp}
                                  </span>
                                )}
                              </span>
                              <div className="flex-1">
                                <span className={`font-bold text-xs ${line.speaker === 'agent' ? 'text-blue-400' : 'text-green-400'}`}>
                                  {line.speaker.toUpperCase()}
                                </span>
                                <p className="text-[var(--color-slate-200)] mt-1 leading-relaxed">
                                  {line.text}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {scenario.lineNumbers.length === 0 && (
                          <p className="text-xs text-[var(--color-slate-500)] italic text-center py-2">
                            No specific lines identified for this scenario
                          </p>
                        )}
                      </div>
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
