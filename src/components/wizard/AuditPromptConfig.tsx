'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, RotateCcw, Edit3, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { defaultAuditPrompt } from '@/data/defaultAuditPrompt';

export function AuditPromptConfig() {
  const { auditPrompt, setAuditPrompt } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  const handleReset = () => {
    if (confirm('Reset to default comprehensive audit prompt?')) {
      setAuditPrompt(defaultAuditPrompt);
    }
  };

  const isCustomized = auditPrompt !== defaultAuditPrompt;

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
            <h3 className="text-lg font-semibold text-white mb-1">
              Audit Instructions
            </h3>
            <p className="text-sm text-[var(--color-slate-400)]">
              Comprehensive evaluation criteria for open-ended analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCustomized && (
            <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Customized
            </span>
          )}
          <motion.button
            className="p-2 rounded-lg hover:bg-[var(--color-navy-700)] transition-colors"
            onClick={() => setShowFullPrompt(!showFullPrompt)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={showFullPrompt ? 'Hide full prompt' : 'Show full prompt'}
          >
            {showFullPrompt ? (
              <EyeOff className="w-4 h-4 text-[var(--color-slate-400)]" />
            ) : (
              <Eye className="w-4 h-4 text-[var(--color-slate-400)]" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Prompt Summary */}
      {!showFullPrompt && (
        <div className="bg-[var(--color-navy-800)] rounded-lg p-4 mb-4">
          <p className="text-sm text-[var(--color-slate-300)] mb-3">
            <span className="font-semibold text-purple-400">Default comprehensive audit includes:</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[var(--color-slate-400)]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
              <span>Conversation Control Failures</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
              <span>Temporal & Turn-Taking Issues</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
              <span>Intent & State Drift</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
              <span>Language & Human-Likeness Erosion</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
              <span>Evaluation Bias Traps</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
              <span>Communication & Resolution Quality</span>
            </div>
          </div>
        </div>
      )}

      {/* Full Prompt Display/Edit */}
      <AnimatePresence>
        {showFullPrompt && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            {isEditing ? (
              <textarea
                value={auditPrompt}
                onChange={(e) => setAuditPrompt(e.target.value)}
                className="w-full h-96 px-4 py-3 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-sm text-[var(--color-slate-200)] font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder="Enter your custom audit instructions..."
              />
            ) : (
              <div className="bg-[var(--color-navy-800)] rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-xs text-[var(--color-slate-300)] whitespace-pre-wrap font-mono leading-relaxed">
                  {auditPrompt}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.button
            className="btn-secondary text-sm flex items-center gap-2"
            onClick={() => setIsEditing(!isEditing)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Edit3 className="w-4 h-4" />
            {isEditing ? 'Stop Editing' : 'Customize Prompt'}
          </motion.button>

          {isCustomized && (
            <motion.button
              className="btn-secondary text-sm flex items-center gap-2"
              onClick={handleReset}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Default
            </motion.button>
          )}
        </div>

        <div className="text-xs text-[var(--color-slate-400)]">
          {auditPrompt.length} characters
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <p className="text-xs text-[var(--color-slate-300)] leading-relaxed">
          <span className="font-semibold text-purple-400">💡 Tip:</span>{' '}
          The default prompt covers comprehensive quality dimensions. You can customize it to:
          add domain-specific criteria, emphasize certain aspects, or go completely open-ended
          for maximum flexibility.
        </p>
      </div>
    </motion.div>
  );
}
