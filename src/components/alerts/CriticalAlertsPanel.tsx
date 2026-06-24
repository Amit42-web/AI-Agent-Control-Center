'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { CriticalAlertCategory, CriticalAlertPriority, DetectedCriticalAlert } from '@/types';

const CATEGORY_META: Record<
  CriticalAlertCategory,
  { label: string; icon: string; color: string; bg: string }
> = {
  bot_failure: { label: 'Bot Failure', icon: '🤖', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  compliance: { label: 'Compliance & Legal', icon: '📋', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  escalation: { label: 'Customer Escalation', icon: '🆘', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  deception: { label: 'Deception', icon: '🎭', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  flow: { label: 'Flow & Outcome', icon: '🔄', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

const CATEGORY_ORDER: CriticalAlertCategory[] = [
  'compliance',
  'deception',
  'escalation',
  'bot_failure',
  'flow',
];

const PRIORITY_STYLE: Record<CriticalAlertPriority, { bg: string; color: string }> = {
  P0: { bg: 'rgba(239,68,68,0.18)', color: '#f87171' },
  P1: { bg: 'rgba(245,158,11,0.18)', color: '#fbbf24' },
  P2: { bg: 'rgba(100,116,139,0.18)', color: '#94a3b8' },
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 90 ? '#ef4444' : confidence >= 80 ? '#f59e0b' : '#64748b';
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ background: `${color}22`, color }}
    >
      {confidence}%
    </span>
  );
}

function AlertRow({ alert }: { alert: DetectedCriticalAlert }) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[alert.category];
  const priorityStyle = alert.priority ? PRIORITY_STYLE[alert.priority] : PRIORITY_STYLE['P2'];

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: meta.bg, border: `1px solid ${meta.color}33` }}
    >
      <div className="flex items-start gap-3">
        <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
          {meta.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-white">{alert.alertName}</span>
            {alert.priority && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                style={{ background: priorityStyle.bg, color: priorityStyle.color }}
              >
                {alert.priority}
              </span>
            )}
            <ConfidenceBadge confidence={alert.confidence} />
          </div>
          <p
            className="text-xs"
            style={{
              color: 'var(--color-slate-400)',
              display: expanded ? 'block' : '-webkit-box',
              WebkitLineClamp: expanded ? undefined : 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: expanded ? 'visible' : 'hidden',
            }}
          >
            <span style={{ color: meta.color, fontStyle: 'italic' }}>&quot;</span>
            {alert.evidence}
            <span style={{ color: meta.color, fontStyle: 'italic' }}>&quot;</span>
          </p>
          {alert.lineNumbers && alert.lineNumbers.length > 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-slate-400)' }}>
              Lines: {alert.lineNumbers.join(', ')}
            </p>
          )}
          {alert.evidence.length > 120 && (
            <button
              className="text-xs mt-1"
              style={{ color: meta.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CriticalAlertsPanel() {
  const { criticalAlertResults } = useAppStore();

  const [activeTab, setActiveTab] = useState<'byCall' | 'byType'>('byCall');
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<CriticalAlertCategory>>(
    new Set(CATEGORY_ORDER)
  );

  // If analysis not run yet, render nothing
  if (!criticalAlertResults) return null;

  const { totalAlerts, callsWithAlerts, alertsByCall, allAlerts } = criticalAlertResults;

  // "No alerts" success state
  if (totalAlerts === 0) {
    return (
      <div
        className="glass-card p-5"
        style={{ border: '1px solid rgba(34,197,94,0.3)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 24 }}>✅</span>
          <div>
            <h3 className="font-semibold text-white">No Critical Alerts Detected</h3>
            <p className="text-sm" style={{ color: 'var(--color-slate-400)' }}>
              All critical checks passed across the analyzed calls.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── By Type grouping ──────────────────────────────────────────────────────
  const byCategory = CATEGORY_ORDER.reduce<Record<CriticalAlertCategory, DetectedCriticalAlert[]>>(
    (acc, cat) => {
      acc[cat] = allAlerts.filter((a) => a.category === cat);
      return acc;
    },
    {} as Record<CriticalAlertCategory, DetectedCriticalAlert[]>
  );

  const toggleCall = (callId: string) => {
    setExpandedCalls((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  };

  const toggleType = (cat: CriticalAlertCategory) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div
      className="glass-card overflow-hidden"
      style={{ border: '1px solid rgba(239,68,68,0.4)' }}
    >
      {/* ── Header ── */}
      <div
        className="p-5 flex items-center justify-between flex-wrap gap-3"
        style={{ borderBottom: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 24 }}>🚨</span>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-bold text-white text-lg">Critical Alerts</h3>
              <span
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}
              >
                {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''}
              </span>
              <span
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}
              >
                {callsWithAlerts} call{callsWithAlerts !== 1 ? 's' : ''} affected
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: '#fca5a5' }}>
              Requires immediate attention
            </p>
          </div>
        </div>

        {/* Tab toggle */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid rgba(239,68,68,0.3)' }}
        >
          {(['byCall', 'byType'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: activeTab === tab ? 'rgba(239,68,68,0.25)' : 'transparent',
                color: activeTab === tab ? '#f87171' : 'var(--color-slate-400)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {tab === 'byCall' ? 'By Call' : 'By Type'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-5 space-y-4">

        {/* ── By Call view ── */}
        {activeTab === 'byCall' && (
          <div className="space-y-3">
            {Object.entries(alertsByCall).map(([callId, alerts]) => {
              const isOpen = expandedCalls.has(callId);
              return (
                <div
                  key={callId}
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--color-navy-700)', background: 'rgba(255,255,255,0.02)' }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    onClick={() => toggleCall(callId)}
                    style={{ borderBottom: isOpen ? '1px solid var(--color-navy-700)' : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-white">{callId}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                      >
                        {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />
                    ) : (
                      <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />
                    )}
                  </div>
                  {isOpen && (
                    <div className="p-4 space-y-2">
                      {alerts.map((alert) => (
                        <AlertRow key={alert.id} alert={alert} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── By Type view ── */}
        {activeTab === 'byType' && (
          <div className="space-y-3">
            {CATEGORY_ORDER.filter((cat) => byCategory[cat].length > 0).map((cat) => {
              const meta = CATEGORY_META[cat];
              const items = byCategory[cat];
              const isOpen = expandedTypes.has(cat);
              return (
                <div
                  key={cat}
                  className="rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${meta.color}33`, background: meta.bg }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    onClick={() => toggleType(cat)}
                    style={{ borderBottom: isOpen ? `1px solid ${meta.color}33` : 'none' }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 16 }}>{meta.icon}</span>
                      <span className="font-semibold text-sm text-white">{meta.label}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${meta.color}22`, color: meta.color }}
                      >
                        {items.length}
                      </span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />
                    ) : (
                      <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />
                    )}
                  </div>
                  {isOpen && (
                    <div className="p-4 space-y-2">
                      {items.map((alert) => (
                        <div key={alert.id} className="space-y-1">
                          <p className="text-xs font-medium" style={{ color: meta.color }}>
                            Call: {alert.callId}
                          </p>
                          <AlertRow alert={alert} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
