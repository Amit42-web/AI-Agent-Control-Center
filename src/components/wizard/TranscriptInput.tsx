'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, RotateCcw, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { demoTranscript, demoCSVContent } from '@/data/demoData';

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

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;

      // Parse CSV properly - handle quoted cells that may contain newlines
      const rows: string[] = [];
      let currentRow = '';
      let insideQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === '\n' && !insideQuotes) {
          if (currentRow.trim()) {
            rows.push(currentRow.trim());
          }
          currentRow = '';
        } else {
          currentRow += char;
        }
      }

      // Add last row if exists
      if (currentRow.trim()) {
        rows.push(currentRow.trim());
      }

      // Skip header row and parse transcripts
      const parsedTranscripts = rows.slice(1).map((row, index) => {
        // Remove surrounding quotes if present
        let transcriptText = row.trim();
        if (transcriptText.startsWith('"') && transcriptText.endsWith('"')) {
          transcriptText = transcriptText.slice(1, -1);
        }

        // Parse transcript based on speaker indicators
        // "setup user" = bot, phone number pattern = customer
        const lines = transcriptText.split('\n');
        const parsedLines = [];

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // Check if line starts with "setup user" (bot)
          if (trimmedLine.toLowerCase().startsWith('setup user')) {
            // Extract timestamp and text: "setup user 00:00:00 Text here"
            const match = trimmedLine.match(/setup\s+user\s+(\d{2}:\d{2}:\d{2})?\s*(.+)/i);
            if (match) {
              parsedLines.push({
                speaker: 'bot' as const,
                text: match[2] || trimmedLine,
                timestamp: match[1] || undefined,
              });
            }
          }
          // Check if line starts with phone number (customer)
          else if (/^\d{10,}/.test(trimmedLine)) {
            // Extract: "919820203664 00:00:01 Text here"
            const match = trimmedLine.match(/^(\d+)\s+(\d{2}:\d{2}:\d{2})?\s*(.+)/);
            if (match) {
              parsedLines.push({
                speaker: 'customer' as const,
                text: match[3] || trimmedLine,
                timestamp: match[2] || undefined,
              });
            }
          }
          // Fallback: try old [BOT]/[CUSTOMER] format
          else if (trimmedLine.match(/^\[?(BOT|CUSTOMER|bot|customer)\]?:?\s*(.+)$/i)) {
            const m = trimmedLine.match(/^\[?(BOT|CUSTOMER|bot|customer)\]?:?\s*(.+)$/i);
            if (m) {
              parsedLines.push({
                speaker: m[1].toLowerCase() as 'bot' | 'customer',
                text: m[2].trim(),
              });
            }
          }
        }

        return {
          id: `csv-call-${index + 1}`,
          lines: parsedLines,
          metadata: {
            date: new Date().toISOString().split('T')[0],
            source: 'csv-upload'
          },
        };
      }).filter(t => t.lines.length > 0);

      setTranscripts(parsedTranscripts);
    };

    reader.readAsText(file);
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
                <label className="btn-primary flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Upload CSV File
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={downloadDemoCSV}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Sample CSV
                </button>
              </div>

              <div className="glass-card-subtle p-4">
                <p className="text-sm text-[var(--color-slate-300)] mb-2">
                  CSV Format:
                </p>
                <ul className="text-xs text-[var(--color-slate-400)] space-y-1 ml-4 list-disc">
                  <li>Each row contains one complete call transcript</li>
                  <li>Format each message as: [BOT]: message or [CUSTOMER]: message</li>
                  <li>Example: [BOT]: Hello! [CUSTOMER]: Hi there [BOT]: How can I help?</li>
                  <li>First row should be header: &quot;transcript&quot;</li>
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
