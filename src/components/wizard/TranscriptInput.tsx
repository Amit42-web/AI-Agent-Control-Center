'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, RotateCcw, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { demoTranscript, demoCSVContent } from '@/data/demoData';
import { deduplicateTranscriptLines } from '@/services/openai';
import type { Transcript } from '@/types';

export function TranscriptInput() {
  const { transcripts, setTranscripts, deduplicationEnabled, openaiConfig } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [inputMode, setInputMode] = useState<'single' | 'batch'>('batch');
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const transcript = transcripts[0] || demoTranscript;

  /**
   * Helper function to deduplicate transcripts using LLM
   * Returns deduplicated transcripts or original on error/disabled
   */
  const deduplicateTranscripts = async (transcriptsToProcess: Transcript[]): Promise<Transcript[]> => {
    // If deduplication is disabled, return original transcripts
    if (!deduplicationEnabled) {
      console.log('[Deduplication] Disabled - skipping');
      return transcriptsToProcess;
    }

    // Get API key from environment variable
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

    if (!apiKey || apiKey.trim().length === 0) {
      console.warn('[Deduplication] No API key available - skipping');
      return transcriptsToProcess;
    }

    console.log(`[Deduplication] Processing ${transcriptsToProcess.length} transcript(s)`);

    // Process each transcript independently
    const deduplicatedTranscripts = await Promise.all(
      transcriptsToProcess.map(async (transcript) => {
        try {
          if (transcript.lines.length === 0) {
            return transcript;
          }

          console.log(`[Deduplication] Processing transcript ${transcript.id} with ${transcript.lines.length} lines`);

          const deduplicatedLines = await deduplicateTranscriptLines(
            apiKey,
            openaiConfig.model,
            transcript.lines
          );

          console.log(`[Deduplication] ${transcript.id}: ${transcript.lines.length} → ${deduplicatedLines.length} lines`);

          return {
            ...transcript,
            lines: deduplicatedLines,
          };
        } catch (error) {
          console.error(`[Deduplication] Error processing transcript ${transcript.id}:`, error);
          // On error, return original transcript
          return transcript;
        }
      })
    );

    return deduplicatedTranscripts;
  };

  const transcriptText = transcript.lines
    .map((line) => `[${line.speaker.toUpperCase()}]: ${line.text}`)
    .join('\n');

  const handleTextChange = async (text: string) => {
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

    const parsedTranscripts = [
      {
        id: 'user-input',
        lines: parsedLines,
        metadata: { date: new Date().toISOString().split('T')[0] },
      },
    ];

    // Apply deduplication if enabled
    const finalTranscripts = await deduplicateTranscripts(parsedTranscripts);
    setTranscripts(finalTranscripts);
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setUploadStatus({ type: 'error', message: 'No files selected. Please select one or more CSV files to upload.' });
      return;
    }

    // Clear any previous status messages
    setUploadStatus({ type: null, message: '' });

    console.log(`Loading ${files.length} CSV file(s)`);

    const allParsedTranscripts: any[] = [];
    let filesProcessed = 0;
    let filesWithErrors = 0;
    let totalTranscriptsFromAllFiles = 0;

    Array.from(files).forEach((file, fileIndex) => {
      const reader = new FileReader();

      reader.onerror = () => {
        console.error(`Failed to read CSV file: ${file.name}`);
        filesWithErrors++;
        filesProcessed++;
        if (filesProcessed === files.length) {
          if (allParsedTranscripts.length === 0) {
            setUploadStatus({
              type: 'error',
              message: `Failed to read ${filesWithErrors} CSV file${filesWithErrors !== 1 ? 's' : ''}. Please try again or select different files.`
            });
          } else {
            // Combine existing transcripts with newly parsed ones
            const combinedTranscripts = [...transcripts, ...allParsedTranscripts];
            deduplicateTranscripts(combinedTranscripts).then((finalTranscripts) => {
              setTranscripts(finalTranscripts);
              setUploadStatus({
                type: 'error',
                message: `Loaded ${finalTranscripts.length} transcript${finalTranscripts.length !== 1 ? 's' : ''} from ${files.length - filesWithErrors} CSV file${files.length - filesWithErrors !== 1 ? 's' : ''}, but failed to read ${filesWithErrors} file${filesWithErrors !== 1 ? 's' : ''}.`
              });
            }).catch((error) => {
              console.error('[CSV Upload] Deduplication failed in error handler, using original transcripts:', error);
              const combinedTranscripts = [...transcripts, ...allParsedTranscripts];
              setTranscripts(combinedTranscripts);
              setUploadStatus({
                type: 'error',
                message: `Loaded ${combinedTranscripts.length} transcript${combinedTranscripts.length !== 1 ? 's' : ''} from ${files.length - filesWithErrors} CSV file${files.length - filesWithErrors !== 1 ? 's' : ''}, but failed to read ${filesWithErrors} file${filesWithErrors !== 1 ? 's' : ''}.`
              });
            });
          }
          event.target.value = '';
        }
      };

      reader.onload = (e) => {
        const text = e.target?.result as string;

        if (!text || text.trim().length === 0) {
          console.warn(`CSV file ${file.name} is empty`);
          filesWithErrors++;
          filesProcessed++;
          if (filesProcessed === files.length) {
            if (allParsedTranscripts.length === 0) {
              setUploadStatus({
                type: 'error',
                message: 'All selected CSV files are empty. Please select files with valid transcript data.'
              });
            } else {
              // Combine existing transcripts with newly parsed ones
              const combinedTranscripts = [...transcripts, ...allParsedTranscripts];
              deduplicateTranscripts(combinedTranscripts).then((finalTranscripts) => {
                setTranscripts(finalTranscripts);
                setUploadStatus({
                  type: 'error',
                  message: `Loaded ${finalTranscripts.length} transcript${finalTranscripts.length !== 1 ? 's' : ''} from ${files.length - filesWithErrors} file${files.length - filesWithErrors !== 1 ? 's' : ''}, but ${filesWithErrors} file${filesWithErrors !== 1 ? 's were' : ' was'} empty.`
                });
              }).catch((error) => {
                console.error('[CSV Upload] Deduplication failed in empty file handler, using original transcripts:', error);
                const combinedTranscripts = [...transcripts, ...allParsedTranscripts];
                setTranscripts(combinedTranscripts);
                setUploadStatus({
                  type: 'error',
                  message: `Loaded ${combinedTranscripts.length} transcript${combinedTranscripts.length !== 1 ? 's' : ''} from ${files.length - filesWithErrors} file${files.length - filesWithErrors !== 1 ? 's' : ''}, but ${filesWithErrors} file${filesWithErrors !== 1 ? 's were' : ' was'} empty.`
                });
              });
            }
            event.target.value = '';
          }
          return;
        }

        console.log(`CSV file ${file.name} loaded, total length:`, text.length);

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

      if (rows.length <= 1) {
        setUploadStatus({ type: 'error', message: 'No valid data found in the CSV file. Please ensure the file has a header row and at least one transcript row.' });
        event.target.value = '';
        return;
      }

      // Skip header row and parse transcripts
      const parsedTranscripts = rows.slice(1).map((row, index) => {
        // Split row into columns (meeting id, transcript)
        // Handle CSV format with comma separator, respecting quotes
        const columns: string[] = [];
        let currentColumn = '';
        let insideQuotes = false;

        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          const nextChar = row[i + 1];

          if (char === '"') {
            if (nextChar === '"') {
              currentColumn += '"';
              i++; // Skip next quote
            } else {
              insideQuotes = !insideQuotes;
            }
          } else if (char === ',' && !insideQuotes) {
            columns.push(currentColumn.trim());
            currentColumn = '';
          } else {
            currentColumn += char;
          }
        }
        columns.push(currentColumn.trim()); // Add last column

        // Extract meeting ID and transcript text
        let meetingId = columns[0] || `csv-call-${index + 1}`;
        let transcriptText = columns[1] || columns[0]; // Fallback to first column if no second column

        // Remove surrounding quotes if present
        meetingId = meetingId.replace(/^"(.*)"$/, '$1').trim();
        if (transcriptText.startsWith('"') && transcriptText.endsWith('"')) {
          transcriptText = transcriptText.slice(1, -1);
        }

        console.log(`\nParsing transcript ${index + 1}:`);
        console.log('Meeting ID:', meetingId);
        console.log('First 200 chars:', transcriptText.substring(0, 200));

        // Multi-format parser supporting various transcript formats
        const lines = transcriptText.split('\n');
        const parsedLines = [];

        for (let i = 0; i < lines.length; i++) {
          const trimmedLine = lines[i].trim();

          // Skip empty lines and header lines
          if (!trimmedLine ||
              trimmedLine.toLowerCase().includes('outbound call') ||
              trimmedLine.toLowerCase().includes('inbound call')) {
            continue;
          }

          let speaker: 'agent' | 'customer' | null = null;
          let timestamp: string | undefined;
          let messageText = '';

          // FORMAT 1: HH:MM:SS SPEAKER message (new simple format)
          const format1 = trimmedLine.match(/^(\d{2}:\d{2}:\d{2})\s+(AGENT|CUSTOMER|BOT|agent|customer|bot)\s+(.+)$/i);
          if (format1) {
            timestamp = format1[1];
            const speakerStr = format1[2].toLowerCase();
            speaker = (speakerStr === 'bot' || speakerStr === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer';
            messageText = format1[3].trim();

            // Clean up embedded speaker+timestamp patterns
            messageText = messageText.replace(/\b([A-Za-z]+|\+?\d+)\s+\d{2}:\d{2}:\d{2}\b/g, '').trim();
            messageText = messageText.replace(/\s+/g, ' ').trim();

            if (messageText) {
              parsedLines.push({ speaker, text: messageText, timestamp });
              console.log(`[Format 1] Parsed ${speaker} at ${timestamp}:`, messageText.substring(0, 50));
            }
            continue;
          }

          // FORMAT 3: setup user HH:MM:SS (agent, message on next line)
          const format2 = trimmedLine.match(/setup\s+user\s+(\d{2}:\d{2}:\d{2})/i);
          if (format2) {
            speaker = 'agent';
            timestamp = format2[1];
            // Read message from next line(s)
            i++;
            const messageLines: string[] = [];
            while (i < lines.length) {
              const nextLine = lines[i].trim();
              if (!nextLine) {
                i++;
                continue;
              }
              // Check if this is another speaker line
              if (nextLine.match(/setup\s+user\s+\d{2}:\d{2}:\d{2}/i) ||
                  nextLine.match(/^\+?\d{10,}\s+\d{2}:\d{2}:\d{2}/) ||
                  nextLine.match(/^\d{2}:\d{2}:\d{2}\s+(AGENT|CUSTOMER|BOT)/i)) {
                i--;
                break;
              }
              messageLines.push(nextLine);
              i++;
              // Only take one line for message (can be adjusted if multi-line needed)
              break;
            }
            messageText = messageLines.join(' ').trim();
            if (messageText) {
              parsedLines.push({ speaker, text: messageText, timestamp });
              console.log(`[Format 2] Parsed ${speaker} at ${timestamp}:`, messageText.substring(0, 50));
            }
            continue;
          }

          // FORMAT 4: phone number HH:MM:SS (customer, message on next line)
          const format3 = trimmedLine.match(/^\+?(\d{10,})\s+(\d{2}:\d{2}:\d{2})/);
          if (format3) {
            speaker = 'customer';
            timestamp = format3[2];
            // Read message from next line(s)
            i++;
            const messageLines: string[] = [];
            while (i < lines.length) {
              const nextLine = lines[i].trim();
              if (!nextLine) {
                i++;
                continue;
              }
              // Check if this is another speaker line
              if (nextLine.match(/setup\s+user\s+\d{2}:\d{2}:\d{2}/i) ||
                  nextLine.match(/^\+?\d{10,}\s+\d{2}:\d{2}:\d{2}/) ||
                  nextLine.match(/^\d{2}:\d{2}:\d{2}\s+(AGENT|CUSTOMER|BOT)/i)) {
                i--;
                break;
              }
              messageLines.push(nextLine);
              i++;
              // Only take one line for message
              break;
            }
            messageText = messageLines.join(' ').trim();
            if (messageText) {
              parsedLines.push({ speaker, text: messageText, timestamp });
              console.log(`[Format 3] Parsed ${speaker} at ${timestamp}:`, messageText.substring(0, 50));
            }
            continue;
          }

          // FORMAT 5: [SPEAKER]: message or SPEAKER: message
          const format4 = trimmedLine.match(/^\[?(BOT|AGENT|CUSTOMER|bot|agent|customer)\]?:?\s*(.+)$/i);
          if (format4) {
            const speakerStr = format4[1].toLowerCase();
            speaker = (speakerStr === 'bot' || speakerStr === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer';
            messageText = format4[2].trim();
            timestamp = undefined; // No timestamp in this format
            if (messageText) {
              parsedLines.push({ speaker, text: messageText, timestamp });
              console.log(`[Format 4] Parsed ${speaker}:`, messageText.substring(0, 50));
            }
            continue;
          }

          // No format matched
          console.warn('Line did not match any supported format:', trimmedLine.substring(0, 100));
        }

        if (parsedLines.length === 0) {
          console.warn('No lines were parsed from transcript. First 200 chars:', transcriptText.substring(0, 200));
        } else {
          console.log(`Successfully parsed ${parsedLines.length} lines`);
        }

        return {
          id: meetingId,
          lines: parsedLines,
          metadata: {
            date: new Date().toISOString().split('T')[0],
            source: 'csv-upload',
            meetingId: meetingId
          },
        };
      }).filter(t => t.lines.length > 0);

      console.log(`\nFinal result: ${parsedTranscripts.length} valid transcripts`);

      if (parsedTranscripts.length === 0) {
        setUploadStatus({
          type: 'error',
          message: 'No valid transcripts could be parsed from the CSV file. Please check that your file matches one of the supported formats (see format guide below).'
        });
        event.target.value = '';
        return;
      }

        // Add transcripts from this CSV to the collection
        allParsedTranscripts.push(...parsedTranscripts);
        totalTranscriptsFromAllFiles += parsedTranscripts.length;
        filesProcessed++;

        console.log(`Processed CSV file ${fileIndex + 1}/${files.length}: ${parsedTranscripts.length} transcripts`);

        // Check if all files have been processed
        if (filesProcessed === files.length) {
          console.log(`All ${files.length} CSV files processed. Total transcripts: ${totalTranscriptsFromAllFiles}`);

          // Combine existing transcripts with newly parsed ones
          const combinedTranscripts = [...transcripts, ...allParsedTranscripts];
          console.log(`Combined ${transcripts.length} existing + ${allParsedTranscripts.length} new = ${combinedTranscripts.length} total transcripts`);

          // Apply deduplication if enabled
          deduplicateTranscripts(combinedTranscripts).then((finalTranscripts) => {
            setTranscripts(finalTranscripts);
            setUploadStatus({
              type: 'success',
              message: `Successfully loaded ${allParsedTranscripts.length} new transcript${allParsedTranscripts.length !== 1 ? 's' : ''}. Total: ${finalTranscripts.length} transcript${finalTranscripts.length !== 1 ? 's' : ''}.`
            });
            // Reset the file input so the same files can be uploaded again if needed
            event.target.value = '';
          }).catch((error) => {
            console.error('[CSV Upload] Deduplication failed, using original transcripts:', error);
            setTranscripts(combinedTranscripts);
            setUploadStatus({
              type: 'success',
              message: `Successfully loaded ${allParsedTranscripts.length} new transcript${allParsedTranscripts.length !== 1 ? 's' : ''}. Total: ${combinedTranscripts.length} transcript${combinedTranscripts.length !== 1 ? 's' : ''}.`
            });
            event.target.value = '';
          });
        }
      };

      reader.readAsText(file);
    });
  };

  const handleTextFilesUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setUploadStatus({ type: 'error', message: 'No files selected. Please select one or more .txt files to upload.' });
      return;
    }

    // Clear any previous status messages
    setUploadStatus({ type: null, message: '' });

    console.log(`Loading ${files.length} text file(s)`);

    const parsedTranscripts: any[] = [];
    let filesProcessed = 0;
    let filesWithErrors = 0;

    Array.from(files).forEach((file, fileIndex) => {
      const reader = new FileReader();

      reader.onerror = () => {
        console.error(`Failed to read file: ${file.name}`);
        filesWithErrors++;
        filesProcessed++;
        if (filesProcessed === files.length) {
          if (parsedTranscripts.length === 0) {
            setUploadStatus({
              type: 'error',
              message: `Failed to read ${filesWithErrors} file${filesWithErrors !== 1 ? 's' : ''}. Please try again or select different files.`
            });
          } else {
            // Apply deduplication if enabled
            deduplicateTranscripts(parsedTranscripts).then((finalTranscripts) => {
              setTranscripts(finalTranscripts);
              setUploadStatus({
                type: 'error',
                message: `Loaded ${finalTranscripts.length} transcript${finalTranscripts.length !== 1 ? 's' : ''}, but failed to read ${filesWithErrors} file${filesWithErrors !== 1 ? 's' : ''}.`
              });
            }).catch((error) => {
              console.error('[TXT Upload] Deduplication failed in error handler, using original transcripts:', error);
              setTranscripts(parsedTranscripts);
              setUploadStatus({
                type: 'error',
                message: `Loaded ${parsedTranscripts.length} transcript${parsedTranscripts.length !== 1 ? 's' : ''}, but failed to read ${filesWithErrors} file${filesWithErrors !== 1 ? 's' : ''}.`
              });
            });
          }
          event.target.value = '';
        }
      };

      reader.onload = (e) => {
        const transcriptText = e.target?.result as string;

        if (!transcriptText || transcriptText.trim().length === 0) {
          console.warn(`File ${file.name} is empty`);
          filesWithErrors++;
          filesProcessed++;
          if (filesProcessed === files.length) {
            if (parsedTranscripts.length === 0) {
              setUploadStatus({
                type: 'error',
                message: 'All selected files are empty. Please select files with valid transcript data.'
              });
            } else {
              // Apply deduplication if enabled
              deduplicateTranscripts(parsedTranscripts).then((finalTranscripts) => {
                setTranscripts(finalTranscripts);
                setUploadStatus({
                  type: 'error',
                  message: `Loaded ${finalTranscripts.length} transcript${finalTranscripts.length !== 1 ? 's' : ''}, but ${filesWithErrors} file${filesWithErrors !== 1 ? 's were' : ' was'} empty.`
                });
              }).catch((error) => {
                console.error('[TXT Upload] Deduplication failed in empty file handler, using original transcripts:', error);
                setTranscripts(parsedTranscripts);
                setUploadStatus({
                  type: 'error',
                  message: `Loaded ${parsedTranscripts.length} transcript${parsedTranscripts.length !== 1 ? 's' : ''}, but ${filesWithErrors} file${filesWithErrors !== 1 ? 's were' : ' was'} empty.`
                });
              });
            }
            event.target.value = '';
          }
          return;
        }

        console.log(`\nProcessing text file: ${file.name}`);
        console.log('First 200 chars:', transcriptText.substring(0, 200));

        // Multi-format parser supporting various transcript formats
        const lines = transcriptText.split('\n');
        const parsedLines = [];

        for (let i = 0; i < lines.length; i++) {
          const trimmedLine = lines[i].trim();

          // Skip empty lines and header lines
          if (!trimmedLine ||
              trimmedLine.toLowerCase().includes('outbound call') ||
              trimmedLine.toLowerCase().includes('inbound call')) {
            continue;
          }

          let speaker: 'agent' | 'customer' | null = null;
          let timestamp: string | undefined;
          let messageText = '';

          // FORMAT 1: [HH:MM:SS] or [MM:SS] Speaker Name: message (bracketed timestamp format)
          const format1Bracketed = trimmedLine.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.+)$/);
          if (format1Bracketed) {
            timestamp = format1Bracketed[1];
            const speakerName = format1Bracketed[2].trim().toLowerCase();
            messageText = format1Bracketed[3].trim();

            // Detect speaker type from name
            // Agent indicators: bot, agent, meera, assistant, representative, rep, support, operator
            // Customer indicators: customer, caller, user, client
            if (speakerName.includes('bot') ||
                speakerName.includes('agent') ||
                speakerName.includes('meera') ||
                speakerName.includes('assistant') ||
                speakerName.includes('representative') ||
                speakerName.includes('rep') ||
                speakerName.includes('support') ||
                speakerName.includes('operator') ||
                /^[a-z]+\s*r?\d+$/i.test(speakerName)) { // Pattern like "Meera R5"
              speaker = 'agent';
            } else if (speakerName.includes('customer') ||
                       speakerName.includes('caller') ||
                       speakerName.includes('user') ||
                       speakerName.includes('client')) {
              speaker = 'customer';
            } else {
              // Default to customer if unclear
              speaker = 'customer';
            }

            if (messageText && speaker) {
              parsedLines.push({ speaker, text: messageText, timestamp });
              console.log(`[Format 1 Bracketed] Parsed ${speaker} (${speakerName}) at ${timestamp}:`, messageText.substring(0, 50));
            }
            continue;
          }

          // FORMAT 2: HH:MM:SS SPEAKER message (simple format)
          const format1 = trimmedLine.match(/^(\d{2}:\d{2}:\d{2})\s+(AGENT|CUSTOMER|BOT|agent|customer|bot)\s+(.+)$/i);
          if (format1) {
            timestamp = format1[1];
            const speakerStr = format1[2].toLowerCase();
            speaker = (speakerStr === 'bot' || speakerStr === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer';
            messageText = format1[3].trim();

            // Clean up embedded speaker+timestamp patterns
            messageText = messageText.replace(/\b([A-Za-z]+|\+?\d+)\s+\d{2}:\d{2}:\d{2}\b/g, '').trim();
            messageText = messageText.replace(/\s+/g, ' ').trim();

            if (messageText) {
              parsedLines.push({ speaker, text: messageText, timestamp });
              console.log(`[Format 1] Parsed ${speaker} at ${timestamp}:`, messageText.substring(0, 50));
            }
            continue;
          }

          // FORMAT 3: setup user HH:MM:SS (agent, message on next line)
          const format2 = trimmedLine.match(/setup\s+user\s+(\d{2}:\d{2}:\d{2})/i);
          if (format2) {
            speaker = 'agent';
            timestamp = format2[1];
            // Read message from next line(s)
            i++;
            const messageLines: string[] = [];
            while (i < lines.length) {
              const nextLine = lines[i].trim();
              if (!nextLine) {
                i++;
                continue;
              }
              // Check if this is another speaker line
              if (nextLine.match(/setup\s+user\s+\d{2}:\d{2}:\d{2}/i) ||
                  nextLine.match(/^\+?\d{10,}\s+\d{2}:\d{2}:\d{2}/) ||
                  nextLine.match(/^\d{2}:\d{2}:\d{2}\s+(AGENT|CUSTOMER|BOT)/i)) {
                i--;
                break;
              }
              messageLines.push(nextLine);
              i++;
              // Only take one line for message (can be adjusted if multi-line needed)
              break;
            }
            messageText = messageLines.join(' ').trim();
            if (messageText) {
              parsedLines.push({ speaker, text: messageText, timestamp });
              console.log(`[Format 2] Parsed ${speaker} at ${timestamp}:`, messageText.substring(0, 50));
            }
            continue;
          }

          // FORMAT 4: phone number HH:MM:SS (customer, message on next line)
          const format3 = trimmedLine.match(/^\+?(\d{10,})\s+(\d{2}:\d{2}:\d{2})/);
          if (format3) {
            speaker = 'customer';
            timestamp = format3[2];
            // Read message from next line(s)
            i++;
            const messageLines: string[] = [];
            while (i < lines.length) {
              const nextLine = lines[i].trim();
              if (!nextLine) {
                i++;
                continue;
              }
              // Check if this is another speaker line
              if (nextLine.match(/setup\s+user\s+\d{2}:\d{2}:\d{2}/i) ||
                  nextLine.match(/^\+?\d{10,}\s+\d{2}:\d{2}:\d{2}/) ||
                  nextLine.match(/^\d{2}:\d{2}:\d{2}\s+(AGENT|CUSTOMER|BOT)/i)) {
                i--;
                break;
              }
              messageLines.push(nextLine);
              i++;
              // Only take one line for message
              break;
            }
            messageText = messageLines.join(' ').trim();
            if (messageText) {
              parsedLines.push({ speaker, text: messageText, timestamp });
              console.log(`[Format 3] Parsed ${speaker} at ${timestamp}:`, messageText.substring(0, 50));
            }
            continue;
          }

          // FORMAT 5: [SPEAKER]: message or SPEAKER: message
          const format4 = trimmedLine.match(/^\[?(BOT|AGENT|CUSTOMER|bot|agent|customer)\]?:?\s*(.+)$/i);
          if (format4) {
            const speakerStr = format4[1].toLowerCase();
            speaker = (speakerStr === 'bot' || speakerStr === 'agent' ? 'agent' : 'customer') as 'agent' | 'customer';
            messageText = format4[2].trim();
            timestamp = undefined; // No timestamp in this format
            if (messageText) {
              parsedLines.push({ speaker, text: messageText, timestamp });
              console.log(`[Format 4] Parsed ${speaker}:`, messageText.substring(0, 50));
            }
            continue;
          }

          // No format matched
          console.warn('Line did not match any supported format:', trimmedLine.substring(0, 100));
        }

        if (parsedLines.length > 0) {
          // Use filename (without extension) as the ID
          const fileId = file.name.replace(/\.(txt|text)$/i, '');

          parsedTranscripts.push({
            id: fileId,
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
          filesWithErrors++;
        }

        filesProcessed++;
        if (filesProcessed === files.length) {
          console.log(`\nAll files processed. Total transcripts: ${parsedTranscripts.length}`);

          if (parsedTranscripts.length === 0) {
            setUploadStatus({
              type: 'error',
              message: `Failed to parse any valid transcripts from the ${files.length} selected file${files.length !== 1 ? 's' : ''}. Please check that your files match one of the supported formats (see format guide below).`
            });
          } else {
            // Apply deduplication if enabled
            deduplicateTranscripts(parsedTranscripts).then((finalTranscripts) => {
              setTranscripts(finalTranscripts);
              if (filesWithErrors > 0) {
                setUploadStatus({
                  type: 'error',
                  message: `Successfully loaded ${finalTranscripts.length} transcript${finalTranscripts.length !== 1 ? 's' : ''}, but ${filesWithErrors} file${filesWithErrors !== 1 ? 's' : ''} could not be parsed or were empty.`
                });
              } else {
                setUploadStatus({
                  type: 'success',
                  message: `Successfully loaded ${finalTranscripts.length} transcript${finalTranscripts.length !== 1 ? 's' : ''} from ${files.length} text file${files.length !== 1 ? 's' : ''}.`
                });
              }
            }).catch((error) => {
              console.error('[TXT Upload] Deduplication failed, using original transcripts:', error);
              setTranscripts(parsedTranscripts);
              if (filesWithErrors > 0) {
                setUploadStatus({
                  type: 'error',
                  message: `Successfully loaded ${parsedTranscripts.length} transcript${parsedTranscripts.length !== 1 ? 's' : ''}, but ${filesWithErrors} file${filesWithErrors !== 1 ? 's' : ''} could not be parsed or were empty.`
                });
              } else {
                setUploadStatus({
                  type: 'success',
                  message: `Successfully loaded ${parsedTranscripts.length} transcript${parsedTranscripts.length !== 1 ? 's' : ''} from ${files.length} text file${files.length !== 1 ? 's' : ''}.`
                });
              }
            });
          }
          // Reset the file input
          event.target.value = '';
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
                onClick={() => {
                  setInputMode('single');
                  setUploadStatus({ type: null, message: '' });
                }}
              >
                Single Transcript
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  inputMode === 'batch'
                    ? 'bg-blue-500 text-white'
                    : 'text-[var(--color-slate-400)] hover:text-white'
                }`}
                onClick={() => {
                  setInputMode('batch');
                  setUploadStatus({ type: null, message: '' });
                }}
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
                  Upload CSV Files
                  <input
                    type="file"
                    accept=".csv"
                    multiple
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

              {/* Upload Status Messages */}
              {uploadStatus.type && (
                <div
                  className={`p-4 rounded-lg border ${
                    uploadStatus.type === 'success'
                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <p className="text-sm">{uploadStatus.message}</p>
                </div>
              )}

              <div className="glass-card-subtle p-4 space-y-3">
                <div>
                  <p className="text-sm text-[var(--color-slate-300)] mb-2 font-medium">
                    CSV Format:
                  </p>
                  <ul className="text-xs text-[var(--color-slate-400)] space-y-1 ml-4 list-disc">
                    <li>One row = one complete call (multi-line transcripts in ONE cell)</li>
                    <li>Format 1: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">00:00:00 AGENT Message</code> for agent</li>
                    <li>Format 2: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">setup user 00:00:00</code> (message on next line)</li>
                    <li>Format 3: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">919820203664 00:00:05</code> for customer (message on next line)</li>
                    <li>Format 4: <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">[AGENT]: Message</code> or <code className="bg-[var(--color-navy-700)] px-1 py-0.5 rounded">CUSTOMER: Message</code></li>
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
                    <li>Each file uses the same 4 formats listed above</li>
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
