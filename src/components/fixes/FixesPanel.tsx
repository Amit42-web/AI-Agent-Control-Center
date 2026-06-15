'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Download, ChevronDown, ChevronRight, Copy, Check, FileText, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { EnhancedFixCard } from './EnhancedFixCard';
import { determineFixPlacements } from '@/services/openai';
import { RootCauseType, ConsolidatedFix, FixChange, Fix } from '@/types';

const rcaConfig: Record<RootCauseType, { label: string; icon: string; bg: string; text: string; border: string; headerBg: string }> = {
  execution:    { label: 'Execution Failure',   icon: '⚠️', bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-500/30', headerBg: 'bg-orange-500/15' },
  instruction:  { label: 'Instruction Gap',     icon: '📋', bg: 'bg-cyan-500/10',   text: 'text-cyan-300',   border: 'border-cyan-500/30',   headerBg: 'bg-cyan-500/15'   },
  knowledge:    { label: 'Knowledge Gap',       icon: '📚', bg: 'bg-yellow-500/10', text: 'text-yellow-300', border: 'border-yellow-500/30', headerBg: 'bg-yellow-500/15' },
  conversation: { label: 'Conversation Design', icon: '💬', bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/30', headerBg: 'bg-purple-500/15' },
  model:        { label: 'Model Limitation',    icon: '🤖', bg: 'bg-green-500/10',  text: 'text-green-300',  border: 'border-green-500/30',  headerBg: 'bg-green-500/15'  },
};

interface ScriptSection {
  text: string;
  isNew: boolean;
  isRemoved?: boolean;
  isReplaced?: boolean;
  reasoning?: string;
}

function ChangeRow({ change, idx }: { change: FixChange; idx: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayLine = change.lineToAdd || change.targetContent || '';
  const copyLine = () => {
    navigator.clipboard.writeText(displayLine);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-b border-[var(--color-navy-700)] last:border-0">
      {/* Compact row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
        <span className="text-xs text-[var(--color-slate-500)] w-5 text-center shrink-0">{idx + 1}</span>
        <span className={`text-xs px-2 py-0.5 rounded shrink-0 font-medium ${
          change.action === 'remove' ? 'bg-red-500/20 text-red-400' :
          change.action === 'replace' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-green-500/20 text-green-400'
        }`}>
          {change.action === 'remove' ? '− Remove' : change.action === 'replace' ? '~ Replace' : '+ Add'}
        </span>
        <code className="text-sm text-[var(--color-slate-200)] font-mono flex-1 truncate">{displayLine}</code>
        <span className="text-xs text-[var(--color-slate-500)] shrink-0 hidden sm:block max-w-[200px] truncate">{change.placementHint}</span>
        <button onClick={() => setExpanded(e => !e)} className="p-1 rounded hover:bg-white/10 transition-colors shrink-0">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-[var(--color-slate-400)]" />
            : <ChevronRight className="w-4 h-4 text-[var(--color-slate-400)]" />}
        </button>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3 bg-[var(--color-navy-900)]/50 ml-8">
              {/* Line visual */}
              {change.action === 'replace' ? (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2 rounded px-3 py-2 bg-red-500/10 border border-red-500/25">
                    <span className="text-red-400 font-mono font-bold text-sm select-none">−</span>
                    <code className="text-sm font-mono text-red-300 break-all line-through">{change.targetContent}</code>
                  </div>
                  <div className="flex items-start gap-2 rounded px-3 py-2 bg-green-500/10 border border-green-500/25">
                    <span className="text-green-400 font-mono font-bold text-sm select-none">+</span>
                    <code className="text-sm font-mono text-green-300 break-all">{change.lineToAdd}</code>
                  </div>
                </div>
              ) : (
                <div className={`flex items-start gap-2 rounded px-3 py-2 ${change.action === 'remove' ? 'bg-red-500/10 border border-red-500/25' : 'bg-green-500/10 border border-green-500/25'}`}>
                  <span className={`font-mono font-bold text-sm select-none ${change.action === 'remove' ? 'text-red-400' : 'text-green-400'}`}>
                    {change.action === 'remove' ? '−' : '+'}
                  </span>
                  <code className={`text-sm font-mono break-all ${change.action === 'remove' ? 'text-red-300 line-through' : 'text-green-300'}`}>
                    {displayLine}
                  </code>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--color-slate-500)]">Placement</p>
                  <p className="text-sm text-[var(--color-slate-300)]">{change.placementHint}</p>
                </div>
                <button onClick={copyLine} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-[var(--color-navy-700)] hover:bg-[var(--color-navy-600)] text-[var(--color-slate-300)] transition-colors">
                  {copied ? <><Check className="w-3 h-3 text-green-400" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                </button>
              </div>

              {change.context && (
                <div>
                  <p className="text-xs text-[var(--color-slate-500)] mb-1">Why this helps</p>
                  <p className="text-sm text-[var(--color-slate-400)] leading-relaxed">{change.context}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConsolidatedFixCard({ fix, index, isSelected, onToggleSelect }: {
  fix: ConsolidatedFix;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const [open, setOpen] = useState(true);
  const cfg = rcaConfig[fix.rootCauseType];

  return (
    <motion.div
      className={`rounded-xl border ${cfg.border} overflow-hidden`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
    >
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 cursor-pointer ${cfg.headerBg}`} onClick={() => setOpen(o => !o)}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded border-2 border-[var(--color-navy-600)] bg-[var(--color-navy-800)] checked:bg-blue-500 checked:border-blue-500 cursor-pointer shrink-0"
        />
        <span className="text-xl shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold ${cfg.text}`}>{cfg.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
              {fix.changes.length} change{fix.changes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-sm text-[var(--color-slate-400)] mt-0.5 truncate">{fix.summary}</p>
        </div>
        {open
          ? <ChevronDown className="w-5 h-5 text-[var(--color-slate-400)] shrink-0" />
          : <ChevronRight className="w-5 h-5 text-[var(--color-slate-400)] shrink-0" />}
      </div>

      {/* Change list */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {fix.changes.map((change, idx) => (
              <ChangeRow key={idx} change={change} idx={idx} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FixesPanel() {
  const { consolidatedFixes, enhancedFixes, referenceScript, openaiConfig } = useAppStore();
  const [selectedFixIds, setSelectedFixIds] = useState<Set<string>>(new Set());
  const [showFinalScript, setShowFinalScript] = useState(false);
  const [finalScript, setFinalScript] = useState('');
  const [scriptSections, setScriptSections] = useState<ScriptSection[]>([]);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  const hasEnhancedFixes = (enhancedFixes?.fixes?.length ?? 0) > 0;
  const hasConsolidatedFixes = consolidatedFixes && consolidatedFixes.length > 0;

  if (!hasEnhancedFixes && !hasConsolidatedFixes) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-[var(--color-slate-400)]">No fixes available yet.</p>
      </div>
    );
  }

  // Open-ended flow
  if (hasEnhancedFixes) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-400" />
              RCA-Categorized Fixes
            </h2>
            <p className="text-[var(--color-slate-400)] mt-1">Comprehensive fixes grouped by root cause category</p>
          </div>
        </div>
        <div className="space-y-4">
          {(enhancedFixes?.fixes ?? []).map((fix: any, index: number) => (
            <EnhancedFixCard key={fix.id} fix={fix} index={index} />
          ))}
        </div>
      </div>
    );
  }

  // Objective flow — consolidated fixes
  const totalChanges = (consolidatedFixes ?? []).reduce((sum: number, f: ConsolidatedFix) => sum + f.changes.length, 0);
  const selectedFixes = (consolidatedFixes ?? []).filter((f: ConsolidatedFix) => selectedFixIds.has(f.id));

  const toggleSelect = (id: string) => {
    setSelectedFixIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportFixes = () => {
    const blob = new Blob([JSON.stringify({ consolidatedFixes, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'consolidated_fixes.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const generateFinalScript = async () => {
    if (!referenceScript) { alert('No reference script available'); return; }
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    if (!apiKey.trim()) { alert('OpenAI API key is not configured.'); return; }

    setIsGeneratingScript(true);
    try {
      // Flatten all selected changes into Fix-compatible objects for placement logic
      const allChanges: (FixChange & { id: string; suggestion: string; problem: string; relatedIssueIds: string[] })[] = selectedFixes.flatMap((f: ConsolidatedFix, fi: number) =>
        f.changes.map((c: FixChange, ci: number) => ({
          ...c,
          id: `${f.id}-change-${ci}`,
          suggestion: c.lineToAdd || '',
          problem: f.summary,
          relatedIssueIds: f.relatedIssueIds,
        }))
      );

      const addChanges = allChanges.filter(c => !c.action || c.action === 'add');
      const removeChanges = allChanges.filter(c => c.action === 'remove');
      const replaceChanges = allChanges.filter(c => c.action === 'replace');

      let modifiedScript = referenceScript;
      const removedSections: { text: string; summary: string }[] = [];
      const replacedSections: { oldText: string; newText: string; summary: string }[] = [];

      removeChanges.forEach(c => {
        if (c.targetContent) {
          const lines = modifiedScript.split('\n');
          const removed: string[] = [];
          modifiedScript = lines.filter((l: string) => { if (l.includes(c.targetContent!)) { removed.push(l); return false; } return true; }).join('\n');
          if (removed.length) removedSections.push({ text: removed.join('\n'), summary: c.context || c.problem });
        }
      });

      replaceChanges.forEach(c => {
        if (c.targetContent && c.lineToAdd && modifiedScript.includes(c.targetContent)) {
          replacedSections.push({ oldText: c.targetContent, newText: c.lineToAdd, summary: c.context || c.problem });
          modifiedScript = modifiedScript.replace(c.targetContent, c.lineToAdd);
        }
      });

      const addFixes = addChanges.map(c => ({ ...c, exampleResponse: '', issueType: 'quality_issue' as any, rootCauseType: undefined }));
      const placements = await determineFixPlacements(apiKey, openaiConfig.model, modifiedScript, addFixes as unknown as Fix[]);
      const scriptLines = modifiedScript.split('\n');
      const sorted = [...placements].sort((a, b) => a.lineNumber - b.lineNumber);
      const sections: ScriptSection[] = [];
      let idx = 0;

      sorted.forEach(p => {
        const c = addChanges.find(x => x.id === p.fixId);
        if (!c) return;
        if (idx < p.lineNumber) {
          const orig = scriptLines.slice(idx, p.lineNumber).join('\n');
          if (orig.trim()) sections.push({ text: orig, isNew: false });
        }
        sections.push({ text: c.lineToAdd || '', isNew: true, reasoning: p.reasoning });
        idx = p.lineNumber;
      });

      if (idx < scriptLines.length) {
        const rest = scriptLines.slice(idx).join('\n');
        if (rest.trim()) sections.push({ text: rest, isNew: false });
      }

      removedSections.forEach(r => sections.unshift({ text: r.text, isNew: false, isRemoved: true, reasoning: `Removed: ${r.summary}` }));
      replacedSections.forEach(r => {
        const i = sections.findIndex(s => s.text.includes(r.newText));
        if (i !== -1) sections.splice(i, 0, { text: r.oldText, isNew: false, isReplaced: true, reasoning: `Replaced: ${r.summary}` });
      });

      setScriptSections(sections);
      setFinalScript(sections.filter(s => !s.isRemoved && !s.isReplaced).map(s => s.text).join('\n'));
      setShowFinalScript(true);
    } catch (err) {
      alert(`Failed to generate script: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h2 className="text-2xl font-bold text-white">Fix Suggestions</h2>
          <p className="text-[var(--color-slate-400)] mt-1">
            {(consolidatedFixes ?? []).length} root cause{(consolidatedFixes ?? []).length !== 1 ? 's' : ''} · {totalChanges} specific change{totalChanges !== 1 ? 's' : ''}
            {selectedFixIds.size > 0 && <span className="text-blue-400 ml-2">· {selectedFixIds.size} selected</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedFixIds.size > 0 && (
            <button className="btn-primary flex items-center gap-2" onClick={generateFinalScript} disabled={isGeneratingScript}>
              {isGeneratingScript
                ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                : <><FileText className="w-4 h-4" />Generate Script ({selectedFixIds.size})</>}
            </button>
          )}
          <button className="btn-secondary flex items-center gap-2" onClick={exportFixes}>
            <Download className="w-4 h-4" />Export
          </button>
        </div>
      </motion.div>

      {/* Consolidated fix cards */}
      <div className="space-y-4">
        {(consolidatedFixes ?? []).map((fix: ConsolidatedFix, i: number) => (
          <ConsolidatedFixCard
            key={fix.id}
            fix={fix}
            index={i}
            isSelected={selectedFixIds.has(fix.id)}
            onToggleSelect={() => toggleSelect(fix.id)}
          />
        ))}
      </div>

      {/* Final Script Modal */}
      {showFinalScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            className="glass-card max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="p-4 border-b border-[var(--color-navy-700)] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Final Updated Script</h3>
                <p className="text-xs text-[var(--color-slate-400)] mt-1">Green bar = new addition. Copy button copies clean text.</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => { navigator.clipboard.writeText(finalScript); alert('Script copied to clipboard!'); }}>
                  <Download className="w-4 h-4" />Copy to Clipboard
                </button>
                <button className="btn-secondary text-sm" onClick={() => setShowFinalScript(false)}>Close</button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-[var(--color-navy-900)]">
              {scriptSections.map((section, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: section.isNew ? 10 : section.isRemoved || section.isReplaced ? -10 : 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`${
                    section.isNew ? 'border-l-4 border-green-500 pl-4 py-2 bg-green-500/5'
                    : section.isRemoved ? 'border-l-4 border-red-500 pl-4 py-2 bg-red-500/5 line-through opacity-60'
                    : section.isReplaced ? 'border-l-4 border-yellow-500 pl-4 py-2 bg-yellow-500/5 line-through opacity-60'
                    : ''
                  }`}
                >
                  {(section.isRemoved || section.isReplaced) && (
                    <div className="text-xs mb-1 font-semibold">
                      <span className={section.isRemoved ? 'text-red-400' : 'text-yellow-400'}>
                        {section.isRemoved ? '🗑️ REMOVED' : '✏️ REPLACED'}: {section.reasoning}
                      </span>
                    </div>
                  )}
                  <pre className={`text-sm whitespace-pre-wrap font-mono ${section.isRemoved || section.isReplaced ? 'text-[var(--color-slate-400)]' : 'text-[var(--color-slate-200)]'}`}>
{section.text}
                  </pre>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
