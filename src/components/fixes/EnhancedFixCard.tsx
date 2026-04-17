'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ChevronDown, ChevronUp, Target, MapPin, Code, CheckCircle, FlaskConical, Lightbulb, AlertCircle } from 'lucide-react';
import { EnhancedFix } from '@/types';

const rootCauseColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  knowledge: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', icon: '📚' },
  instruction: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', icon: '📋' },
  execution: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', icon: '⚠️' },
  conversation: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', icon: '💬' },
  model: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', icon: '🤖' },
};

const fixTypeColors: Record<string, { bg: string; text: string }> = {
  script: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  training: { bg: 'bg-green-500/20', text: 'text-green-400' },
  process: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  system: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

interface EnhancedFixCardProps {
  fix: EnhancedFix;
  index: number;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function EnhancedFixCard({ fix, index, isSelected = false, onToggleSelect }: EnhancedFixCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAll = () => {
    const allContent = `
Title: ${fix.title}

Root Cause: ${fix.rootCause}

Suggested Solution: ${fix.suggestedSolution}

Where to Implement: ${fix.whereToImplement}

What to Implement: ${fix.whatToImplement}

Concrete Example: ${fix.concreteExample}

Success Criteria: ${fix.successCriteria}

How to Test: ${fix.howToTest}
${fix.promptFix ? `\nPrompt Fix:\nAction: ${fix.promptFix.action}\nTarget Section: ${fix.promptFix.targetSection}\nExact Content:\n${fix.promptFix.exactContent}` : ''}
    `.trim();
    copyToClipboard(allContent, 'all');
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
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1">
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
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-semibold text-white text-base">{fix.title}</h4>
              {fix.fixType && fixTypeColors[fix.fixType] && (
                <span className={`text-xs px-2 py-0.5 rounded ${fixTypeColors[fix.fixType].bg} ${fixTypeColors[fix.fixType].text} font-medium`}>
                  {fix.fixType}
                </span>
              )}
              {fix.rootCauseType && rootCauseColors[fix.rootCauseType] && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${rootCauseColors[fix.rootCauseType].bg} ${rootCauseColors[fix.rootCauseType].text} border ${rootCauseColors[fix.rootCauseType].border} font-medium`}>
                  {rootCauseColors[fix.rootCauseType].icon} {fix.rootCauseType}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-slate-400)]">
              Category-level fix addressing multiple scenarios
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-[var(--color-slate-400)] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[var(--color-slate-400)] flex-shrink-0" />
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

          {/* Root Cause Section */}
          {fix.rootCause && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-[var(--color-slate-300)]">
                  Root Cause Analysis
                </span>
              </div>
              <div className="glass-card-subtle p-3 border-l-2 border-amber-500 bg-amber-500/5">
                <p className="text-sm text-[var(--color-slate-200)]">
                  {fix.rootCause}
                </p>
              </div>
            </div>
          )}

          {/* Suggested Solution */}
          {fix.suggestedSolution && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-[var(--color-slate-300)]">
                  Suggested Solution
                </span>
              </div>
              <div className="glass-card-subtle p-3 border-l-2 border-blue-500 bg-blue-500/5">
                <p className="text-sm text-[var(--color-slate-200)]">
                  {fix.suggestedSolution}
                </p>
              </div>
            </div>
          )}

          {/* Where to Implement */}
          {fix.whereToImplement && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-[var(--color-slate-300)]">
                  Where to Implement
                </span>
              </div>
              <div className="glass-card-subtle p-3 border-l-2 border-purple-500 bg-purple-500/5">
                <p className="text-sm text-[var(--color-slate-200)]">
                  {fix.whereToImplement}
                </p>
              </div>
            </div>
          )}

          {/* What to Implement */}
          {fix.whatToImplement && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-green-400" />
                <span className="text-xs font-medium text-[var(--color-slate-300)]">
                  What to Implement
                </span>
              </div>
              <div className="glass-card-subtle p-3 border-l-2 border-green-500 bg-green-500/5">
                <pre className="text-sm text-[var(--color-slate-200)] whitespace-pre-wrap font-mono">
                  {fix.whatToImplement}
                </pre>
              </div>
            </div>
          )}

          {/* Prompt Fix (if available) */}
          {fix.promptFix && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-medium text-[var(--color-slate-300)]">
                  Exact Prompt Implementation
                </span>
              </div>
              <div className="glass-card-subtle p-3 border-l-2 border-cyan-500 bg-cyan-500/5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-medium">
                      {fix.promptFix.action}
                    </span>
                    <span className="text-xs text-[var(--color-slate-400)]">
                      Section: {fix.promptFix.targetSection}
                    </span>
                  </div>
                  <pre className="text-sm text-[var(--color-slate-200)] whitespace-pre-wrap font-mono bg-black/20 p-2 rounded">
                    {fix.promptFix.exactContent}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Concrete Example */}
          {fix.concreteExample && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-pink-400" />
                <span className="text-xs font-medium text-[var(--color-slate-300)]">
                  Concrete Example
                </span>
              </div>
              <div className="glass-card-subtle p-3 border-l-2 border-pink-500 bg-pink-500/5">
                <pre className="text-sm text-[var(--color-slate-200)] whitespace-pre-wrap">
                  {fix.concreteExample}
                </pre>
              </div>
            </div>
          )}

          {/* Success Criteria */}
          {fix.successCriteria && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs font-medium text-[var(--color-slate-300)]">
                  Success Criteria
                </span>
              </div>
              <div className="glass-card-subtle p-3 border-l-2 border-green-500 bg-green-500/5">
                <p className="text-sm text-[var(--color-slate-200)]">
                  {fix.successCriteria}
                </p>
              </div>
            </div>
          )}

          {/* How to Test */}
          {fix.howToTest && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-medium text-[var(--color-slate-300)]">
                  How to Test
                </span>
              </div>
              <div className="glass-card-subtle p-3 border-l-2 border-orange-500 bg-orange-500/5">
                <p className="text-sm text-[var(--color-slate-200)]">
                  {fix.howToTest}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
