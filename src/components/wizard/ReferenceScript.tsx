'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, RotateCcw, ChevronDown, ChevronUp, SkipForward } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { defaultReferenceScript } from '@/data/demoData';

export function ReferenceScript() {
  const {
    referenceScript,
    referenceEnabled,
    setReferenceScript,
    setReferenceEnabled,
  } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const resetToDefault = () => {
    setReferenceScript(defaultReferenceScript);
  };

  return (
    <motion.div
      className={`glass-card overflow-hidden transition-opacity ${
        !referenceEnabled ? 'opacity-60' : ''
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-[var(--color-navy-700)] cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Reference Script</h3>
            <p className="text-xs text-[var(--color-slate-400)]">
              {referenceEnabled ? 'Enabled' : 'Skipped'} - Optional
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Enable/Skip Toggle */}
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-[var(--color-slate-400)]">
              {referenceEnabled ? 'Enabled' : 'Skipped'}
            </span>
            <button
              className={`toggle-switch ${referenceEnabled ? 'active' : ''}`}
              onClick={() => setReferenceEnabled(!referenceEnabled)}
            />
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[var(--color-slate-400)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--color-slate-400)]" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <motion.div
          className="p-4 space-y-4"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
        >
          {!referenceEnabled ? (
            <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <SkipForward className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm text-amber-300">Reference Script Skipped</p>
                <p className="text-xs text-[var(--color-slate-400)]">
                  Flow Compliance check will be automatically disabled
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--color-slate-300)]">
                  Expected conversation flow / script
                </label>
                <button
                  onClick={resetToDefault}
                  className="btn-secondary flex items-center gap-2 text-sm py-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>
              <textarea
                className="textarea-field"
                value={referenceScript}
                onChange={(e) => setReferenceScript(e.target.value)}
                placeholder="Enter your expected call flow or script..."
                rows={10}
              />
              <p className="text-xs text-[var(--color-slate-400)]">
                This script defines the expected flow for Flow Compliance checking.
                Use markdown format with numbered steps.
              </p>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
