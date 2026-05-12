'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, RotateCcw, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { demoTranscript, demoCSVContent } from '@/data/demoData';

type ParsedLine = { speaker: 'bot' | 'customer'; text: string; timestamp?: string };

function parseTranscriptText(transcriptText: string): ParsedLine[] {
  const lines = transcriptText.split('\n');
  const parsedLines: ParsedLine[] = [];

  let i = 0;
  while (i < lines.length) {
    const trimmedLine = lines[i].trim();

    if (
      !trimmedLine ||
      trimmedLine.toLowerCase().includes('outbound call') ||
      trimmedLine.toLowerCase().includes('inbound call')
    ) {
      i++;
      continue;
    }

    // Format 1: [HH:MM] Speaker Name: message  (all on one line)
    const bracketTimestamp = trimmedLine.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s+(.+?):\s*(.+)$/);
    if (bracketTimestamp) {
      const [, timestamp, speakerName, text] = bracketTimestamp;
      const speaker = speakerName.trim().toLowerCase() === 'customer' ? 'customer' : 'bot';
      parsedLines.push({ speaker, text: text.trim(), timestamp });
      i++;
      continue;
    }

    // Format 2: [BOT]: message  or  [CUSTOMER]: message  (on same line)
    const bracketLabel = trimmedLine.match(/^\[?(BOT|CUSTOMER)\]?:?\s*(.+)$/i);
    if (bracketLabel) {
      parsedLines.push({
        speaker: bracketLabel[1].toLowerCase() as 'bot' | 'customer',
        text: bracketLabel[2].trim(),
      });
      i++;
      continue;
    }

    // Format 3: "setup user HH:MM:SS" for bot  /  phone number HH:MM:SS for customer
    // Speaker header on one line, message text on the following line(s)
    let speaker: 'bot' | 'customer' | null = null;
    let timestamp: string | undefined;

    if (trimmedLine.toLowerCase().startsWith('setup user')) {
      speaker = 'bot';
      const m = trimmedLine.match(/setup\s+user\s+(\d{2}:\d{2}:\d{2})/i);
      if (m) timestamp = m[1];
    } else if (/^\d{10,}/.test(trimmedLine)) {
      speaker = 'customer';
      const m = trimmedLine.match(/^(\d+)\s+(\d{2}:\d{2}:\d{2})/);
      if (m) timestamp = m[2];
    }

    if (speaker) {
      i++;
      const messageLines: string[] = [];
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next) { i++; continue; }
        if (
          next.toLowerCase().startsWith('setup user') ||
          /^\d{10,}/.test(next) ||
          /^\[\d{1,2}:\d{2}/.test(next)
        ) break;
        messageLines.push(next);
        i++;
      }
      const text = messageLines.join(' ').trim();
      if (text) parsedLines.push({ speaker, text, timestamp });
    } else {
      if (trimmedLine.length > 0) {
        console.warn('Line did not match any pattern:', trimmedLine.substring(0, 100));
      }
      i++;
    }
  }

  return parsedLines;
}

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

    // Reset input so same file can be re-uploaded
    event.target.value = '';

    const reader = new FileReader();
    reader.onerror = () => {
      alert(`Failed to read file "${file.name}". Please try again.`);
    };
    reader.onload = (e) => {
      try {
      const text = e.target?.result as string;

      console.log('CSV file loaded, total length:', text.length);

      // Parse CSV properly - handle quoted cells that may contain newlines
      const rows: string[] = [];
      let currentRow = '';
      let insideQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
          // Handle escaped quotes ""
          if (nextChar === '"') {
            currentRow += '"';
            i++; // Skip next quote
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
          if (currentRow.trim()) {
            rows.push(currentRow.trim());
          }
          currentRow = '';
          // Skip \r\n combination
          if (char === '\r' && nextChar === '\n') {
            i++;
          }
        } else if (char !== '\r') { // Skip standalone \r
          currentRow += char;
        }
      }

      // Add last row if exists
      if (currentRow.trim()) {
        rows.push(currentRow.trim());
      }

      console.log(`Parsed ${rows.length} rows from CSV (including header)`);

      // Skip header row and parse transcripts
      const parsedTranscripts = rows.slice(1).map((row, index) => {
        let transcriptText = row.trim();
        if (transcriptText.startsWith('"') && transcriptText.endsWith('"')) {
          transcriptText = transcriptText.slice(1, -1);
        }

        console.log(`\nParsing transcript ${index + 1}, first 200 chars:`, transcriptText.substring(0, 200));

        const parsedLines = parseTranscriptText(transcriptText);
        console.log(`Parsed ${parsedLines.length} lines from transcript ${index + 1}`);

        return {
          id: `csv-call-${index + 1}`,
          lines: parsedLines,
          metadata: { date: new Date().toISOString().split('T')[0], source: 'csv-upload' },
        };
      }).filter(t => t.lines.length > 0);

      console.log(`\nFinal result: ${parsedTranscripts.length} valid transcripts`);

      if (parsedTranscripts.length === 0) {
        alert(
          `No valid transcripts found in "${file.name}".\n\n` +
          `Supported formats:\n` +
          `• [HH:MM] Speaker Name: message\n` +
          `• [BOT]: message  /  [CUSTOMER]: message\n` +
          `• setup user HH:MM:SS (then message on next line)\n` +
          `• 91XXXXXXXXXX HH:MM:SS (phone number, then message on next line)\n\n` +
          `Download the sample CSV to see an example.`
        );
        return;
      }

      setTranscripts(parsedTranscripts);
      } catch (err) {
        console.error('CSV parse error:', err);
        alert(`Error parsing "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    reader.readAsText(file);
  };

  const handleTextFilesUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Reset input so same files can be re-uploaded
    event.target.value = '';

    console.log(`Loading ${files.length} text file(s)`);

    const parsedTranscripts: any[] = [];
    let filesProcessed = 0;

    Array.from(files).forEach((file, fileIndex) => {
      const reader = new FileReader();
      reader.onerror = () => {
        alert(`Failed to read file "${file.name}". Please try again.`);
      };
      reader.onload = (e) => {
        try {
        const transcriptText = e.target?.result as string;

        console.log(`\nProcessing text file: ${file.name}`);
        const parsedLines = parseTranscriptText(transcriptText);
        console.log(`Parsed ${parsedLines.length} lines from ${file.name}`);

        if (parsedLines.length > 0) {
          parsedTranscripts.push({
            id: `txt-call-${fileIndex + 1}`,
            lines: parsedLines,
            metadata: {
              date: new Date().toISOString().split('T')[0],
              source: 'txt-upload',
              filename: file.name,
            },
          });
          console.log(`Successfully parsed ${parsedLines.length} lines from ${file.name}`);
        } else {
          console.warn(`No lines were parsed from ${file.name}`);
        }

        filesProcessed++;
        if (filesProcessed === files.length) {
          console.log(`\nAll files processed. Total transcripts: ${parsedTranscripts.length}`);
          if (parsedTranscripts.length === 0) {
            alert(
              `No valid transcripts found in the uploaded file(s).\n\n` +
              `Supported formats:\n` +
              `• [HH:MM] Speaker Name: message\n` +
              `• [BOT]: message  /  [CUSTOMER]: message\n` +
              `• setup user HH:MM:SS (then message on next line)\n` +
              `• 91XXXXXXXXXX HH:MM:SS (phone number, then message on next line)`
            );
          } else {
            setTranscripts(parsedTranscripts);
          }
        }
        } catch (err) {
          console.error(`Parse error for "${file.name}":`, err);
          alert(`Error parsing "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      };

      reader.readAsText(file);
    });
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
              <div className="flex items-center gap-4 flex-wrap">
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

                <label className="btn-primary flex items-center gap-2 cursor-pointer">
                  <FileText className="w-4 h-4" />
                  Upload Text Files
                  <input
                    type="file"
                    accept=".txt"
                    multiple
                    onChange={handleTextFilesUpload}
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

              <div className="glass-card-subtle p-4 space-y-3">
                <div>
                  <p className="text-sm text-[var(--color-slate-300)] mb-2 font-medium">
                    CSV Format:
                  </p>
                  <ul className="text-xs text-[var(--color-slate-400)] space-y-1 ml-4 list-disc">
                    <li>One row = one complete call (multi-line transcripts in ONE cell)</li>
                    <li>Format: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">setup user 00:00:00 Message</code> for bot</li>
                    <li>Format: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">919820203664 00:00:05 Message</code> for customer</li>
                    <li>First row should be header: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">Transcript</code></li>
                  </ul>
                </div>
                <div className="border-t border-[var(--color-navy-700)] pt-3">
                  <p className="text-sm text-[var(--color-slate-300)] mb-2 font-medium">
                    Text Files Format:
                  </p>
                  <ul className="text-xs text-[var(--color-slate-400)] space-y-1 ml-4 list-disc">
                    <li>One .txt file = one complete call transcript</li>
                    <li>You can upload multiple .txt files at once</li>
                    <li>Each file uses the same format as CSV cells (setup user / phone number)</li>
                    <li>Multi-line content is supported within each file</li>
                  </ul>
                </div>
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
