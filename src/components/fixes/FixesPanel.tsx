'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Sparkles, Download, FileText, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { FixCard } from './FixCard';
import { determineFixPlacements } from '@/services/openai';

interface ScriptSection {
  text: string;
  isNew: boolean;
  reasoning?: string;
}

export function FixesPanel() {
  const { fixes, referenceEnabled, referenceScript, openaiConfig } = useAppStore();
  const [selectedFixIds, setSelectedFixIds] = useState<Set<string>>(new Set());
  const [showFinalScript, setShowFinalScript] = useState(false);
  const [finalScript, setFinalScript] = useState('');
  const [scriptSections, setScriptSections] = useState<ScriptSection[]>([]);
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

      const scriptLines = referenceScript.split('\n');

      // Build sections array with metadata
      const sections: ScriptSection[] = [];

      // Sort placements by line number ascending
      const sortedPlacements = [...placements].sort((a, b) => a.lineNumber - b.lineNumber);

      let currentLineIndex = 0;

      // Process each placement
      sortedPlacements.forEach(placement => {
        const fix = selectedFixes.find(f => f.id === placement.fixId);
        if (!fix) return;

        // Add original lines before this insertion
        if (currentLineIndex < placement.lineNumber) {
          const originalLines = scriptLines.slice(currentLineIndex, placement.lineNumber).join('\n');
          if (originalLines.trim()) {
            sections.push({
              text: originalLines,
              isNew: false,
            });
          }
        }

        // Add the new suggestion (clean, no markers)
        sections.push({
          text: fix.suggestion,
          isNew: true,
          reasoning: placement.reasoning,
        });

        currentLineIndex = placement.lineNumber;
      });

      // Add remaining original lines
      if (currentLineIndex < scriptLines.length) {
        const remainingLines = scriptLines.slice(currentLineIndex).join('\n');
        if (remainingLines.trim()) {
          sections.push({
            text: remainingLines,
            isNew: false,
          });
        }
      }

      // Generate clean final script (for copying)
      const cleanScript = sections.map(s => s.text).join('\n');

      setScriptSections(sections);
      setFinalScript(cleanScript);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            className="glass-card max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="p-4 border-b border-[var(--color-navy-700)] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Final Updated Script</h3>
                <p className="text-xs text-[var(--color-slate-400)] mt-1">
                  New additions are highlighted in green. Copy button copies clean text without highlights.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-primary flex items-center gap-2 text-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(finalScript);
                    alert('Script copied to clipboard!');
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
            <div className="p-4 overflow-y-auto flex-1 bg-[var(--color-navy-900)]">
              <div className="space-y-0">
                {scriptSections.map((section, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: section.isNew ? 10 : 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`relative ${
                      section.isNew
                        ? 'bg-green-500/10 border-l-4 border-green-500 pl-4 py-3 my-2'
                        : ''
                    }`}
                  >
                    {section.isNew && section.reasoning && (
                      <div className="absolute -top-6 left-0 text-xs text-green-400 italic">
                        → {section.reasoning}
                      </div>
                    )}
                    <pre className={`text-sm whitespace-pre-wrap font-mono ${
                      section.isNew
                        ? 'text-green-100'
                        : 'text-[var(--color-slate-200)]'
                    }`}>
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
