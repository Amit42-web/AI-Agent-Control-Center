'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp, RotateCcw, Lock, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { DimensionPrompt } from '@/types';

const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/30' },
  cyan:   { bg: 'bg-cyan-500/20',   text: 'text-cyan-300',   border: 'border-cyan-500/30' },
  green:  { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/30' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' },
  pink:   { bg: 'bg-pink-500/20',   text: 'text-pink-300',   border: 'border-pink-500/30' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
};

export function AuditPromptConfig() {
  const { dimensionPrompts, updateDimensionPrompt, resetDimensionPrompt, toggleDimensionPrompt } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const enabledCount = dimensionPrompts.filter((d: DimensionPrompt) => d.enabled).length;

  return (
    <motion.div
      className="glass-card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Audit Dimensions</h3>
            <p className="text-sm text-[var(--color-slate-400)]">
              {enabledCount} of {dimensionPrompts.length} dimensions active
            </p>
          </div>
        </div>
      </div>

      {/* System prompt info banner */}
      <div className="flex items-start gap-3 p-3 mb-5 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg">
        <Lock className="w-4 h-4 text-[var(--color-slate-500)] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--color-slate-400)] leading-relaxed">
          <span className="font-medium text-[var(--color-slate-300)]">System rules are managed automatically</span> — evidence gates, materiality thresholds, root cause classification, severity definitions, and output format are fixed. Edit only the evaluation criteria per dimension below.
        </p>
      </div>

      {/* Dimension accordions */}
      <div className="space-y-2">
        {dimensionPrompts.map((dim: DimensionPrompt) => {
          const colors = BADGE_COLORS[dim.color] || BADGE_COLORS.blue;
          const isExpanded = expandedId === dim.id;
          const isModified = dim.prompt !== dim.defaultPrompt;

          return (
            <div
              key={dim.id}
              className={`rounded-lg border transition-colors ${
                dim.enabled
                  ? 'border-[var(--color-navy-600)] bg-[var(--color-navy-800)]'
                  : 'border-[var(--color-navy-700)] bg-[var(--color-navy-900)] opacity-60'
              }`}
            >
              {/* Accordion header */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Letter badge */}
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border ${colors.bg} ${colors.text} ${colors.border}`}>
                  {dim.id}
                </span>

                {/* Label — clickable to expand */}
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => setExpandedId(isExpanded ? null : dim.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${dim.enabled ? 'text-white' : 'text-[var(--color-slate-500)]'}`}>
                      {dim.label}
                    </span>
                    {isModified && dim.enabled && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Modified
                      </span>
                    )}
                  </div>
                  {dim.tags && dim.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {dim.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-xs px-1.5 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border} opacity-80`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>

                {/* Enable toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleDimensionPrompt(dim.id); }}
                  className="p-1 rounded hover:bg-[var(--color-navy-700)] transition-colors"
                  title={dim.enabled ? 'Disable this dimension' : 'Enable this dimension'}
                >
                  {dim.enabled
                    ? <ToggleRight className="w-5 h-5 text-blue-400" />
                    : <ToggleLeft className="w-5 h-5 text-[var(--color-slate-600)]" />
                  }
                </button>

                {/* Expand chevron */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : dim.id)}
                  className="p-1 rounded hover:bg-[var(--color-navy-700)] transition-colors"
                >
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-[var(--color-slate-400)]" />
                    : <ChevronDown className="w-4 h-4 text-[var(--color-slate-400)]" />
                  }
                </button>
              </div>

              {/* Expanded content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t border-[var(--color-navy-700)] pt-3">
                      <textarea
                        value={dim.prompt}
                        onChange={(e) => updateDimensionPrompt(dim.id, e.target.value)}
                        disabled={!dim.enabled}
                        rows={12}
                        className="w-full px-3 py-2.5 bg-[var(--color-navy-900)] border border-[var(--color-navy-600)] rounded-lg text-sm text-[var(--color-slate-200)] font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y disabled:opacity-40 disabled:cursor-not-allowed leading-relaxed"
                        placeholder="Enter evaluation criteria for this dimension..."
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-[var(--color-slate-500)]">
                          {dim.prompt.length} characters
                        </span>
                        {isModified && (
                          <button
                            onClick={() => resetDimensionPrompt(dim.id)}
                            className="flex items-center gap-1.5 text-xs text-[var(--color-slate-400)] hover:text-white transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reset to default
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {enabledCount === 0 && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-xs text-red-400">
            No dimensions are enabled. Enable at least one dimension before running the analysis.
          </p>
        </div>
      )}
    </motion.div>
  );
}
