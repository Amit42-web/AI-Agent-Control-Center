'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Lightbulb, MessageSquare } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { IssueType, Severity } from '@/types';

const issueTypeLabels: Record<IssueType, string> = {
  flow_deviation: 'Flow Deviation',
  repetition_loop: 'Repetition Loop',
  language_mismatch: 'Language Mismatch',
  mid_call_restart: 'Mid-Call Restart',
  quality_issue: 'Quality Issue',
};

const severityClasses: Record<Severity, string> = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
};

export function CallViewer() {
  const { selectedCallId, setSelectedCallId, results, transcripts } = useAppStore();
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  if (!selectedCallId || !results) return null;

  const transcript = transcripts.find((t) => t.id === selectedCallId);
  const callIssues = results.issues.filter((i) => i.callId === selectedCallId);

  if (!transcript || !transcript.lines || !Array.isArray(transcript.lines)) return null;

  // Get line numbers for the currently hovered issue
  const hoveredIssue = hoveredIssueId
    ? callIssues.find((i) => i.id === hoveredIssueId)
    : null;
  const hoveredLines = hoveredIssue && hoveredIssue.lineNumbers && Array.isArray(hoveredIssue.lineNumbers)
    ? new Set(hoveredIssue.lineNumbers)
    : null;

  // Auto-scroll to relevant line when hovering over an issue
  useEffect(() => {
    if (!hoveredIssueId || !results) return;

    // Find the hovered issue from results
    const issue = results.issues.find((i) => i.id === hoveredIssueId && i.callId === selectedCallId);
    if (!issue || !issue.lineNumbers || !Array.isArray(issue.lineNumbers) || issue.lineNumbers.length === 0) {
      return;
    }

    // Get the first line number
    const firstLineNumber = Math.min(...issue.lineNumbers);
    if (!Number.isFinite(firstLineNumber)) return;

    const lineElement = lineRefs.current.get(firstLineNumber);
    if (lineElement) {
      try {
        lineElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } catch (error) {
        console.error('Error scrolling to line:', error);
      }
    }
  }, [hoveredIssueId, results, selectedCallId]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setSelectedCallId(null)}
      >
        <motion.div
          className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-navy-700)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Call: {selectedCallId}</h3>
                <p className="text-xs text-[var(--color-slate-400)]">
                  {callIssues.length} issue{callIssues.length !== 1 ? 's' : ''} detected
                  {transcript.metadata?.duration && ` • ${transcript.metadata.duration}`}
                </p>
              </div>
            </div>
            <button
              className="p-2 hover:bg-[var(--color-navy-700)] rounded-lg transition-colors"
              onClick={() => setSelectedCallId(null)}
            >
              <X className="w-5 h-5 text-[var(--color-slate-400)]" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Transcript */}
              <div className="lg:col-span-2 space-y-2">
                <h4 className="text-sm font-medium text-[var(--color-slate-300)] mb-3">
                  Transcript
                </h4>
                <div className="space-y-1">
                  {transcript.lines.map((line, index) => {
                    // Determine highlighting state based on hover
                    const lineNumber = index + 1;
                    const isRelevant = hoveredLines ? hoveredLines.has(lineNumber) : true;
                    const isDimmed = hoveredLines && !hoveredLines.has(lineNumber);

                    return (
                      <div
                        key={index}
                        ref={(el) => {
                          if (el) {
                            lineRefs.current.set(lineNumber, el);
                          } else {
                            lineRefs.current.delete(lineNumber);
                          }
                        }}
                        className={`transcript-line ${isRelevant ? 'highlighted' : ''}`}
                        style={{
                          opacity: isDimmed ? 0.3 : 1,
                          transition: 'opacity 0.2s ease-in-out',
                        }}
                      >
                        <span className="text-xs text-[var(--color-slate-500)] w-8 shrink-0">
                          {line.timestamp || `${index + 1}`}
                        </span>
                        <span
                          className={`speaker-badge ${
                            line.speaker === 'bot' ? 'speaker-bot' : 'speaker-customer'
                          }`}
                        >
                          {line.speaker}
                        </span>
                        <span className="text-sm text-[var(--color-slate-200)] flex-1">
                          {line.text}
                        </span>
                        {line.language && line.language !== 'en' && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                            {line.language.toUpperCase()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Issues Panel */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-[var(--color-slate-300)]">
                  Issues in this call
                </h4>
                {callIssues.map((issue, index) => (
                  <motion.div
                    key={issue.id}
                    className="glass-card-subtle p-4 space-y-3 cursor-pointer hover:bg-[var(--color-navy-700)] transition-colors"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onMouseEnter={() => setHoveredIssueId(issue.id)}
                    onMouseLeave={() => setHoveredIssueId(null)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium text-white">
                          {issueTypeLabels[issue.type] || issue.type}
                        </span>
                      </div>
                      <span className={`badge ${severityClasses[issue.severity] || 'badge-medium'}`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-slate-400)]">
                      {issue.explanation}
                    </p>
                    {issue.suggestedFix && (
                      <div className="flex items-start gap-2 p-2 bg-green-500/10 rounded-lg">
                        <Lightbulb className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-green-300">{issue.suggestedFix}</p>
                      </div>
                    )}
                  </motion.div>
                ))}

                {callIssues.length === 0 && (
                  <div className="p-4 text-center text-[var(--color-slate-400)] text-sm">
                    No issues detected in this call.
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
