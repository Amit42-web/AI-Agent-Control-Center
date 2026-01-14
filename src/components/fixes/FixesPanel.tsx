'use client';

import { motion } from 'framer-motion';
import { BookOpen, Sparkles, Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { FixCard } from './FixCard';

export function FixesPanel() {
  const { fixes, referenceEnabled } = useAppStore();

  if (!fixes) return null;

  const exportFixes = () => {
    const content = {
      scriptFixes: fixes.scriptFixes,
      generalFixes: fixes.generalFixes,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(content, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fix_suggestions.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasScriptFixes = fixes.scriptFixes.length > 0;
  const hasGeneralFixes = fixes.generalFixes.length > 0;
  const totalFixes = fixes.scriptFixes.length + fixes.generalFixes.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h2 className="text-2xl font-bold text-white">Fix Suggestions</h2>
          <p className="text-[var(--color-slate-400)] mt-1">
            {totalFixes} actionable fix{totalFixes !== 1 ? 'es' : ''} based on detected issues
          </p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={exportFixes}>
          <Download className="w-4 h-4" />
          Export Fixes
        </button>
      </motion.div>

      {/* Script/Prompt Fixes (Reference-aware) */}
      {referenceEnabled && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Script/Prompt Fixes
              </h3>
              <p className="text-sm text-[var(--color-slate-400)]">
                Reference-aware improvements based on Flow Compliance check
              </p>
            </div>
          </div>

          {hasScriptFixes ? (
            <div className="space-y-4">
              {fixes.scriptFixes.map((fix, index) => (
                <FixCard key={fix.id} fix={fix} index={index} />
              ))}
            </div>
          ) : (
            <div className="glass-card p-6 text-center">
              <p className="text-[var(--color-slate-400)]">
                No script-specific fixes needed. Flow compliance looks good!
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* General Quality Fixes (Transcript-only) */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              General Quality Fixes
            </h3>
            <p className="text-sm text-[var(--color-slate-400)]">
              Transcript-only improvements (no reference script required)
            </p>
          </div>
        </div>

        {hasGeneralFixes ? (
          <div className="space-y-4">
            {fixes.generalFixes.map((fix, index) => (
              <FixCard
                key={fix.id}
                fix={fix}
                index={fixes.scriptFixes.length + index}
              />
            ))}
          </div>
        ) : (
          <div className="glass-card p-6 text-center">
            <p className="text-[var(--color-slate-400)]">
              No general quality fixes needed. Transcript quality looks good!
            </p>
          </div>
        )}
      </motion.div>

      {/* No fixes at all */}
      {!hasScriptFixes && !hasGeneralFixes && (
        <motion.div
          className="glass-card p-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No Fixes Required
          </h3>
          <p className="text-[var(--color-slate-400)]">
            Based on the enabled checks, no significant issues were found that require fixes.
          </p>
        </motion.div>
      )}
    </div>
  );
}
