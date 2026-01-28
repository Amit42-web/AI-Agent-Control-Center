'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  GraduationCap,
  Settings,
  Cpu,
  Target,
  CheckCircle,
  Code,
  Search,
  Copy,
  CheckCheck,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { FixType } from '@/types';

const fixTypeConfig: Record<FixType, { icon: any; color: string; label: string }> = {
  script: {
    icon: FileText,
    color: 'blue',
    label: 'Script/Prompt',
  },
  training: {
    icon: GraduationCap,
    color: 'green',
    label: 'Training',
  },
  process: {
    icon: Settings,
    color: 'purple',
    label: 'Process',
  },
  system: {
    icon: Cpu,
    color: 'orange',
    label: 'System',
  },
};

const rootCauseColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  knowledge: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', icon: '📚' },
  instruction: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', icon: '📋' },
  execution: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', icon: '⚠️' },
  conversation: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', icon: '💬' },
  model: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', icon: '🤖' },
};

export function EnhancedFixesList() {
  const { enhancedFixes } = useAppStore();
  const [fixTypeFilter, setFixTypeFilter] = useState<FixType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFixes, setExpandedFixes] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Proper null/undefined checks
  if (!enhancedFixes || !enhancedFixes.fixes || enhancedFixes.fixes.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-[var(--color-slate-400)]">No fixes available yet.</p>
      </div>
    );
  }

  const filteredFixes = enhancedFixes.fixes.filter((fix) => {
    if (fixTypeFilter !== 'all' && fix.fixType !== fixTypeFilter) return false;
    if (
      searchTerm &&
      !fix.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !fix.suggestedSolution.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedFixes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFixes(newExpanded);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        className="glass-card p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-slate-400)]" />
            <input
              type="text"
              className="input-field pl-10"
              placeholder="Search fixes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Fix Type Filter */}
          <select
            className="input-field w-auto"
            value={fixTypeFilter}
            onChange={(e) => setFixTypeFilter(e.target.value as FixType | 'all')}
          >
            <option value="all">All Types</option>
            {Object.entries(fixTypeConfig).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>

          <span className="text-sm text-[var(--color-slate-400)]">
            {filteredFixes.length} fix{filteredFixes.length !== 1 ? 'es' : ''}
          </span>
        </div>
      </motion.div>

      {/* Fixes List */}
      <div className="space-y-4">
        {filteredFixes.map((fix, index) => {
          const config = fixTypeConfig[fix.fixType] || {
            icon: FileText,
            color: 'blue',
            label: 'Unknown',
          };
          const Icon = config.icon;
          const isExpanded = expandedFixes.has(fix.id);

          // Static color mapping for Tailwind CSS
          const getColorClasses = (color: string) => {
            const colorMap: Record<string, { border: string; bg: string; bgLight: string; text: string }> = {
              blue: { border: 'border-blue-500', bg: 'bg-blue-500/5', bgLight: 'bg-blue-500/20', text: 'text-blue-400' },
              green: { border: 'border-green-500', bg: 'bg-green-500/5', bgLight: 'bg-green-500/20', text: 'text-green-400' },
              purple: { border: 'border-purple-500', bg: 'bg-purple-500/5', bgLight: 'bg-purple-500/20', text: 'text-purple-400' },
              orange: { border: 'border-orange-500', bg: 'bg-orange-500/5', bgLight: 'bg-orange-500/20', text: 'text-orange-400' },
            };
            return colorMap[color] || colorMap['blue'];
          };
          const colorClasses = getColorClasses(config.color);

          return (
            <motion.div
              key={fix.id}
              className="glass-card overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              {/* Header */}
              <div
                className={`p-4 border-l-4 ${colorClasses.border} ${colorClasses.bg} cursor-pointer`}
                onClick={() => toggleExpanded(fix.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className={`w-8 h-8 rounded-lg ${colorClasses.bgLight} flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${colorClasses.text}`} />
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${colorClasses.bgLight} ${colorClasses.text}`}>
                        {config.label}
                      </span>
                      {fix.rootCauseType && rootCauseColors[fix.rootCauseType] && (
                        <span className={`px-2.5 py-1 text-xs rounded-full ${rootCauseColors[fix.rootCauseType].bg} ${rootCauseColors[fix.rootCauseType].text} border ${rootCauseColors[fix.rootCauseType].border} font-medium`}>
                          {rootCauseColors[fix.rootCauseType].icon} {fix.rootCauseType}
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">
                      {fix.title}
                    </h4>
                    <p className="text-sm text-[var(--color-slate-300)]">
                      {fix.suggestedSolution}
                    </p>
                  </div>
                  <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    {isExpanded ? 'Hide' : 'Show'} details
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <motion.div
                  className="p-4 space-y-4 border-t border-[var(--color-navy-700)]"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {/* Root Cause */}
                  <div className="bg-[var(--color-navy-800)] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-orange-400" />
                      <p className="text-xs font-semibold text-orange-400">Root Cause:</p>
                    </div>
                    <p className="text-sm text-[var(--color-slate-300)]">
                      {fix.rootCause}
                    </p>
                  </div>

                  {/* Where to Implement */}
                  <div className="bg-[var(--color-navy-800)] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-blue-400" />
                      <p className="text-xs font-semibold text-blue-400">Where to Implement:</p>
                    </div>
                    <p className="text-sm text-[var(--color-slate-300)]">
                      {fix.whereToImplement}
                    </p>
                  </div>

                  {/* What to Implement */}
                  <div className="bg-[var(--color-navy-800)] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="w-4 h-4 text-green-400" />
                      <p className="text-xs font-semibold text-green-400">What to Implement:</p>
                    </div>
                    <p className="text-sm text-[var(--color-slate-300)] whitespace-pre-line">
                      {fix.whatToImplement}
                    </p>
                  </div>

                  {/* Concrete Example */}
                  <div className="bg-[var(--color-navy-800)] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-purple-400" />
                      <p className="text-xs font-semibold text-purple-400">Concrete Example:</p>
                    </div>
                    <p className="text-sm text-[var(--color-slate-300)] whitespace-pre-line font-mono">
                      {fix.concreteExample}
                    </p>
                  </div>

                  {/* Success Criteria */}
                  <div className="bg-[var(--color-navy-800)] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-cyan-400" />
                      <p className="text-xs font-semibold text-cyan-400">Success Criteria:</p>
                    </div>
                    <p className="text-sm text-[var(--color-slate-300)]">
                      {fix.successCriteria}
                    </p>
                  </div>

                  {/* Special Design (Prompt) Fix Section - COPY-PASTE READY */}
                  {fix.promptFix && (fix.rootCauseType === 'instruction' || fix.rootCauseType === 'execution' || fix.rootCauseType === 'conversation') && (
                    <div className="bg-gradient-to-r from-purple-500/10 to-transparent rounded-lg p-4 border-l-4 border-purple-500">
                      <div className="flex items-center gap-2 mb-3">
                        <Code className="w-5 h-5 text-purple-400" />
                        <p className="text-sm font-bold text-purple-400">
                          🔧 {fix.rootCauseType.toUpperCase()} FIX - Copy-Paste Ready
                        </p>
                      </div>

                      {/* Target and Action */}
                      <div className="mb-3 text-sm bg-[var(--color-navy-900)] rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-400 font-semibold">Target:</span>
                        </div>
                        <div className="ml-6">
                          <span className="text-white font-semibold">{fix.promptFix.targetSection}</span>
                          {fix.promptFix.lineNumber && (
                            <span className="text-[var(--color-slate-400)] ml-2">(Line {fix.promptFix.lineNumber})</span>
                          )}
                          <span className="ml-3 px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-300 font-bold">
                            {fix.promptFix.action.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Before/After for REPLACE */}
                      {fix.promptFix.action === 'replace' && fix.promptFix.beforeText && (
                        <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-red-400 mb-2 font-semibold flex items-center gap-1">
                              ❌ Remove This:
                            </p>
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                              <pre className="text-sm text-red-200 font-mono whitespace-pre-wrap line-through">
                                {fix.promptFix.beforeText}
                              </pre>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-green-400 mb-2 font-semibold flex items-center gap-1">
                              ✅ Replace With:
                            </p>
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                              <pre className="text-sm text-green-200 font-mono whitespace-pre-wrap">
                                {fix.promptFix.exactContent}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Exact Content with Copy Button - For ADD/REMOVE or as fallback */}
                      {(fix.promptFix.action === 'add' || fix.promptFix.action === 'remove' || !fix.promptFix.beforeText) && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-purple-400 font-semibold">
                              {fix.promptFix.action === 'add' && '✨ Content to Add:'}
                              {fix.promptFix.action === 'remove' && '🗑️ Content to Remove:'}
                              {fix.promptFix.action === 'replace' && '📝 Exact Content:'}
                            </p>
                            <button
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors text-purple-300 text-xs font-semibold"
                              onClick={() => copyToClipboard(fix.promptFix!.exactContent, fix.id)}
                            >
                              {copiedId === fix.id ? (
                                <>
                                  <CheckCheck className="w-4 h-4" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          <div className="bg-[var(--color-navy-900)] border border-purple-500/30 rounded-lg p-4 relative">
                            <pre className="text-sm text-[var(--color-slate-200)] font-mono whitespace-pre-wrap">
                              {fix.promptFix.exactContent}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Visual Diff if provided */}
                      {fix.promptFix.visualDiff && (
                        <div className="mt-3">
                          <p className="text-xs text-[var(--color-slate-400)] mb-2 font-semibold">
                            📊 Visual Diff:
                          </p>
                          <div className="bg-[var(--color-navy-900)] border border-[var(--color-navy-700)] rounded-lg p-3">
                            <pre className="text-xs text-[var(--color-slate-300)] font-mono whitespace-pre-wrap">
                              {fix.promptFix.visualDiff}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* How to Test */}
                  <div className="bg-[var(--color-navy-800)] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="w-4 h-4 text-yellow-400" />
                      <p className="text-xs font-semibold text-yellow-400">How to Test:</p>
                    </div>
                    <p className="text-sm text-[var(--color-slate-300)]">
                      {fix.howToTest}
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}

        {filteredFixes.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-[var(--color-slate-400)]">No fixes match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
