'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ChevronDown, ChevronUp, Target, MapPin, MessageSquare } from 'lucide-react';
import { Fix } from '@/types';

interface FixCardProps {
  fix: Fix;
  index: number;
}

export function FixCard({ fix, index }: FixCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
            {index + 1}
          </div>
          <div>
            <h4 className="font-medium text-white text-sm">{fix.problem}</h4>
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
          {/* Suggestion */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-[var(--color-slate-300)]">
                Suggested Fix
              </span>
            </div>
            <div className="glass-card-subtle p-3 relative group">
              <p className="text-sm text-[var(--color-slate-200)] pr-8">
                {fix.suggestion}
              </p>
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
            <div className="glass-card-subtle p-3 relative group border-l-2 border-teal-500">
              <p className="text-sm text-teal-300 italic pr-8">
                {fix.exampleResponse}
              </p>
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
