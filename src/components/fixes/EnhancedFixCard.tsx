'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { EnhancedFix } from '@/types';

const rootCauseColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  knowledge:    { bg: 'bg-yellow-500/20', text: 'text-yellow-300',  border: 'border-yellow-500/30',  icon: '📚' },
  instruction:  { bg: 'bg-cyan-500/20',   text: 'text-cyan-300',    border: 'border-cyan-500/30',    icon: '📋' },
  execution:    { bg: 'bg-orange-500/20', text: 'text-orange-300',  border: 'border-orange-500/30',  icon: '⚠️' },
  conversation: { bg: 'bg-purple-500/20', text: 'text-purple-300',  border: 'border-purple-500/30',  icon: '💬' },
  model:        { bg: 'bg-green-500/20',  text: 'text-green-300',   border: 'border-green-500/30',   icon: '🤖' },
};

const fixTypeColors: Record<string, { bg: string; text: string }> = {
  script:   { bg: 'bg-blue-500/20',   text: 'text-blue-400'   },
  training: { bg: 'bg-green-500/20',  text: 'text-green-400'  },
  process:  { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  system:   { bg: 'bg-red-500/20',    text: 'text-red-400'    },
};

function impactLabel(pct: number): { label: string; color: string; barColor: string } {
  if (pct >= 35) return { label: 'High Impact',     color: 'text-red-400',    barColor: 'bg-red-500'    };
  if (pct >= 15) return { label: 'Moderate Impact', color: 'text-amber-400',  barColor: 'bg-amber-500'  };
  return              { label: 'Low Impact',       color: 'text-slate-400',  barColor: 'bg-slate-500'  };
}

export interface EnhancedFixCardProps {
  fix: EnhancedFix;
  index: number;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  impactPct?: number;       // severity-weighted % of total incidents this fix covers
  incidentCount?: number;   // raw count of incidents for this fix's RCA
}

const LINE_LIMIT = 8; // patches longer than this are likely full-section copies

function isLongPatch(text?: string): boolean {
  if (!text) return false;
  return text.split('\n').length > LINE_LIMIT;
}

function LongPatchWarning({ label, text }: { label: string; text: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-medium text-amber-400">{label}</div>
        <span className="text-xs text-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 rounded">
          {lines.length} lines — may be over-specified
        </span>
      </div>
      <pre className={`text-xs whitespace-pre-wrap font-mono p-2.5 rounded border leading-relaxed overflow-hidden transition-all
        ${label.toLowerCase().includes('remove') || label.toLowerCase().includes('after')
          ? 'text-red-200 bg-red-900/20 border-red-500/20'
          : 'text-green-200 bg-green-900/20 border-green-500/20'}`}
        style={{ maxHeight: expanded ? 'none' : '80px' }}
      >
        {text}
      </pre>
      <button
        className="text-xs text-amber-400 hover:text-amber-300 mt-1"
        onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
      >
        {expanded ? 'Collapse' : `Show all ${lines.length} lines`}
      </button>
    </div>
  );
}

function DiffBlock({ label, text, variant }: { label: string; text: string; variant: 'remove' | 'add' | 'neutral' }) {
  if (isLongPatch(text)) return <LongPatchWarning label={label} text={text} />;
  const styles = {
    remove:  'text-red-200 bg-red-900/20 border-red-500/20',
    add:     'text-green-200 bg-green-900/20 border-green-500/20',
    neutral: 'text-[var(--color-slate-300)] bg-white/5 border-white/10 opacity-70',
  };
  return (
    <div>
      <div className={`text-xs font-medium mb-1 ${variant === 'remove' ? 'text-red-400' : variant === 'add' ? 'text-green-400' : 'text-[var(--color-slate-400)]'}`}>
        {label}
      </div>
      <pre className={`text-xs whitespace-pre-wrap font-mono p-2.5 rounded border leading-relaxed ${styles[variant]}`}>
        {text}
      </pre>
    </div>
  );
}

export function EnhancedFixCard({
  fix,
  index,
  isSelected = false,
  onToggleSelect,
  impactPct = 0,
  incidentCount = 0,
}: EnhancedFixCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const impact = impactLabel(impactPct);

  const copyChange = () => {
    let text = '';
    if (fix.promptFix) {
      const { action, insertAfter, beforeText, exactContent, targetSection } = fix.promptFix;
      text += `Section: ${targetSection}\n\n`;
      if (action === 'add') {
        if (insertAfter) text += `After this line:\n${insertAfter}\n\n`;
        text += `Add:\n${exactContent ?? ''}`;
      } else if (action === 'replace') {
        if (beforeText) text += `Remove:\n${beforeText}\n\n`;
        if (exactContent) text += `Replace with:\n${exactContent}`;
      } else {
        text += `Remove:\n${beforeText ?? exactContent ?? ''}`;
      }
    } else {
      text = `${fix.whereToImplement ? `WHERE: ${fix.whereToImplement}\n\n` : ''}${fix.whatToImplement ?? fix.suggestedSolution ?? ''}`;
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      {/* ── Header (always visible) */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className="mt-1 w-4 h-4 rounded border-2 border-[var(--color-navy-600)] bg-[var(--color-navy-800)] checked:bg-blue-500 checked:border-blue-500 cursor-pointer flex-shrink-0"
          />
        )}

        {/* Index badge */}
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h4 className="font-semibold text-white text-sm">{fix.title}</h4>
            {fix.fixType && fixTypeColors[fix.fixType] && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${fixTypeColors[fix.fixType].bg} ${fixTypeColors[fix.fixType].text} font-medium`}>
                {fix.fixType}
              </span>
            )}
            {fix.rootCauseType && rootCauseColors[fix.rootCauseType] && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${rootCauseColors[fix.rootCauseType].bg} ${rootCauseColors[fix.rootCauseType].text} border ${rootCauseColors[fix.rootCauseType].border} font-medium`}>
                {rootCauseColors[fix.rootCauseType].icon} {fix.rootCauseType}
              </span>
            )}
            {fix.promptFix && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold uppercase
                ${fix.promptFix.action === 'add'     ? 'bg-green-500/20 text-green-400' :
                  fix.promptFix.action === 'replace' ? 'bg-blue-500/20  text-blue-400'  :
                                                       'bg-red-500/20   text-red-400'   }`}>
                {fix.promptFix.action}
              </span>
            )}
          </div>

          {/* Impact bar */}
          {incidentCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 max-w-[120px] h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${impact.barColor}`}
                  style={{ width: `${Math.min(100, impactPct)}%` }}
                />
              </div>
              <span className={`text-xs font-medium ${impact.color}`}>{impact.label}</span>
              <span className="text-xs text-[var(--color-slate-500)]">
                {incidentCount} incident{incidentCount !== 1 ? 's' : ''} · {impactPct}% of issues
              </span>
            </div>
          )}

          {/* Where — always show as a quick hint */}
          {fix.whereToImplement && (
            <p className="text-xs text-[var(--color-slate-400)] mt-1 truncate">
              📍 {fix.whereToImplement}
            </p>
          )}
        </div>

        {isExpanded
          ? <ChevronUp className="w-4 h-4 text-[var(--color-slate-400)] flex-shrink-0 mt-1" />
          : <ChevronDown className="w-4 h-4 text-[var(--color-slate-400)] flex-shrink-0 mt-1" />
        }
      </div>

      {/* ── Expanded body */}
      {isExpanded && (
        <motion.div
          className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Copy button */}
          <div className="flex justify-end">
            <button
              className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-2.5"
              onClick={(e) => { e.stopPropagation(); copyChange(); }}
            >
              {copied ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />Copy change</>}
            </button>
          </div>

          {/* Root cause — brief */}
          {fix.rootCause && (
            <div className="flex gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-slate-300)]">{fix.rootCause}</p>
            </div>
          )}

          {/* ── The actual change */}
          {fix.promptFix ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-slate-400)] uppercase tracking-wide">
                {fix.promptFix.targetSection}
              </p>

              {/* ADD */}
              {fix.promptFix.action === 'add' && (
                <>
                  {fix.promptFix.insertAfter && (
                    <DiffBlock label="After this line" text={fix.promptFix.insertAfter} variant="neutral" />
                  )}
                  {fix.promptFix.exactContent
                    ? <DiffBlock label="Add" text={fix.promptFix.exactContent} variant="add" />
                    : <p className="text-xs text-[var(--color-slate-500)] italic">No content specified.</p>
                  }
                </>
              )}

              {/* REPLACE */}
              {fix.promptFix.action === 'replace' && (
                <>
                  {fix.promptFix.beforeText
                    ? <DiffBlock label="Remove" text={fix.promptFix.beforeText} variant="remove" />
                    : <p className="text-xs text-[var(--color-slate-500)] italic">Find and remove the relevant line in: {fix.promptFix.targetSection}</p>
                  }
                  {fix.promptFix.exactContent
                    ? <DiffBlock label="Replace with" text={fix.promptFix.exactContent} variant="add" />
                    : null
                  }
                </>
              )}

              {/* REMOVE */}
              {fix.promptFix.action === 'remove' && (
                <>
                  {(fix.promptFix.beforeText ?? fix.promptFix.exactContent)
                    ? <DiffBlock label="Remove" text={(fix.promptFix.beforeText ?? fix.promptFix.exactContent)!} variant="remove" />
                    : <p className="text-xs text-[var(--color-slate-500)] italic">Locate and remove the relevant line in: {fix.promptFix.targetSection}</p>
                  }
                </>
              )}
            </div>
          ) : (
            /* Fallback when no promptFix */
            fix.whatToImplement && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-slate-400)] uppercase tracking-wide">What to change</p>
                <pre className="text-xs text-[var(--color-slate-200)] whitespace-pre-wrap font-mono bg-white/5 p-2.5 rounded border border-white/10 leading-relaxed">
                  {fix.whatToImplement}
                </pre>
              </div>
            )
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
