'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { CriticalAlertCategory, CriticalAlertConfig } from '@/types';

const CATEGORY_META: Record<
  CriticalAlertCategory,
  { label: string; icon: string; color: string }
> = {
  bot_failure: { label: 'Bot Failure', icon: '🤖', color: '#f97316' },
  compliance: { label: 'Compliance & Legal', icon: '📋', color: '#ef4444' },
  escalation: { label: 'Customer Escalation', icon: '🆘', color: '#f59e0b' },
  deception: { label: 'Deception', icon: '🎭', color: '#a855f7' },
  flow: { label: 'Flow & Outcome', icon: '🔄', color: '#64748b' },
};

const CATEGORY_ORDER: CriticalAlertCategory[] = [
  'bot_failure',
  'escalation',
  'deception',
  'compliance',
  'flow',
];

function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: enabled ? '#3b82f6' : '#334155',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.2s',
      }}
      aria-checked={enabled}
      role="switch"
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: enabled ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

function AlertRow({
  alert,
  onToggle,
}: {
  alert: CriticalAlertConfig;
  onToggle: () => void;
}) {
  const isLLM = alert.detectionMethod === 'llm';

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{alert.icon}</span>
        <div className="flex-1 min-w-0">
          {/* Name + badge row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-white">{alert.name}</span>
            {isLLM ? (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
              >
                AI Check
              </span>
            ) : (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
              >
                Instant
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs mb-2" style={{ color: 'var(--color-slate-400)', lineHeight: 1.5 }}>
            {alert.description}
          </p>

          {/* Detection criteria — always visible */}
          {isLLM && alert.prompt ? (
            <div
              className="text-xs rounded-lg px-3 py-2"
              style={{
                background: 'rgba(59,130,246,0.07)',
                border: '1px solid rgba(59,130,246,0.18)',
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: '#60a5fa', fontWeight: 600, marginRight: 6 }}>AI criteria:</span>
              <span style={{ color: '#93c5fd' }}>{alert.prompt}</span>
            </div>
          ) : !isLLM ? (
            <div
              className="text-xs rounded-lg px-3 py-2"
              style={{
                background: 'rgba(34,197,94,0.06)',
                border: '1px solid rgba(34,197,94,0.15)',
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: '#22c55e', fontWeight: 600, marginRight: 6 }}>Rule:</span>
              <span style={{ color: '#86efac' }}>{alert.description}</span>
            </div>
          ) : null}
        </div>
        <ToggleSwitch enabled={alert.enabled} onChange={onToggle} />
      </div>
    </div>
  );
}

export function CriticalAlertSettings() {
  const {
    criticalAlertConfigs,
    criticalAlertsEnabled,
    toggleCriticalAlert,
    toggleCriticalAlertsEnabled,
  } = useAppStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<CriticalAlertCategory>>(
    new Set(CATEGORY_ORDER)
  );

  const toggleCategory = (cat: CriticalAlertCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const enabledCount = criticalAlertConfigs.filter((c) => c.enabled).length;
  const totalCount = criticalAlertConfigs.length;

  const byCategory = CATEGORY_ORDER.reduce<Record<CriticalAlertCategory, CriticalAlertConfig[]>>(
    (acc, cat) => {
      acc[cat] = criticalAlertConfigs.filter((c) => c.category === cat);
      return acc;
    },
    {} as Record<CriticalAlertCategory, CriticalAlertConfig[]>
  );

  return (
    <div className="glass-card overflow-hidden">
      {/* ── Main header ── */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        style={{ borderBottom: isExpanded ? '1px solid var(--color-navy-700)' : 'none' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.15)' }}
          >
            <span style={{ fontSize: 16 }}>🚨</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">Critical Alerts</h3>
            <p className="text-xs" style={{ color: 'var(--color-slate-400)' }}>
              {enabledCount} of {totalCount} alerts enabled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ToggleSwitch
            enabled={criticalAlertsEnabled}
            onChange={toggleCriticalAlertsEnabled}
          />
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" style={{ color: 'var(--color-slate-400)' }} />
          ) : (
            <ChevronDown className="w-5 h-5" style={{ color: 'var(--color-slate-400)' }} />
          )}
        </div>
      </div>

      {/* ── Body ── */}
      {isExpanded && (
        <div
          className="p-4 space-y-3"
          style={{ opacity: criticalAlertsEnabled ? 1 : 0.45, pointerEvents: criticalAlertsEnabled ? 'auto' : 'none' }}
        >
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            const items = byCategory[cat];
            const catEnabled = items.filter((c) => c.enabled).length;
            const isCatExpanded = expandedCategories.has(cat);

            return (
              <div
                key={cat}
                className="rounded-xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-navy-700)' }}
              >
                {/* Category header */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  onClick={() => toggleCategory(cat)}
                  style={{ borderBottom: isCatExpanded ? '1px solid var(--color-navy-700)' : 'none' }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 16 }}>{meta.icon}</span>
                    <span className="font-medium text-sm text-white">{meta.label}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: `${meta.color}22`,
                        color: meta.color,
                      }}
                    >
                      {catEnabled}/{items.length}
                    </span>
                  </div>
                  {isCatExpanded ? (
                    <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />
                  ) : (
                    <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-slate-400)' }} />
                  )}
                </div>

                {/* Alert rows */}
                {isCatExpanded && (
                  <div className="divide-y" style={{ borderColor: 'var(--color-navy-700)' }}>
                    {items.map((alert) => (
                      <AlertRow
                        key={alert.id}
                        alert={alert}
                        onToggle={() => toggleCriticalAlert(alert.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
