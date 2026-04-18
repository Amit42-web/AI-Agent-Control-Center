'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Download,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { EnhancedFixCard } from './EnhancedFixCard';
import { FixType, RootCauseType } from '@/types';

const fixTypeLabels: Record<FixType, string> = {
  script: 'Script/Prompt',
  training: 'Training',
  process: 'Process',
  system: 'System',
};

const rootCauseLabels: Record<RootCauseType, string> = {
  knowledge: '📚 Knowledge Gap',
  instruction: '📋 Instruction Gap',
  execution: '⚠️ Execution Failure',
  conversation: '💬 Conversation Design',
  model: '🤖 Model Limitation',
};

export function EnhancedFixesList() {
  const { enhancedFixes, referenceScript } = useAppStore();
  const [fixTypeFilter, setFixTypeFilter] = useState<FixType | 'all'>('all');
  const [rcaFilter, setRcaFilter] = useState<RootCauseType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFixIds, setSelectedFixIds] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [generatedDocument, setGeneratedDocument] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Proper null/undefined checks
  if (!enhancedFixes || !enhancedFixes.fixes || enhancedFixes.fixes.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-[var(--color-slate-400)]">No fixes available yet.</p>
      </div>
    );
  }

  const filteredFixes = enhancedFixes.fixes.filter((fix) => {
    if (fixTypeFilter !== 'all' && fix.fixType !== fixTypeFilter) return false;
    if (rcaFilter !== 'all' && fix.rootCauseType !== rcaFilter) return false;
    if (
      searchTerm &&
      !fix.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !fix.suggestedSolution?.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  const toggleFixSelection = (fixId: string) => {
    const newSelected = new Set(selectedFixIds);
    if (newSelected.has(fixId)) {
      newSelected.delete(fixId);
    } else {
      newSelected.add(fixId);
    }
    setSelectedFixIds(newSelected);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedDocument);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadDocument = () => {
    const blob = new Blob([generatedDocument], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-implementation-guide-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        className="glass-card p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-slate-400)]" />
            <input
              type="text"
              className="input-field pl-10"
              placeholder="Search fixes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Fix Type Filter */}
          <select
            className="input-field w-auto"
            value={fixTypeFilter}
            onChange={(e) => setFixTypeFilter(e.target.value as FixType | 'all')}
          >
            <option value="all">All Types</option>
            {Object.entries(fixTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* RCA Category Filter */}
          <select
            className="input-field w-auto"
            value={rcaFilter}
            onChange={(e) => setRcaFilter(e.target.value as RootCauseType | 'all')}
          >
            <option value="all">All Categories</option>
            {Object.entries(rootCauseLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <span className="text-sm text-[var(--color-slate-400)]">
            {filteredFixes.length} fix{filteredFixes.length !== 1 ? 'es' : ''}
          </span>
        </div>
      </motion.div>

      {/* Fixes List */}
      <div className="space-y-4">
        {filteredFixes.map((fix, index) => (
          <EnhancedFixCard
            key={fix.id}
            fix={fix}
            index={index}
            isSelected={selectedFixIds.has(fix.id)}
            onToggleSelect={() => toggleFixSelection(fix.id)}
          />
        ))}
      </div>

      {/* Generate Combined Document Button */}
      {selectedFixIds.size > 0 && (
        <motion.div
          className="glass-card p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {selectedFixIds.size} fix{selectedFixIds.size !== 1 ? 'es' : ''} selected
              </h3>
              <p className="text-sm text-[var(--color-slate-400)]">
                Generate a combined document with all selected fixes
              </p>
            </div>
            <button
              onClick={() => {
                const selectedFixes = enhancedFixes.fixes.filter(fix => selectedFixIds.has(fix.id));

                // Generate the final modified script with highlighted changes
                let finalScript = referenceScript || '[No reference script provided]';
                const changeLog: string[] = [];

                // Apply each fix to the script
                selectedFixes.forEach((fix, index) => {
                  if (!fix.promptFix) return;

                  const { action, targetSection, exactContent, beforeText } = fix.promptFix;

                  // Log the change
                  changeLog.push(`${index + 1}. [${action.toUpperCase()}] ${targetSection}: ${fix.title}`);

                  // Apply the change with visual markers
                  if (action === 'add') {
                    // Find target section and add content after it
                    const sectionMatch = targetSection.match(/Pillar\s+\d+|State\s+S\d+|System Prompt/i);
                    if (sectionMatch) {
                      const sectionText = sectionMatch[0];
                      const sectionIndex = finalScript.indexOf(sectionText);
                      if (sectionIndex !== -1) {
                        // Find end of that section's line
                        const lineEndIndex = finalScript.indexOf('\n', sectionIndex);
                        const insertPosition = lineEndIndex !== -1 ? lineEndIndex + 1 : finalScript.length;

                        finalScript =
                          finalScript.slice(0, insertPosition) +
                          `\n🟢 ADDED (${fix.title}):\n${exactContent}\n🟢 END ADDITION\n\n` +
                          finalScript.slice(insertPosition);
                      }
                    }
                  } else if (action === 'replace' && beforeText) {
                    // Replace old content with new, showing both
                    if (finalScript.includes(beforeText)) {
                      finalScript = finalScript.replace(
                        beforeText,
                        `🔴 REMOVED:\n${beforeText}\n🔴 END REMOVAL\n\n🟢 REPLACED WITH (${fix.title}):\n${exactContent}\n🟢 END REPLACEMENT`
                      );
                    } else {
                      // If exact text not found, append at the end with note
                      finalScript += `\n\n⚠️ Could not find exact text to replace for: ${fix.title}\n🟢 ADDED INSTEAD:\n${exactContent}\n🟢 END ADDITION\n`;
                    }
                  } else if (action === 'remove' && beforeText) {
                    // Mark content as removed
                    if (finalScript.includes(beforeText)) {
                      finalScript = finalScript.replace(
                        beforeText,
                        `🔴 REMOVED (${fix.title}):\n${beforeText}\n🔴 END REMOVAL`
                      );
                    }
                  }
                });

                // Build the complete document
                let combinedDocument = `${'═'.repeat(79)}\n`;
                combinedDocument += `  FINAL MODIFIED SCRIPT - ${selectedFixes.length} Fix${selectedFixes.length !== 1 ? 'es' : ''} Applied\n`;
                combinedDocument += `  Generated: ${new Date().toLocaleString()}\n`;
                combinedDocument += `${'═'.repeat(79)}\n\n`;

                combinedDocument += `CHANGES APPLIED:\n\n`;
                changeLog.forEach(log => {
                  combinedDocument += `${log}\n`;
                });

                combinedDocument += `\n${'═'.repeat(79)}\n`;
                combinedDocument += `  MODIFIED SCRIPT WITH HIGHLIGHTED CHANGES\n`;
                combinedDocument += `  🟢 = Added/Replaced content  |  🔴 = Removed content\n`;
                combinedDocument += `${'═'.repeat(79)}\n\n`;

                combinedDocument += finalScript;

                combinedDocument += `\n\n${'═'.repeat(79)}\n`;
                combinedDocument += `  IMPLEMENTATION NOTES\n`;
                combinedDocument += `${'═'.repeat(79)}\n\n`;

                combinedDocument += `To apply these changes:\n`;
                combinedDocument += `1. Copy the modified script above\n`;
                combinedDocument += `2. Remove the visual markers (🟢 ADDED, 🔴 REMOVED, etc.)\n`;
                combinedDocument += `3. Keep only the green (added) content\n`;
                combinedDocument += `4. Remove the red (removed) content\n`;
                combinedDocument += `5. Test the modified script\n\n`;

                selectedFixes.forEach((fix, index) => {
                  if (fix.howToTest) {
                    combinedDocument += `\nTest for Fix #${index + 1} (${fix.title}):\n${fix.howToTest}\n`;
                  }
                });

                setGeneratedDocument(combinedDocument);
                setShowPreview(true);
              }}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Generate Implementation Guide
            </button>
          </div>
        </motion.div>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            const content = {
              enhancedFixes: enhancedFixes.fixes,
              exportedAt: new Date().toISOString(),
            };
            const blob = new Blob([JSON.stringify(content, null, 2)], {
              type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'rca_categorized_fixes.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export Fixes
        </button>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              className="glass-card max-w-4xl w-full max-h-[90vh] flex flex-col"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div>
                  <h2 className="text-2xl font-bold text-white">Implementation Guide Preview</h2>
                  <p className="text-sm text-[var(--color-slate-400)] mt-1">
                    {selectedFixIds.size} fix{selectedFixIds.size !== 1 ? 'es' : ''} selected
                  </p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-[var(--color-slate-400)]" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm bg-black/20 p-4 rounded-lg font-mono"
                    dangerouslySetInnerHTML={{
                      __html: generatedDocument
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/🟢 ADDED \((.*?)\):/g, '<span style="background-color: #065f46; color: #d1fae5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">✅ ADDED ($1):</span>')
                        .replace(/🟢 REPLACED WITH \((.*?)\):/g, '<span style="background-color: #065f46; color: #d1fae5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">✅ REPLACED WITH ($1):</span>')
                        .replace(/🟢 END ADDITION/g, '<span style="color: #4ade80;">━━━━━ END ADDITION ━━━━━</span>')
                        .replace(/🟢 END REPLACEMENT/g, '<span style="color: #4ade80;">━━━━━ END REPLACEMENT ━━━━━</span>')
                        .replace(/🔴 REMOVED \((.*?)\):/g, '<span style="background-color: #7f1d1d; color: #fecaca; padding: 2px 6px; border-radius: 3px; font-weight: bold; text-decoration: line-through;">❌ REMOVED ($1):</span>')
                        .replace(/🔴 END REMOVAL/g, '<span style="color: #f87171; text-decoration: line-through;">━━━━━ END REMOVAL ━━━━━</span>')
                        .replace(/⚠️ Could not find exact text/g, '<span style="background-color: #78350f; color: #fef3c7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">⚠️ Could not find exact text</span>')
                        .replace(/🟢 ADDED INSTEAD:/g, '<span style="background-color: #065f46; color: #d1fae5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">✅ ADDED INSTEAD:</span>')
                    }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                <button
                  onClick={copyToClipboard}
                  className="btn-secondary flex items-center gap-2"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy to Clipboard
                    </>
                  )}
                </button>
                <button
                  onClick={downloadDocument}
                  className="btn-primary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Implementation Guide
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
