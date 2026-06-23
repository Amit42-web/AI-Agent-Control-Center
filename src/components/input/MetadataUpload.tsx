'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { CallMetadataConfig } from '@/types';

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const parseRow = (line: string): string[] => {
    const result: string[] = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
      else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += line[i];
    }
    result.push(current.trim());
    return result;
  };
  const headers = parseRow(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseRow(line);
    return headers.reduce<Record<string, string>>((obj, h, i) => { obj[h.trim()] = values[i] ?? ''; return obj; }, {});
  });
}

function parseJSON(text: string): Record<string, string>[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('JSON must be an array of objects');
  return data.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? '')])));
}

export function MetadataUpload() {
  const { callMetadataConfig, setCallMetadataConfig, transcripts } = useAppStore();

  const [isExpanded, setIsExpanded] = useState(!!callMetadataConfig);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[] | null>(null);
  const [columns, setColumns] = useState<string[]>(callMetadataConfig?.columns ?? []);
  const [matchKey, setMatchKey] = useState(callMetadataConfig?.matchKey ?? '');
  const [excludedColumns, setExcludedColumns] = useState<Set<string>>(new Set(callMetadataConfig?.excludedColumns ?? []));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback((
    cols: string[], rows: Record<string, string>[], mk: string, excluded: Set<string>
  ) => {
    if (!mk || !cols.length || !rows.length) return;
    const lookup: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      const key = String(row[mk] ?? '').trim().toLowerCase();
      if (!key) continue;
      lookup[key] = Object.fromEntries(
        Object.entries(row).filter(([k]) => k !== mk && !excluded.has(k))
      );
    }
    setCallMetadataConfig({ columns: cols, matchKey: mk, excludedColumns: [...excluded], rows: lookup });
  }, [setCallMetadataConfig]);

  const handleFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target?.result as string;
        const rows = file.name.endsWith('.json') ? parseJSON(text) : parseCSV(text);
        if (rows.length === 0) { setError('No data rows found in file'); return; }
        const cols = Object.keys(rows[0]);
        setParsedRows(rows);
        setColumns(cols);
        const firstKey = cols[0];
        setMatchKey(firstKey);
        setExcludedColumns(new Set());
        commit(cols, rows, firstKey, new Set());
      } catch (err) {
        setError(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  }, [commit]);

  const hasFile = parsedRows !== null || (callMetadataConfig !== null && columns.length > 0);

  // Match stats
  const matchStats = (() => {
    if (!callMetadataConfig || transcripts.length === 0) return null;
    let matched = 0;
    for (const t of transcripts) {
      if (callMetadataConfig.rows[t.id.trim().toLowerCase()]) matched++;
    }
    return { matched, unmatched: transcripts.length - matched, total: transcripts.length };
  })();

  const headerSummary = callMetadataConfig
    ? [
        `${Object.keys(callMetadataConfig.rows).length} rows`,
        `match key: ${callMetadataConfig.matchKey}`,
        matchStats ? `${matchStats.matched}/${matchStats.total} calls matched` : null,
      ].filter(Boolean).join(' · ')
    : 'Upload CSV/JSON to inject call attributes into each audit';

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        style={{ borderBottom: isExpanded ? '1px solid var(--color-navy-700)' : 'none' }}
        onClick={() => setIsExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <span style={{ fontSize: 16 }}>📊</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">Call Metadata</h3>
            <p className="text-xs" style={{ color: 'var(--color-slate-400)' }}>{headerSummary}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {callMetadataConfig && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setCallMetadataConfig(null);
                setParsedRows(null);
                setColumns([]);
                setMatchKey('');
                setExcludedColumns(new Set());
              }}
              className="text-xs px-2 py-1 rounded"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              Clear
            </button>
          )}
          {isExpanded
            ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />
            : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Upload area — shown when no file loaded */}
          {!hasFile && (
            <div
              className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-8 cursor-pointer transition-colors"
              style={{ borderColor: dragOver ? '#6366f1' : 'var(--color-navy-700)', background: dragOver ? 'rgba(99,102,241,0.06)' : 'transparent' }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mb-3" style={{ color: 'var(--color-slate-400)' }} />
              <p className="text-sm font-medium text-white mb-1">Drop CSV or JSON file here</p>
              <p className="text-xs" style={{ color: 'var(--color-slate-400)' }}>One row per call · first row must be column headers</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />

          {error && (
            <div className="flex items-center gap-2 text-sm rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Column config — shown after file loaded */}
          {hasFile && columns.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs flex items-center gap-1.5"
                style={{ color: 'var(--color-slate-400)' }}
              >
                <Upload className="w-3 h-3" /> Replace file
              </button>

              {/* Match key */}
              <div>
                <label className="block text-xs font-semibold text-white mb-2">
                  Match key <span style={{ color: 'var(--color-slate-400)', fontWeight: 400 }}>— which column is the call ID?</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {columns.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => {
                        setMatchKey(col);
                        if (parsedRows) commit(columns, parsedRows, col, excludedColumns);
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                      style={{
                        background: matchKey === col ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${matchKey === col ? '#6366f1' : 'var(--color-navy-700)'}`,
                        color: matchKey === col ? '#a5b4fc' : 'var(--color-slate-400)',
                        fontWeight: matchKey === col ? 600 : 400,
                      }}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exclude columns */}
              <div>
                <label className="block text-xs font-semibold text-white mb-2">
                  Exclude from audit <span style={{ color: 'var(--color-slate-400)', fontWeight: 400 }}>— PII or irrelevant columns</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {columns.filter(c => c !== matchKey).map(col => {
                    const isExcluded = excludedColumns.has(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => {
                          const next = new Set(excludedColumns);
                          if (isExcluded) next.delete(col); else next.add(col);
                          setExcludedColumns(next);
                          if (parsedRows) commit(columns, parsedRows, matchKey, next);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        style={{
                          background: isExcluded ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isExcluded ? 'rgba(239,68,68,0.3)' : 'var(--color-navy-700)'}`,
                          color: isExcluded ? '#f87171' : 'var(--color-slate-400)',
                        }}
                      >
                        {isExcluded && <X className="w-3 h-3" />}
                        {col}
                      </button>
                    );
                  })}
                </div>
                {columns.filter(c => c !== matchKey).length > 0 && (
                  <p className="text-xs mt-2" style={{ color: 'var(--color-slate-400)' }}>
                    {excludedColumns.size > 0
                      ? `${excludedColumns.size} excluded · ${columns.length - 1 - excludedColumns.size} attributes will be injected per call`
                      : `${columns.length - 1} attributes will be injected per call`}
                  </p>
                )}
              </div>

              {/* Match preview */}
              {matchStats && (
                <div className="rounded-xl p-3 flex items-center gap-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-navy-700)' }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#22c55e' }} />
                    <span className="text-sm font-semibold" style={{ color: '#22c55e' }}>{matchStats.matched} matched</span>
                  </div>
                  {matchStats.unmatched > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
                      <span className="text-sm font-semibold" style={{ color: '#f59e0b' }}>{matchStats.unmatched} unmatched</span>
                      <span className="text-xs" style={{ color: 'var(--color-slate-400)' }}>will audit without attributes</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
