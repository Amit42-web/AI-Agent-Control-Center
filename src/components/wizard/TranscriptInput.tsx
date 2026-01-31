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
      // Try format: [BOT/AGENT/CUSTOMER]: text
      const bracketMatch = line.match(/^\[?(BOT|AGENT|CUSTOMER|bot|agent|customer)\]?:?\s*(.+)$/i);
      if (bracketMatch) {
        const speaker = bracketMatch[1].toLowerCase();
        return {
          speaker: (speaker === 'bot' || speaker === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer',
          text: bracketMatch[2].trim(),
        };
      }

      // Try format: timestamp SPEAKER text (e.g., "00:00:00 BOT text")
      const timestampMatch = line.match(/^(\d{2}:\d{2}:\d{2})\s+(BOT|AGENT|CUSTOMER|bot|agent|customer)\s+(.+)$/i);
      if (timestampMatch) {
        const speaker = timestampMatch[2].toLowerCase();
        return {
          speaker: (speaker === 'bot' || speaker === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer',
          text: timestampMatch[3].trim(),
          timestamp: timestampMatch[1],
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
        // Remove surrounding quotes if present
        let transcriptText = row.trim();
        if (transcriptText.startsWith('"') && transcriptText.endsWith('"')) {
          transcriptText = transcriptText.slice(1, -1);
        }

        console.log(`\nParsing transcript ${index + 1}:`);
        console.log('First 200 chars:', transcriptText.substring(0, 200));

        // Parse transcript based on speaker indicators
        // Format: speaker and timestamp on one line, message on next line(s)
        // "setup user" = bot, phone number pattern = customer
        const lines = transcriptText.split('\n');
        const parsedLines = [];

        console.log(`Split into ${lines.length} lines`);

        let i = 0;
        while (i < lines.length) {
          const trimmedLine = lines[i].trim();

          // Skip empty lines and header lines (like "outbound Call to ...")
          if (!trimmedLine ||
              trimmedLine.toLowerCase().includes('outbound call') ||
              trimmedLine.toLowerCase().includes('inbound call')) {
            i++;
            continue;
          }

          let speaker: 'agent' | 'customer' | null = null;
          let timestamp: string | undefined = undefined;

          // Check format: timestamp SPEAKER text (e.g., "00:00:00 BOT text" or "00:00:00 AGENT text")
          const timestampSpeakerMatch = trimmedLine.match(/^(\d{2}:\d{2}:\d{2})\s+(BOT|AGENT|CUSTOMER|bot|agent|customer)\s+(.+)$/i);
          if (timestampSpeakerMatch) {
            const speakerStr = timestampSpeakerMatch[2].toLowerCase();
            speaker = (speakerStr === 'bot' || speakerStr === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer';
            timestamp = timestampSpeakerMatch[1];
            parsedLines.push({
              speaker,
              text: timestampSpeakerMatch[3].trim(),
              timestamp,
            });
            console.log(`Parsed ${speaker} at ${timestamp}:`, timestampSpeakerMatch[3].substring(0, 50));
            i++;
            continue;
          }

          // Check format: SPEAKER_NAME timestamp text (e.g., "Tara 00:00:22 text" or "CUSTOMER 00:00:37 text")
          // This handles cases where speaker name/label comes before the timestamp
          const speakerTimestampMatch = trimmedLine.match(/^([A-Za-z]+)\s+(\d{2}:\d{2}:\d{2})\s+(.+)$/);
          if (speakerTimestampMatch) {
            const speakerStr = speakerTimestampMatch[1].toLowerCase();
            // If speaker is explicitly "customer", map to customer; otherwise treat as agent
            speaker = (speakerStr === 'customer' ? 'customer' : 'agent') as 'agent' | 'customer';
            timestamp = speakerTimestampMatch[2];
            parsedLines.push({
              speaker,
              text: speakerTimestampMatch[3].trim(),
              timestamp,
            });
            console.log(`Parsed ${speaker} (${speakerTimestampMatch[1]}) at ${timestamp}:`, speakerTimestampMatch[3].substring(0, 50));
            i++;
            continue;
          }

          // Check if line starts with "setup user" (bot/agent)
          if (trimmedLine.toLowerCase().startsWith('setup user')) {
            speaker = 'agent';
            // Extract timestamp: "setup user  00:00:01" or "Setup User   00:00:01"
            const match = trimmedLine.match(/setup\s+user\s+(\d{2}:\d{2}:\d{2})/i);
            if (match) {
              timestamp = match[1];
            }
          }
          // Check if line starts with phone number (customer) - with optional + prefix
          else if (/^\+?\d{10,}/.test(trimmedLine)) {
            speaker = 'customer';
            // Extract timestamp: "+919525823316  00:00:13" or "919525823316  00:00:13"
            const match = trimmedLine.match(/^\+?(\d+)\s+(\d{2}:\d{2}:\d{2})/);
            if (match) {
              timestamp = match[2];
            }
          }
          // Fallback: old [BOT/AGENT]/[CUSTOMER] format on same line as text
          else if (trimmedLine.match(/^\[?(BOT|AGENT|CUSTOMER|bot|agent|customer)\]?:?\s*(.+)$/i)) {
            const m = trimmedLine.match(/^\[?(BOT|AGENT|CUSTOMER|bot|agent|customer)\]?:?\s*(.+)$/i);
            if (m) {
              const speakerStr = m[1].toLowerCase();
              parsedLines.push({
                speaker: (speakerStr === 'bot' || speakerStr === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer',
                text: m[2].trim(),
              });
              i++;
              continue;
            }
          }

          // If we found a speaker line, read the message from following lines
          if (speaker) {
            i++; // Move to next line
            const messageLines: string[] = [];

            // Collect all non-empty lines until we hit another speaker line
            while (i < lines.length) {
              const nextLine = lines[i].trim();

              // Skip empty lines
              if (!nextLine) {
                i++;
                if (messageLines.length > 0) {
                  // Empty line after collecting text - might be end of message
                  // But keep going to see if there's more
                }
                continue;
              }

              // Stop if this is a new speaker line (with optional + prefix for phone numbers)
              if (nextLine.toLowerCase().startsWith('setup user') || /^\+?\d{10,}/.test(nextLine)) {
                break;
              }

              messageLines.push(nextLine);
              i++;
            }

            // Combine message lines into one text
            const text = messageLines.join(' ').trim();

            if (text) {
              parsedLines.push({
                speaker,
                text,
                timestamp,
              });
              console.log(`Parsed ${speaker} at ${timestamp}:`, text.substring(0, 50));
            } else {
              console.warn(`Found ${speaker} line at ${timestamp} but no message text`);
            }
          } else {
            // Not a speaker line, skip it
            if (trimmedLine.length > 0) {
              console.warn('Line did not match any pattern:', trimmedLine.substring(0, 100));
            }
            i++;
          }
        }

        if (parsedLines.length === 0) {
          console.warn('No lines were parsed from transcript. First 200 chars:', transcriptText.substring(0, 200));
        } else {
          console.log(`Successfully parsed ${parsedLines.length} lines`);
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

      console.log(`\nFinal result: ${parsedTranscripts.length} valid transcripts`);
      setTranscripts(parsedTranscripts);
    };

    reader.readAsText(file);
  };

  const handleTextFilesUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log(`Loading ${files.length} text file(s)`);

    const parsedTranscripts: any[] = [];
    let filesProcessed = 0;

    Array.from(files).forEach((file, fileIndex) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const transcriptText = e.target?.result as string;

        console.log(`\nProcessing text file: ${file.name}`);
        console.log('First 200 chars:', transcriptText.substring(0, 200));

        // Parse transcript based on speaker indicators
        // Format: speaker and timestamp on one line, message on next line(s)
        const lines = transcriptText.split('\n');
        const parsedLines = [];

        console.log(`Split into ${lines.length} lines`);

        let i = 0;
        while (i < lines.length) {
          const trimmedLine = lines[i].trim();

          // Skip empty lines and header lines
          if (!trimmedLine ||
              trimmedLine.toLowerCase().includes('outbound call') ||
              trimmedLine.toLowerCase().includes('inbound call')) {
            i++;
            continue;
          }

          let speaker: 'agent' | 'customer' | null = null;
          let timestamp: string | undefined = undefined;

          // Check format: timestamp SPEAKER text (e.g., "00:00:00 BOT text" or "00:00:00 AGENT text")
          const timestampSpeakerMatch = trimmedLine.match(/^(\d{2}:\d{2}:\d{2})\s+(BOT|AGENT|CUSTOMER|bot|agent|customer)\s+(.+)$/i);
          if (timestampSpeakerMatch) {
            const speakerStr = timestampSpeakerMatch[2].toLowerCase();
            speaker = (speakerStr === 'bot' || speakerStr === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer';
            timestamp = timestampSpeakerMatch[1];
            parsedLines.push({
              speaker,
              text: timestampSpeakerMatch[3].trim(),
              timestamp,
            });
            console.log(`Parsed ${speaker} at ${timestamp}:`, timestampSpeakerMatch[3].substring(0, 50));
            i++;
            continue;
          }

          // Check format: SPEAKER_NAME timestamp text (e.g., "Tara 00:00:22 text" or "CUSTOMER 00:00:37 text")
          // This handles cases where speaker name/label comes before the timestamp
          const speakerTimestampMatch = trimmedLine.match(/^([A-Za-z]+)\s+(\d{2}:\d{2}:\d{2})\s+(.+)$/);
          if (speakerTimestampMatch) {
            const speakerStr = speakerTimestampMatch[1].toLowerCase();
            // If speaker is explicitly "customer", map to customer; otherwise treat as agent
            speaker = (speakerStr === 'customer' ? 'customer' : 'agent') as 'agent' | 'customer';
            timestamp = speakerTimestampMatch[2];
            parsedLines.push({
              speaker,
              text: speakerTimestampMatch[3].trim(),
              timestamp,
            });
            console.log(`Parsed ${speaker} (${speakerTimestampMatch[1]}) at ${timestamp}:`, speakerTimestampMatch[3].substring(0, 50));
            i++;
            continue;
          }

          // Check if line starts with "setup user" (bot/agent)
          if (trimmedLine.toLowerCase().startsWith('setup user')) {
            speaker = 'agent';
            const match = trimmedLine.match(/setup\s+user\s+(\d{2}:\d{2}:\d{2})/i);
            if (match) {
              timestamp = match[1];
            }
          }
          // Check if line starts with phone number (customer) - with optional + prefix
          else if (/^\+?\d{10,}/.test(trimmedLine)) {
            speaker = 'customer';
            const match = trimmedLine.match(/^\+?(\d+)\s+(\d{2}:\d{2}:\d{2})/);
            if (match) {
              timestamp = match[2];
            }
          }
          // Fallback: old [BOT/AGENT]/[CUSTOMER] format on same line as text
          else if (trimmedLine.match(/^\[?(BOT|AGENT|CUSTOMER|bot|agent|customer)\]?:?\s*(.+)$/i)) {
            const m = trimmedLine.match(/^\[?(BOT|AGENT|CUSTOMER|bot|agent|customer)\]?:?\s*(.+)$/i);
            if (m) {
              const speakerStr = m[1].toLowerCase();
              parsedLines.push({
                speaker: (speakerStr === 'bot' || speakerStr === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer',
                text: m[2].trim(),
              });
              i++;
              continue;
            }
          }

          // If we found a speaker line, read the message from following lines
          if (speaker) {
            i++; // Move to next line
            const messageLines: string[] = [];

            // Collect all non-empty lines until we hit another speaker line
            while (i < lines.length) {
              const nextLine = lines[i].trim();

              // Skip empty lines
              if (!nextLine) {
                i++;
                continue;
              }

              // Stop if this is a new speaker line (with optional + prefix for phone numbers)
              if (nextLine.toLowerCase().startsWith('setup user') || /^\+?\d{10,}/.test(nextLine)) {
                break;
              }

              messageLines.push(nextLine);
              i++;
            }

            // Combine message lines into one text
            const text = messageLines.join(' ').trim();

            if (text) {
              parsedLines.push({
                speaker,
                text,
                timestamp,
              });
              console.log(`Parsed ${speaker} at ${timestamp}:`, text.substring(0, 50));
            }
          } else {
            // Not a speaker line, skip it
            if (trimmedLine.length > 0) {
              console.warn('Line did not match any pattern:', trimmedLine.substring(0, 100));
            }
            i++;
          }
        }

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
          setTranscripts(parsedTranscripts);
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
                Paste transcript (format: [AGENT]: message or [CUSTOMER]: message)
              </label>
              <textarea
                className="textarea-field"
                value={transcriptText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="[AGENT]: Hello, how can I help you?&#10;[CUSTOMER]: I need help with my account..."
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
                    <li>Format: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">setup user 00:00:00 Message</code> for agent</li>
                    <li>Format: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">00:00:00 AGENT Message</code> for agent (alternate)</li>
                    <li>Format: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">AgentName 00:00:00 Message</code> for agent (name-first)</li>
                    <li>Format: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">CUSTOMER 00:00:05 Message</code> for customer</li>
                    <li>Format: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">919820203664 00:00:05 Message</code> for customer (phone)</li>
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
                    <li>Each file uses the same formats as CSV (speaker name/label, timestamp, message)</li>
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
