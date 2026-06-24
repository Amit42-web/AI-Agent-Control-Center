'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export function RunDebugPanel() {
  const { lastRunDebug } = useAppStore();
  const [open, setOpen] = useState(false);

  if (!lastRunDebug) return null;

  const allEnabled = lastRunDebug.enabledDimensions.length === (lastRunDebug.enabledDimensions.length + lastRunDebug.disabledDimensions.length);

  return (
    <div
      className="glass-card overflow-hidden text-xs"
      style={{ border: '1px solid rgba(100,116,139,0.3)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setOpen(!open)}
        style={{ borderBottom: open ? '1px solid rgba(100,116,139,0.2)' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />
          <span className="font-semibold" style={{ color: 'var(--color-slate-400)' }}>
            Last Run Debug
          </span>
          <span
            className="px-2 py-0.5 rounded-full"
            style={{
              background: lastRunDebug.scenariosFound > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: lastRunDebug.scenariosFound > 0 ? '#22c55e' : '#f87171',
            }}
          >
            {lastRunDebug.scenariosFound} scenario{lastRunDebug.scenariosFound !== 1 ? 's' : ''} found
          </span>
          <span style={{ color: 'var(--color-slate-500)' }}>
            {lastRunDebug.enabledDimensions.length}/{lastRunDebug.enabledDimensions.length + lastRunDebug.disabledDimensions.length} dims · {lastRunDebug.transcriptCount} call{lastRunDebug.transcriptCount !== 1 ? 's' : ''} · {lastRunDebug.model}
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />
          : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />}
      </div>

      {open && (
        <div className="p-4 space-y-4" style={{ color: 'var(--color-slate-300)' }}>
          {/* Meta row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Flow', value: lastRunDebug.flowType },
              { label: 'Model', value: lastRunDebug.model },
              { label: 'Calls', value: String(lastRunDebug.transcriptCount) },
              { label: 'System prompt', value: `${lastRunDebug.systemPromptLength.toLocaleString()} chars` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p style={{ color: 'var(--color-slate-500)' }}>{label}</p>
                <p className="font-mono font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>

          {/* Dimensions */}
          <div>
            <p className="font-semibold mb-2" style={{ color: 'var(--color-slate-400)' }}>
              Dimensions sent to LLM ({lastRunDebug.enabledDimensions.length} active)
            </p>
            <div className="flex flex-wrap gap-2">
              {lastRunDebug.enabledDimensions.map(d => (
                <span
                  key={d.id}
                  className="px-2 py-0.5 rounded font-mono"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
                >
                  {d.id} — {d.label}
                </span>
              ))}
              {lastRunDebug.disabledDimensions.map(d => (
                <span
                  key={d.id}
                  className="px-2 py-0.5 rounded font-mono line-through"
                  style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--color-slate-500)' }}
                >
                  {d.id} — {d.label}
                </span>
              ))}
            </div>
          </div>

          {/* First transcript info */}
          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p style={{ color: 'var(--color-slate-500)' }}>
              First transcript sampled: <span className="font-mono text-white">{lastRunDebug.firstTranscriptId}</span>
              {' '}({lastRunDebug.firstTranscriptLines} lines)
            </p>
          </div>

          {/* Raw LLM response */}
          <div>
            <p className="font-semibold mb-2" style={{ color: 'var(--color-slate-400)' }}>
              Raw LLM response (first ~800 chars of first transcript)
            </p>
            <pre
              className="rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed"
              style={{
                background: 'rgba(0,0,0,0.3)',
                color: '#86efac',
                border: '1px solid rgba(34,197,94,0.15)',
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {lastRunDebug.rawResponseSnippet || '(no response captured)'}
            </pre>
          </div>

          <p style={{ color: 'var(--color-slate-500)' }}>
            Run at {new Date(lastRunDebug.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
