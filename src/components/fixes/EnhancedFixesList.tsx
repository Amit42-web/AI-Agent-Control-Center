'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Download,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { EnhancedFixCard } from './EnhancedFixCard';
import { FixType, RootCauseType } from '@/types';

const fixTypeLabels: Record<FixType, string> = {
  script: 'Script/Prompt',
  training: 'Training',
  process: 'Process',
  system: 'System',
};

const rootCauseLabels: Record<RootCauseType, string> = {
  knowledge: '📚 Knowledge Gap',
  instruction: '📋 Instruction Gap',
  execution: '⚠️ Execution Failure',
  conversation: '💬 Conversation Design',
  model: '🤖 Model Limitation',
};

export function EnhancedFixesList() {
  const { enhancedFixes } = useAppStore();
  const [fixTypeFilter, setFixTypeFilter] = useState<FixType | 'all'>('all');
  const [rcaFilter, setRcaFilter] = useState<RootCauseType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
    if (rcaFilter !== 'all' && fix.rootCauseType !== rcaFilter) return false;
    if (
      searchTerm &&
      !fix.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !fix.suggestedSolution?.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

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
            {Object.entries(fixTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* RCA Category Filter */}
          <select
            className="input-field w-auto"
            value={rcaFilter}
            onChange={(e) => setRcaFilter(e.target.value as RootCauseType | 'all')}
          >
            <option value="all">All Categories</option>
            {Object.entries(rootCauseLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
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
        {filteredFixes.map((fix, index) => (
          <EnhancedFixCard
            key={fix.id}
            fix={fix}
            index={index}
          />
        ))}
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            const content = {
              enhancedFixes: enhancedFixes.fixes,
              exportedAt: new Date().toISOString(),
            };
            const blob = new Blob([JSON.stringify(content, null, 2)], {
              type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'rca_categorized_fixes.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export Fixes
        </button>
      </div>
    </div>
  );
}
