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

export function EnhancedFixesList() {
  const { enhancedFixes } = useAppStore();
  const [fixTypeFilter, setFixTypeFilter] = useState<FixType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFixes, setExpandedFixes] = useState<Set<string>>(new Set());

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
          const config = fixTypeConfig[fix.fixType];
          const Icon = config.icon;
          const isExpanded = expandedFixes.has(fix.id);

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
                className={`p-4 border-l-4 border-${config.color}-500 bg-${config.color}-500/5 cursor-pointer`}
                onClick={() => toggleExpanded(fix.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-lg bg-${config.color}-500/20 flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 text-${config.color}-400`} />
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded bg-${config.color}-500/20 text-${config.color}-400`}>
                        {config.label}
                      </span>
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
