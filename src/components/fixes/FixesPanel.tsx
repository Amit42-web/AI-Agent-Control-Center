'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Sparkles, Download, FileText, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { FixCard } from './FixCard';
import { determineFixPlacements } from '@/services/openai';

export function FixesPanel() {
  const { fixes, referenceEnabled, referenceScript, openaiConfig } = useAppStore();
  const [selectedFixIds, setSelectedFixIds] = useState<Set<string>>(new Set());
  const [showFinalScript, setShowFinalScript] = useState(false);
  const [finalScript, setFinalScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

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
  const allFixes = [...fixes.scriptFixes, ...fixes.generalFixes];

  const toggleFixSelection = (fixId: string) => {
    const newSelected = new Set(selectedFixIds);
    if (newSelected.has(fixId)) {
      newSelected.delete(fixId);
    } else {
      newSelected.add(fixId);
    }
    setSelectedFixIds(newSelected);
  };

  const generateFinalScript = async () => {
    setIsGeneratingScript(true);

    try {
      const selectedFixes = allFixes.filter(fix => selectedFixIds.has(fix.id));

      if (!referenceScript) {
        alert('No reference script available');
        setIsGeneratingScript(false);
        return;
      }

      // Get API key from environment
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

      if (!apiKey.trim()) {
        alert('OpenAI API key is not configured. Please set OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY in your environment variables.');
        setIsGeneratingScript(false);
        return;
      }

      // Use LLM to determine optimal placements
      const placements = await determineFixPlacements(
        apiKey,
        openaiConfig.model,
        referenceScript,
        selectedFixes
      );

      // Create a map of fixId -> placement info
      const placementMap = new Map(
        placements.map(p => [p.fixId, p])
      );

      const scriptLines = referenceScript.split('\n');

      // Sort placements by line number in descending order to insert from bottom to top
      // This prevents line number shifts during insertion
      const sortedPlacements = placements.sort((a, b) => b.lineNumber - a.lineNumber);

      // Insert each fix at its determined position
      sortedPlacements.forEach(placement => {
        const fix = selectedFixes.find(f => f.id === placement.fixId);
        if (!fix) return;

        const fixIndex = selectedFixes.indexOf(fix);
        const addition = [
          '',
          `>>>>>> START OF NEW ADDITION ${fixIndex + 1} <<<<<<`,
          `[Placement: ${placement.reasoning}]`,
          fix.suggestion,
          `>>>>>> END OF NEW ADDITION ${fixIndex + 1} <<<<<<`,
          ''
        ].join('\n');

        // Insert after the specified line number
        scriptLines.splice(placement.lineNumber, 0, addition);
      });

      setFinalScript(scriptLines.join('\n'));
      setShowFinalScript(true);
    } catch (error) {
      console.error('Error generating final script:', error);
      alert(`Failed to generate script: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

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
        <div className="flex items-center gap-3">
          {selectedFixIds.size > 0 && (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={generateFinalScript}
              disabled={isGeneratingScript}
            >
              {isGeneratingScript ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing placement...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate Final Script ({selectedFixIds.size})
                </>
              )}
            </button>
          )}
          <button className="btn-secondary flex items-center gap-2" onClick={exportFixes}>
            <Download className="w-4 h-4" />
            Export Fixes
          </button>
        </div>
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
                <FixCard
                  key={fix.id}
                  fix={fix}
                  index={index}
                  isSelected={selectedFixIds.has(fix.id)}
                  onToggleSelect={() => toggleFixSelection(fix.id)}
                />
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
                isSelected={selectedFixIds.has(fix.id)}
                onToggleSelect={() => toggleFixSelection(fix.id)}
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

      {/* Final Script Modal */}
      {showFinalScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <motion.div
            className="glass-card max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="p-4 border-b border-[var(--color-navy-700)] flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Final Updated Script</h3>
              <div className="flex items-center gap-2">
                <button
                  className="btn-primary flex items-center gap-2 text-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(finalScript);
                  }}
                >
                  <Download className="w-4 h-4" />
                  Copy to Clipboard
                </button>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => setShowFinalScript(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="text-sm text-[var(--color-slate-200)] whitespace-pre-wrap font-mono bg-[var(--color-navy-900)] p-4 rounded-lg border border-[var(--color-navy-700)]">
                {finalScript}
              </pre>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
