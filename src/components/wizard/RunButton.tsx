'use client';

import { motion } from 'framer-motion';
import { Play, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export function RunButton() {
  const { isRunning, runProgress, transcripts, checks, runAnalysis } = useAppStore();

  const enabledChecks = checks.filter((c) => c.enabled);
  const canRun = transcripts.length > 0 && enabledChecks.length > 0;

  return (
    <motion.div
      className="glass-card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      {isRunning ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-white font-medium">Running Analysis...</span>
            </div>
            <span className="text-[var(--color-slate-400)] text-sm">
              {runProgress}%
            </span>
          </div>
          <div className="progress-bar">
            <motion.div
              className="progress-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${runProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-[var(--color-slate-400)]">
            Analyzing {transcripts.length} call{transcripts.length !== 1 ? 's' : ''} with{' '}
            {enabledChecks.length} check{enabledChecks.length !== 1 ? 's' : ''}...
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold mb-1">Ready to Run</h3>
            <p className="text-sm text-[var(--color-slate-400)]">
              {transcripts.length} call{transcripts.length !== 1 ? 's' : ''},{' '}
              {enabledChecks.length} check{enabledChecks.length !== 1 ? 's' : ''} enabled
            </p>
          </div>
          <button
            className="btn-primary flex items-center gap-2 text-lg px-8"
            onClick={runAnalysis}
            disabled={!canRun}
          >
            <Play className="w-5 h-5" />
            Run Analysis
          </button>
        </div>
      )}

      {!canRun && !isRunning && (
        <p className="text-xs text-rose-400 mt-3">
          Please load at least one transcript and enable at least one check.
        </p>
      )}
    </motion.div>
  );
}
