'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ChevronDown, ChevronUp, Target, MapPin, MessageSquare } from 'lucide-react';
import { Fix } from '@/types';

interface FixCardProps {
  fix: Fix;
  index: number;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function FixCard({ fix, index, isSelected = false, onToggleSelect }: FixCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAll = () => {
    // Only copy suggestion, not the example
    copyToClipboard(fix.suggestion, 'all');
  };

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              className="w-5 h-5 rounded border-2 border-[var(--color-navy-600)] bg-[var(--color-navy-800)] checked:bg-blue-500 checked:border-blue-500 cursor-pointer"
            />
          )}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
            {index + 1}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-white text-sm">{fix.problem}</h4>
              <span className={`text-xs px-2 py-0.5 rounded ${
                fix.action === 'remove' ? 'bg-red-500/20 text-red-400' :
                fix.action === 'replace' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {fix.action === 'remove' ? 'Remove' : fix.action === 'replace' ? 'Replace' : 'Add'}
              </span>
            </div>
            <p className="text-xs text-[var(--color-slate-400)] mt-0.5">
              {fix.relatedIssueIds.length} related issue{fix.relatedIssueIds.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-[var(--color-slate-400)]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[var(--color-slate-400)]" />
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <motion.div
          className="px-4 pb-4 space-y-4"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
        >
          {/* Copy All Button */}
          <div className="flex justify-end">
            <button
              className="btn-primary flex items-center gap-2 text-xs py-1.5 px-3"
              onClick={(e) => {
                e.stopPropagation();
                copyAll();
              }}
            >
              {copiedField === 'all' ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy All
                </>
              )}
            </button>
          </div>

          {/* Target Content (for remove/replace) */}
          {fix.action && (fix.action === 'remove' || fix.action === 'replace') && fix.targetContent && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-red-400" />
                <span className="text-xs font-medium text-[var(--color-slate-300)]">
                  {fix.action === 'remove' ? 'Content to Remove' : 'Content to Replace'}
                </span>
              </div>
              <div className="glass-card-subtle p-3 bg-red-500/10 border border-red-500/30">
                <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono line-through">
                  {fix.targetContent}
                </pre>
              </div>
            </div>
          )}

          {/* Suggestion (for add/replace) */}
          {fix.action !== 'remove' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-[var(--color-slate-300)]">
                  {fix.action === 'replace' ? 'Replacement Content' : 'Suggested Fix'}
                </span>
              </div>
              <div className="glass-card-subtle p-3 relative group bg-[var(--color-navy-900)] border border-[var(--color-navy-700)]">
                <pre className="text-sm text-[var(--color-slate-200)] pr-8 whitespace-pre-wrap font-mono">
                  {fix.suggestion}
                </pre>
                <button
                  className="absolute top-2 right-2 p-1.5 hover:bg-[var(--color-navy-600)] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(fix.suggestion, 'suggestion');
                  }}
                >
                  {copiedField === 'suggestion' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-[var(--color-slate-400)]" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Placement Hint */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-[var(--color-slate-300)]">
                Where to Add
              </span>
            </div>
            <div className="glass-card-subtle p-3">
              <p className="text-sm text-[var(--color-slate-400)]">
                {fix.placementHint}
              </p>
            </div>
          </div>

          {/* Example Response */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-medium text-[var(--color-slate-300)]">
                Example Response
              </span>
            </div>
            <div className="glass-card-subtle p-3 relative group border-l-2 border-teal-500 bg-[var(--color-navy-900)]">
              <pre className="text-sm text-teal-300 italic pr-8 whitespace-pre-wrap font-mono">
                {fix.exampleResponse}
              </pre>
              <button
                className="absolute top-2 right-2 p-1.5 hover:bg-[var(--color-navy-600)] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(fix.exampleResponse, 'example');
                }}
              >
                {copiedField === 'example' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-[var(--color-slate-400)]" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
