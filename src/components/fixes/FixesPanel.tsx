'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Download, FileText, Loader2, ChevronDown, ChevronUp, ChevronRight, Copy, Check } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { EnhancedFixCard } from './EnhancedFixCard';
import { determineFixPlacements } from '@/services/openai';
import { RootCauseType, Fix } from '@/types';

const rcaConfig: Record<RootCauseType, { label: string; icon: string; bg: string; text: string; border: string; headerBg: string }> = {
  execution:    { label: 'Execution Failure',   icon: '⚠️', bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-500/30', headerBg: 'bg-orange-500/15' },
  instruction:  { label: 'Instruction Gap',     icon: '📋', bg: 'bg-cyan-500/10',   text: 'text-cyan-300',   border: 'border-cyan-500/30',   headerBg: 'bg-cyan-500/15'   },
  knowledge:    { label: 'Knowledge Gap',       icon: '📚', bg: 'bg-yellow-500/10', text: 'text-yellow-300', border: 'border-yellow-500/30', headerBg: 'bg-yellow-500/15' },
  conversation: { label: 'Conversation Design', icon: '💬', bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/30', headerBg: 'bg-purple-500/15' },
  model:        { label: 'Model Limitation',    icon: '🤖', bg: 'bg-green-500/10',  text: 'text-green-300',  border: 'border-green-500/30',  headerBg: 'bg-green-500/15'  },
};

const RCA_ORDER: RootCauseType[] = ['execution', 'instruction', 'knowledge', 'conversation', 'model'];

interface ScriptSection {
  text: string;
  isNew: boolean;
  isRemoved?: boolean;
  isReplaced?: boolean;
  reasoning?: string;
}

function FixRow({
  fix,
  isSelected,
  onToggleSelect,
}: {
  fix: Fix;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayLine = fix.lineToAdd || fix.targetContent || fix.suggestion;
  const copyLine = () => {
    navigator.clipboard.writeText(displayLine);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-b border-[var(--color-navy-700)] last:border-0">
      {/* Compact row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-4 h-4 rounded border-2 border-[var(--color-navy-600)] bg-[var(--color-navy-800)] checked:bg-blue-500 checked:border-blue-500 cursor-pointer shrink-0"
        />
        <span className={`text-xs px-2 py-0.5 rounded shrink-0 font-medium ${
          fix.action === 'remove' ? 'bg-red-500/20 text-red-400' :
          fix.action === 'replace' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-green-500/20 text-green-400'
        }`}>
          {fix.action === 'remove' ? '− Remove' : fix.action === 'replace' ? '~ Replace' : '+ Add'}
        </span>
        <code className="text-sm text-[var(--color-slate-200)] font-mono flex-1 truncate">
          {displayLine}
        </code>
        <span className="text-xs text-[var(--color-slate-500)] shrink-0 hidden sm:block max-w-[180px] truncate">
          {fix.placementHint}
        </span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
        >
          {expanded
            ? <ChevronUp className="w-4 h-4 text-[var(--color-slate-400)]" />
            : <ChevronRight className="w-4 h-4 text-[var(--color-slate-400)]" />
          }
        </button>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3 bg-[var(--color-navy-900)]/50">
              {/* Problem */}
              <div>
                <p className="text-xs text-[var(--color-slate-500)] mb-1">Issue</p>
                <p className="text-sm text-[var(--color-slate-300)]">{fix.problem}</p>
              </div>

              {/* Line to add/remove */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-[var(--color-slate-500)]">
                    {fix.action === 'remove' ? 'Line to remove' : fix.action === 'replace' ? 'Replace this' : 'Line to add'}
                  </p>
                  <button
                    onClick={copyLine}
                    className="flex items-center gap-1 text-xs text-[var(--color-slate-400)] hover:text-white transition-colors"
                  >
                    {copied ? <><Check className="w-3 h-3 text-green-400" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                  </button>
                </div>
                <div className={`flex items-start gap-2 rounded px-3 py-2 ${
                  fix.action === 'remove' ? 'bg-red-500/10 border border-red-500/25' : 'bg-green-500/10 border border-green-500/25'
                }`}>
                  <span className={`font-mono font-bold text-sm select-none ${fix.action === 'remove' ? 'text-red-400' : 'text-green-400'}`}>
                    {fix.action === 'remove' ? '−' : '+'}
                  </span>
                  <code className={`text-sm font-mono break-all ${fix.action === 'remove' ? 'text-red-300 line-through' : 'text-green-300'}`}>
                    {displayLine}
                  </code>
                </div>
              </div>

              {/* Replacement line (for replace action) */}
              {fix.action === 'replace' && fix.suggestion && (
                <div>
                  <p className="text-xs text-[var(--color-slate-500)] mb-1">Replace with</p>
                  <div className="flex items-start gap-2 rounded px-3 py-2 bg-green-500/10 border border-green-500/25">
                    <span className="font-mono font-bold text-sm text-green-400 select-none">+</span>
                    <code className="text-sm font-mono text-green-300 break-all">{fix.lineToAdd || fix.suggestion}</code>
                  </div>
                </div>
              )}

              {/* Placement */}
              <div>
                <p className="text-xs text-[var(--color-slate-500)] mb-1">Placement</p>
                <p className="text-sm text-[var(--color-slate-300)]">{fix.placementHint}</p>
              </div>

              {/* Context */}
              {fix.context && (
                <div>
                  <p className="text-xs text-[var(--color-slate-500)] mb-1">Why this helps</p>
                  <p className="text-sm text-[var(--color-slate-400)] leading-relaxed">{fix.context}</p>
                </div>
              )}

              {/* Example response */}
              {fix.exampleResponse && (
                <div>
                  <p className="text-xs text-[var(--color-slate-500)] mb-1">Example bot response</p>
                  <p className="text-sm text-teal-300 italic border-l-2 border-teal-500 pl-3">{fix.exampleResponse}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RcaGroup({
  rca,
  fixes,
  selectedFixIds,
  onToggleFix,
  onToggleAll,
}: {
  rca: RootCauseType;
  fixes: Fix[];
  selectedFixIds: Set<string>;
  onToggleFix: (id: string) => void;
  onToggleAll: (ids: string[], select: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const cfg = rcaConfig[rca];
  const allSelected = fixes.every(f => selectedFixIds.has(f.id));
  const someSelected = fixes.some(f => selectedFixIds.has(f.id));

  return (
    <motion.div
      className={`rounded-xl border ${cfg.border} overflow-hidden`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Accordion header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${cfg.headerBg} select-none`}
        onClick={() => setOpen(o => !o)}
      >
        <input
          type="checkbox"
          checked={allSelected}
          ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={(e) => {
            e.stopPropagation();
            onToggleAll(fixes.map(f => f.id), !allSelected);
          }}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded border-2 border-[var(--color-navy-600)] bg-[var(--color-navy-800)] checked:bg-blue-500 checked:border-blue-500 cursor-pointer shrink-0"
        />
        <span className="text-lg">{cfg.icon}</span>
        <span className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border} ml-1`}>
          {fixes.length} fix{fixes.length !== 1 ? 'es' : ''}
        </span>
        {someSelected && (
          <span className="text-xs text-blue-400 ml-1">
            {fixes.filter(f => selectedFixIds.has(f.id)).length} selected
          </span>
        )}
        <div className="ml-auto">
          {open
            ? <ChevronDown className="w-4 h-4 text-[var(--color-slate-400)]" />
            : <ChevronRight className="w-4 h-4 text-[var(--color-slate-400)]" />
          }
        </div>
      </div>

      {/* Fix rows */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {fixes.map(fix => (
              <FixRow
                key={fix.id}
                fix={fix}
                isSelected={selectedFixIds.has(fix.id)}
                onToggleSelect={() => onToggleFix(fix.id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FixesPanel() {
  const { fixes, enhancedFixes, referenceEnabled, referenceScript, openaiConfig } = useAppStore();
  const [selectedFixIds, setSelectedFixIds] = useState<Set<string>>(new Set());
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showFinalScript, setShowFinalScript] = useState(false);
  const [finalScript, setFinalScript] = useState('');
  const [scriptSections, setScriptSections] = useState<ScriptSection[]>([]);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  const hasEnhancedFixes = enhancedFixes && enhancedFixes.fixes && enhancedFixes.fixes.length > 0;
  const hasRegularFixes = fixes && fixes.scriptFixes && fixes.generalFixes;

  if (!hasEnhancedFixes && !hasRegularFixes) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-[var(--color-slate-400)]">No fixes available yet.</p>
      </div>
    );
  }

  // Open-ended flow — enhanced fixes
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
          <span className="text-sm text-[var(--color-slate-400)]">
            {enhancedFixes.fixes.length} categor{enhancedFixes.fixes.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>
        <div className="space-y-4">
          {enhancedFixes.fixes.map((fix: any, index: number) => (
            <EnhancedFixCard key={fix.id} fix={fix} index={index} />
          ))}
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify({ enhancedFixes: enhancedFixes.fixes, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'rca_categorized_fixes.json'; a.click();
              URL.revokeObjectURL(url);
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />Export Fixes
          </button>
        </div>
      </div>
    );
  }

  // Objective flow — group all fixes by RCA category
  const allFixes = [...(fixes?.scriptFixes || []), ...(fixes?.generalFixes || [])];
  const totalFixes = allFixes.length;

  const rcaGroups = RCA_ORDER.reduce<Record<RootCauseType, Fix[]>>((acc, rca) => {
    acc[rca] = allFixes.filter(f => f.rootCauseType === rca);
    return acc;
  }, {} as Record<RootCauseType, Fix[]>);

  const ungrouped = allFixes.filter(f => !f.rootCauseType || !(f.rootCauseType in rcaConfig));

  const toggleFix = (id: string) => {
    setSelectedFixIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (ids: string[], select: boolean) => {
    setSelectedFixIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => select ? next.add(id) : next.delete(id));
      return next;
    });
  };

  const exportFixes = () => {
    const blob = new Blob([JSON.stringify({ scriptFixes: fixes?.scriptFixes || [], generalFixes: fixes?.generalFixes || [], exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fix_suggestions.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const generateFinalScript = async () => {
    setIsGeneratingScript(true);
    try {
      const selectedFixes = allFixes.filter(fix => selectedFixIds.has(fix.id));
      if (!referenceScript) { alert('No reference script available'); setIsGeneratingScript(false); return; }
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
      if (!apiKey.trim()) { alert('OpenAI API key is not configured.'); setIsGeneratingScript(false); return; }

      const sections: ScriptSection[] = [];
      const addFixes = selectedFixes.filter(f => !f.action || f.action === 'add');
      const removeFixes = selectedFixes.filter(f => f.action === 'remove');
      const replaceFixes = selectedFixes.filter(f => f.action === 'replace');

      let modifiedScript = referenceScript;
      const removedSections: { text: string; fix: Fix }[] = [];
      const replacedSections: { oldText: string; newText: string; fix: Fix }[] = [];

      removeFixes.forEach(fix => {
        if (fix.targetContent) {
          const lines = modifiedScript.split('\n');
          const removedLines: string[] = [];
          const filteredLines = lines.filter((line: string) => {
            if (line.includes(fix.targetContent!)) { removedLines.push(line); return false; }
            return true;
          });
          if (removedLines.length > 0) removedSections.push({ text: removedLines.join('\n'), fix });
          modifiedScript = filteredLines.join('\n');
        }
      });

      replaceFixes.forEach(fix => {
        if (fix.targetContent && fix.suggestion) {
          if (modifiedScript.includes(fix.targetContent)) {
            replacedSections.push({ oldText: fix.targetContent, newText: fix.suggestion, fix });
            modifiedScript = modifiedScript.replace(fix.targetContent, fix.suggestion);
          }
        }
      });

      const addPlacements = await determineFixPlacements(apiKey, openaiConfig.model, modifiedScript, addFixes);
      const scriptLinesAfterModifications = modifiedScript.split('\n');
      const sortedPlacements = [...addPlacements].sort((a, b) => a.lineNumber - b.lineNumber);
      let currentLineIndex = 0;

      sortedPlacements.forEach(placement => {
        const fix = addFixes.find(f => f.id === placement.fixId);
        if (!fix) return;
        if (currentLineIndex < placement.lineNumber) {
          const originalLines = scriptLinesAfterModifications.slice(currentLineIndex, placement.lineNumber).join('\n');
          if (originalLines.trim()) sections.push({ text: originalLines, isNew: false });
        }
        sections.push({ text: fix.suggestion, isNew: true, reasoning: placement.reasoning });
        currentLineIndex = placement.lineNumber;
      });

      if (currentLineIndex < scriptLinesAfterModifications.length) {
        const remainingLines = scriptLinesAfterModifications.slice(currentLineIndex).join('\n');
        if (remainingLines.trim()) sections.push({ text: remainingLines, isNew: false });
      }
      removedSections.forEach(r => sections.unshift({ text: r.text, isNew: false, isRemoved: true, reasoning: `Removed: ${r.fix.problem}` }));
      replacedSections.forEach(r => {
        const idx = sections.findIndex(s => s.text.includes(r.newText));
        if (idx !== -1) sections.splice(idx, 0, { text: r.oldText, isNew: false, isReplaced: true, reasoning: `Replaced: ${r.fix.problem}` });
      });

      setScriptSections(sections);
      setFinalScript(sections.filter(s => !s.isRemoved && !s.isReplaced).map(s => s.text).join('\n'));
      setShowFinalScript(true);
    } catch (error) {
      alert(`Failed to generate script: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            {totalFixes} fix{totalFixes !== 1 ? 'es' : ''} grouped by root cause
            {selectedFixIds.size > 0 && <span className="text-blue-400 ml-2">· {selectedFixIds.size} selected</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedFixIds.size > 0 && (
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowReviewModal(true)}>
              <FileText className="w-4 h-4" />
              Review & Generate Script ({selectedFixIds.size})
            </button>
          )}
          <button className="btn-secondary flex items-center gap-2" onClick={exportFixes}>
            <Download className="w-4 h-4" />Export
          </button>
        </div>
      </motion.div>

      {/* RCA groups */}
      <div className="space-y-3">
        {RCA_ORDER.map((rca, i) => {
          const group = rcaGroups[rca];
          if (!group.length) return null;
          return (
            <motion.div key={rca} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <RcaGroup
                rca={rca}
                fixes={group}
                selectedFixIds={selectedFixIds}
                onToggleFix={toggleFix}
                onToggleAll={toggleAll}
              />
            </motion.div>
          );
        })}

        {/* Ungrouped fallback */}
        {ungrouped.length > 0 && (
          <div className="rounded-xl border border-[var(--color-navy-600)] overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-navy-700)]">
              <span className="text-sm font-semibold text-[var(--color-slate-300)]">Other Fixes ({ungrouped.length})</span>
            </div>
            {ungrouped.map(fix => (
              <FixRow key={fix.id} fix={fix} isSelected={selectedFixIds.has(fix.id)} onToggleSelect={() => toggleFix(fix.id)} />
            ))}
          </div>
        )}

        {totalFixes === 0 && (
          <div className="glass-card p-8 text-center">
            <Sparkles className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">No Fixes Required</h3>
            <p className="text-[var(--color-slate-400)]">No significant issues were found that require fixes.</p>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            className="glass-card max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="p-6 border-b border-[var(--color-navy-700)]">
              <h3 className="text-2xl font-semibold text-white mb-1">Review Selected Fixes</h3>
              <p className="text-sm text-[var(--color-slate-400)]">
                {selectedFixIds.size} fix{selectedFixIds.size !== 1 ? 'es' : ''} selected across {
                  RCA_ORDER.filter(r => rcaGroups[r].some(f => selectedFixIds.has(f.id))).length
                } categories
              </p>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* Left: fixes by RCA */}
              <div className="space-y-4 overflow-y-auto pr-2">
                <h4 className="text-sm font-semibold text-[var(--color-slate-300)] sticky top-0 bg-[var(--color-navy-800)] py-2">Fixes by Category</h4>
                {RCA_ORDER.map(rca => {
                  const selected = rcaGroups[rca].filter(f => selectedFixIds.has(f.id));
                  if (!selected.length) return null;
                  const cfg = rcaConfig[rca];
                  return (
                    <div key={rca} className={`rounded-lg border ${cfg.border} overflow-hidden`}>
                      <div className={`px-3 py-2 ${cfg.headerBg} flex items-center gap-2`}>
                        <span>{cfg.icon}</span>
                        <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                        <span className={`text-xs px-1.5 rounded-full ${cfg.bg} ${cfg.text} ml-auto`}>{selected.length}</span>
                      </div>
                      {selected.map(fix => (
                        <div key={fix.id} className="px-3 py-2 border-t border-[var(--color-navy-700)] flex items-start gap-2">
                          <span className={`text-xs shrink-0 mt-0.5 ${fix.action === 'remove' ? 'text-red-400' : 'text-green-400'}`}>
                            {fix.action === 'remove' ? '−' : '+'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs text-[var(--color-slate-300)] truncate">{fix.lineToAdd || fix.targetContent || fix.suggestion}</p>
                            <p className="text-xs text-[var(--color-slate-500)] mt-0.5">{fix.placementHint}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Right: summary */}
              <div className="space-y-4 overflow-y-auto pl-4 border-l border-[var(--color-navy-700)]">
                <h4 className="text-sm font-semibold text-[var(--color-slate-300)] sticky top-0 bg-[var(--color-navy-800)] py-2">Summary</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Additions', count: allFixes.filter(f => selectedFixIds.has(f.id) && (!f.action || f.action === 'add')).length, color: 'text-green-300', bg: 'bg-green-500/10', border: 'border-green-500/30' },
                    { label: 'Replacements', count: allFixes.filter(f => selectedFixIds.has(f.id) && f.action === 'replace').length, color: 'text-yellow-300', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
                    { label: 'Removals', count: allFixes.filter(f => selectedFixIds.has(f.id) && f.action === 'remove').length, color: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/30' },
                  ].map(s => (
                    <div key={s.label} className={`text-center p-3 rounded-lg ${s.bg} border ${s.border}`}>
                      <div className={`text-xl font-bold ${s.color}`}>{s.count}</div>
                      <div className="text-xs text-[var(--color-slate-400)] mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="glass-card p-4 space-y-2 text-sm text-[var(--color-slate-300)]">
                  <p className="font-medium text-white mb-2">What happens next</p>
                  {['AI determines optimal placement for additions', 'Replacements and removals applied to script', 'Final script shown with visual diff', 'Copy clean script to clipboard'].map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-blue-400 shrink-0">{i + 1}.</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[var(--color-navy-700)] flex items-center justify-between bg-[var(--color-navy-900)]">
              <button className="btn-secondary" onClick={() => setShowReviewModal(false)} disabled={isGeneratingScript}>Cancel</button>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={async () => { await generateFinalScript(); setShowReviewModal(false); }}
                disabled={isGeneratingScript}
              >
                {isGeneratingScript
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                  : <><Sparkles className="w-4 h-4" />Confirm & Generate Final Script</>
                }
              </button>
            </div>

            {isGeneratingScript && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="glass-card p-8 flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
                  <div className="text-center">
                    <h4 className="text-lg font-semibold text-white mb-2">Generating Final Script</h4>
                    <p className="text-sm text-[var(--color-slate-400)]">AI is analyzing optimal placement and applying fixes...</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

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
                <button
                  className="btn-primary flex items-center gap-2 text-sm"
                  onClick={() => { navigator.clipboard.writeText(finalScript); alert('Script copied to clipboard!'); }}
                >
                  <Download className="w-4 h-4" />Copy to Clipboard
                </button>
                <button className="btn-secondary text-sm" onClick={() => setShowFinalScript(false)}>Close</button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-[var(--color-navy-900)]">
              <div className="space-y-0">
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
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
