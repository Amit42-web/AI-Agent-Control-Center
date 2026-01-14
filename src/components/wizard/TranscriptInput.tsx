'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, RotateCcw, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { demoTranscript, demoBatchTranscripts, demoCSVContent } from '@/data/demoData';

export function TranscriptInput() {
  const { transcripts, setTranscripts } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [inputMode, setInputMode] = useState<'single' | 'batch'>('batch');

  const transcript = transcripts[0] || demoTranscript;

  const transcriptText = transcript.lines
    .map((line) => `[${line.speaker.toUpperCase()}]: ${line.text}`)
    .join('\n');

  const handleTextChange = (text: string) => {
    const lines = text.split('\n').filter((l) => l.trim());
    const parsedLines = lines.map((line) => {
      const match = line.match(/^\[?(BOT|CUSTOMER|bot|customer)\]?:?\s*(.+)$/i);
      if (match) {
        return {
          speaker: match[1].toLowerCase() as 'bot' | 'customer',
          text: match[2].trim(),
        };
      }
      return { speaker: 'customer' as const, text: line.trim() };
    });

    setTranscripts([
      {
        id: 'user-input',
        lines: parsedLines,
        metadata: { date: new Date().toISOString().split('T')[0] },
      },
    ]);
  };

  const loadDemoData = () => {
    setTranscripts(demoBatchTranscripts);
  };

  const downloadDemoCSV = () => {
    const blob = new Blob([demoCSVContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'demo_transcripts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetToDefault = () => {
    setTranscripts([demoTranscript]);
  };

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-[var(--color-navy-700)] cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Transcript Input</h3>
            <p className="text-xs text-[var(--color-slate-400)]">
              {transcripts.length} call{transcripts.length !== 1 ? 's' : ''} loaded
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {/* Mode Toggle */}
          <div className="flex items-center gap-4">
            <div className="flex bg-[var(--color-navy-800)] rounded-lg p-1">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  inputMode === 'single'
                    ? 'bg-blue-500 text-white'
                    : 'text-[var(--color-slate-400)] hover:text-white'
                }`}
                onClick={() => setInputMode('single')}
              >
                Single Transcript
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  inputMode === 'batch'
                    ? 'bg-blue-500 text-white'
                    : 'text-[var(--color-slate-400)] hover:text-white'
                }`}
                onClick={() => setInputMode('batch')}
              >
                Batch (CSV)
              </button>
            </div>

            <div className="flex-1" />

            <button
              onClick={resetToDefault}
              className="btn-secondary flex items-center gap-2 text-sm py-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>

          {inputMode === 'single' ? (
            <div className="space-y-2">
              <label className="text-sm text-[var(--color-slate-300)]">
                Paste transcript (format: [BOT]: message or [CUSTOMER]: message)
              </label>
              <textarea
                className="textarea-field"
                value={transcriptText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="[BOT]: Hello, how can I help you?&#10;[CUSTOMER]: I need help with my account..."
                rows={12}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={loadDemoData}
                  className="btn-primary flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Load Demo Dataset (5 calls)
                </button>
                <button
                  onClick={downloadDemoCSV}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Demo CSV
                </button>
              </div>

              <div className="glass-card-subtle p-4">
                <p className="text-sm text-[var(--color-slate-300)] mb-2">
                  Demo dataset includes calls with:
                </p>
                <ul className="text-xs text-[var(--color-slate-400)] space-y-1 ml-4 list-disc">
                  <li>Flow deviation (skipped verification steps)</li>
                  <li>Repetition loops (bot repeating same suggestion)</li>
                  <li>Language mismatch (customer switches to Hindi)</li>
                  <li>Mid-call restart (bot greeting again mid-conversation)</li>
                </ul>
              </div>

              {transcripts.length > 0 && (
                <div className="glass-card-subtle p-4">
                  <p className="text-sm text-green-400 mb-2">
                    Loaded {transcripts.length} calls
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {transcripts.slice(0, 5).map((t) => (
                      <span
                        key={t.id}
                        className="px-3 py-1 bg-[var(--color-navy-700)] rounded-full text-xs text-[var(--color-slate-300)]"
                      >
                        {t.id}
                      </span>
                    ))}
                    {transcripts.length > 5 && (
                      <span className="px-3 py-1 bg-[var(--color-navy-700)] rounded-full text-xs text-[var(--color-slate-400)]">
                        +{transcripts.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
