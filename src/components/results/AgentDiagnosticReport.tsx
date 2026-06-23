'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Scenario } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const DIMENSION_MAP: Record<string, { letter: string; name: string }> = {
  'Conversation Control & Flow':       { letter: 'A', name: 'Conversation Control & Flow' },
  'Language Quality & Human-Likeness': { letter: 'B', name: 'Empathy & Tone' },
  'Knowledge & Accuracy':              { letter: 'C', name: 'Knowledge & Accuracy' },
  'Process & Policy Adherence':        { letter: 'D', name: 'Script Adherence' },
  'Temporal Dynamics & Turn-Taking':   { letter: 'E', name: 'Resolution & Outcome' },
  'Context Tracking & Intent Alignment': { letter: 'F', name: 'Communication Clarity' },
  'Novel & Emerging Issues':           { letter: 'G', name: 'Novel & Emerging Issues' },
};

function normalizeDim(raw: string): string {
  return raw.replace(/\s*\([A-G]\)\s*$/, '').trim();
}

const SEV_P: Record<string, number> = { low: 3, medium: 8, high: 15, critical: 25 };
const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#94A3B8', low: '#CBD5E1' };
const SEV_LABEL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

function computeScore(scenarios: Array<{ severity: string }>): number {
  if (!scenarios.length) return 100;
  const penalty = scenarios.reduce((sum, s) => sum + (SEV_P[s.severity] ?? 8), 0);
  return Math.max(0, 100 - Math.round((penalty / (scenarios.length * 25)) * 100));
}

function getScoreStatus(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excellent', color: '#10B981' };
  if (score >= 80) return { label: 'Good',      color: '#14B8A6' };
  if (score >= 70) return { label: 'Fair',      color: '#F59E0B' };
  if (score >= 60) return { label: 'Poor',      color: '#F97316' };
  return              { label: 'Critical',   color: '#EF4444' };
}

// ─── DonutGauge ───────────────────────────────────────────────────────────────

function DonutGauge({ score }: { score: number }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const arcColor = score >= 80 ? '#14B8A6' : score < 70 ? '#EF4444' : '#F59E0B';
  const { label, color } = getScoreStatus(score);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={136} height={136} viewBox="0 0 200 200">
        <circle cx={100} cy={100} r={r} fill="none" stroke="#1E293B" strokeWidth={16} />
        <circle cx={100} cy={100} r={r} fill="none" stroke={arcColor} strokeWidth={16}
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round" transform="rotate(-90 100 100)" />
        <text x={100} y={92} textAnchor="middle" fill="white" fontSize={38} fontWeight={700} fontFamily="Plus Jakarta Sans, sans-serif">{score}</text>
        <text x={100} y={110} textAnchor="middle" fill="#94A3B8" fontSize={13} fontFamily="Plus Jakarta Sans, sans-serif">/100</text>
        <circle cx={88} cy={126} r={4} fill={color} />
        <text x={96} y={130} textAnchor="start" fill={color} fontSize={12} fontFamily="Plus Jakarta Sans, sans-serif">{label}</text>
      </svg>
      <span style={{ fontSize: 10, color: '#64748B', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>QA SCORE</span>
      <span style={{ fontSize: 9, color: '#475569', textAlign: 'center', lineHeight: 1.4 }}>
        Severity-weighted avg<br/>(low=3, med=8, high=15, crit=25)
      </span>
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, icon, iconBg, color, fillPct, subtext, borderTop }: {
  label: string; value: number | string; icon?: React.ReactNode; iconBg?: string;
  color: string; fillPct: number; subtext: string; borderTop?: string;
}) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '15px 16px', boxShadow: '0 1px 4px rgba(15,23,42,0.06)', borderTop: borderTop || undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</span>
        {iconBg && icon && (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
        )}
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginBottom: 10 }}>{value}</div>
      <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(fillPct, 100)}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: '#94A3B8' }}>{subtext}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentDiagnosticReport() {
  const { transcripts, scenarioResults, enhancedFixes, currentAnalysisName, goToStep } = useAppStore();

  const allScenarios  = scenarioResults?.scenarios ?? [];
  const allFixes      = enhancedFixes?.fixes ?? [];
  const totalCalls    = transcripts.length;
  const totalIncidents = allScenarios.length;

  const callsAffectedSet  = new Set(allScenarios.map(s => s.callId));
  const callsAffected     = callsAffectedSet.size;
  const callsAffectedPct  = totalCalls > 0 ? Math.round((callsAffected / totalCalls) * 100) : 0;
  const issueRate         = totalCalls > 0 ? +(totalIncidents / totalCalls).toFixed(1) : 0;
  const fixesIdentified   = allFixes.length;
  const qaScore           = computeScore(allScenarios);
  const { label: scoreLabel, color: scoreColor } = getScoreStatus(qaScore);

  const severity = {
    critical: allScenarios.filter(s => s.severity === 'critical').length,
    high:     allScenarios.filter(s => s.severity === 'high').length,
    mediumLow: allScenarios.filter(s => s.severity === 'medium' || s.severity === 'low').length,
  };
  const totalSev  = severity.critical + severity.high + severity.mediumLow || 1;
  const critPct   = Math.round((severity.critical  / totalSev) * 100);
  const highPct   = Math.round((severity.high      / totalSev) * 100);
  const medLowPct = Math.round((severity.mediumLow / totalSev) * 100);

  // Weekly plan
  const week1 = allFixes.filter(f => f.fixType === 'script');
  const week2 = allFixes.filter(f => f.fixType === 'process');
  const week3 = allFixes.filter(f => f.fixType === 'training' || f.fixType === 'system');
  const totalFixes = allFixes.length;
  const totalGap  = 100 - qaScore;
  const w1Pts = totalFixes > 0 ? Math.round((week1.length / totalFixes) * totalGap) : 0;
  const w2Pts = totalFixes > 0 ? Math.round((week2.length / totalFixes) * totalGap) : 0;
  const w3Pts = totalGap - w1Pts - w2Pts;
  const scoreAfterW1       = qaScore + w1Pts;
  const scoreAfterW2       = scoreAfterW1 + w2Pts;
  const projectedFinalScore = Math.min(100, qaScore + totalGap);

  const runName = currentAnalysisName || 'Unnamed Run';
  const date    = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // ─── Dimensions ─────────────────────────────────────────────────────────────

  interface DimData {
    key: string; letter: string; name: string;
    incidents: number; uniqueCalls: number; callRate: number;
    status: 'critical' | 'elevated' | 'clear';
    calls: Set<string>;
    scenarios: Scenario[];
  }

  const dimMap: Record<string, DimData> = {};
  for (const [dimKey, meta] of Object.entries(DIMENSION_MAP)) {
    dimMap[dimKey] = { key: dimKey, ...meta, incidents: 0, uniqueCalls: 0, callRate: 0, status: 'clear', calls: new Set(), scenarios: [] };
  }
  for (const scenario of allScenarios) {
    const dim = normalizeDim(scenario.dimension || '');
    if (!dimMap[dim]) continue;
    dimMap[dim].incidents += 1;
    dimMap[dim].calls.add(scenario.callId);
    dimMap[dim].scenarios.push(scenario);
    if (scenario.severity === 'critical') {
      dimMap[dim].status = 'critical';
    } else if (scenario.severity === 'high' && dimMap[dim].status !== 'critical') {
      dimMap[dim].status = 'elevated';
    } else if (dimMap[dim].incidents === 1 && dimMap[dim].status === 'clear') {
      dimMap[dim].status = 'elevated';
    }
  }

  const allDims = Object.values(dimMap).map(d => ({
    ...d,
    uniqueCalls: d.calls.size,
    callRate: totalCalls > 0 ? +(d.calls.size / totalCalls * 100).toFixed(0) : 0,
  }));

  const activeDims = allDims.filter(d => d.incidents > 0).sort((a, b) => b.callRate - a.callRate);
  const clearDims  = allDims.filter(d => d.incidents === 0);
  const maxCallRate = activeDims.length > 0 ? activeDims[0].callRate : 1;

  const recommendation = severity.critical > 0
    ? 'Address critical incidents immediately and schedule a training review within 1 week.'
    : severity.high > 0
      ? 'Focus on high-severity issues in your weekly team review. Prioritize Week 1 script fixes.'
      : 'Maintain current performance. Implement preventive measures from Week 3 fixes.';

  return (
    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', background: '#EDF0F5', minHeight: '100vh' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 40px' }}>

        {/* Back */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => goToStep('fixes')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: '#475569',
            background: 'white', border: '1px solid #E2E8F0',
            borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
          }}>
            ← Back to Fixes
          </button>
        </div>

        {/* ── SECTION 1: Header ── */}
        <div style={{
          background: '#0F172A', borderRadius: 20, padding: '24px 28px',
          marginBottom: 12, position: 'relative', overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
        }}>
          <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '50%', height: '200%', background: 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.5)' }} />
                <span style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>AI AGENT CONTROL CENTER</span>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'white', margin: '0 0 6px' }}>Agent Diagnostic Report</h1>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Run: {runName} · {date}</p>
              {/* Severity badges — show % of incident distribution */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#FCA5A5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 20, padding: '4px 10px' }}>
                  🔴 {critPct}% Critical
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#FCD34D', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 20, padding: '4px 10px' }}>
                  🟡 {highPct}% High
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.22)', borderRadius: 20, padding: '4px 10px' }}>
                  ⚫ {medLowPct}% Med/Low
                </span>
              </div>
            </div>
            <div style={{ flexShrink: 0 }}><DonutGauge score={qaScore} /></div>
          </div>
          <div style={{ position: 'relative', zIndex: 1, marginTop: 20, height: 3, borderRadius: 2, background: 'linear-gradient(90deg, #14B8A6, #6366F1, #14B8A6)' }} />
        </div>

        {/* ── SECTION 2: Key Metrics ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
          <MetricCard
            label="Call Volume"
            value={totalCalls}
            icon={<svg width={18} height={18} fill="none" stroke="#14B8A6" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>}
            iconBg="#F0FDFA"
            color="#14B8A6"
            fillPct={100}
            subtext="Total sessions analyzed"
          />
          <MetricCard
            label="Issue Rate"
            value={`${issueRate}/call`}
            icon={<svg width={18} height={18} fill="none" stroke="#F59E0B" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"/></svg>}
            iconBg="#FFFBEB"
            color="#F59E0B"
            fillPct={Math.min(issueRate * 20, 100)}
            subtext={`${totalIncidents} total incidents`}
          />
          <MetricCard
            label="Calls Affected"
            value={`${callsAffectedPct}%`}
            color="#EF4444"
            fillPct={callsAffectedPct}
            subtext={`${callsAffected} of ${totalCalls} sessions`}
            borderTop="3px solid #EF4444"
          />
          <MetricCard
            label="Fixes Ready"
            value={fixesIdentified}
            icon={<svg width={18} height={18} fill="none" stroke="#6366F1" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>}
            iconBg="#EEF2FF"
            color="#6366F1"
            fillPct={100}
            subtext="Actionable improvements"
          />
        </div>

        {/* ── SECTION 3: Dimensions + Severity sidebar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, marginBottom: 12 }}>

          {/* LEFT: Performance by Dimension */}
          <div style={{ background: 'white', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 4, height: 20, background: '#14B8A6', borderRadius: 2 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Performance by Dimension</span>
              <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>% of calls affected</span>
            </div>

            {activeDims.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 13 }}>No incidents detected across all dimensions.</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeDims.map(dim => {
                const isC  = dim.status === 'critical';
                const barColor   = isC ? '#EF4444' : '#F59E0B';
                const trackColor = isC ? '#FEE2E2'  : '#FEF3C7';
                const badgeBg    = isC ? '#FEE2E2'  : '#FEF3C7';
                const badgeText  = isC ? '#EF4444'  : '#F59E0B';
                const barWidth   = maxCallRate > 0 ? (dim.callRate / maxCallRate) * 100 : 0;
                const topIssues  = [...dim.scenarios]
                  .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))
                  .slice(0, 7);

                return (
                  <div key={dim.key} style={{ padding: '10px 12px', borderRadius: 10, background: '#FAFAFA', border: '1px solid #F1F5F9' }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: badgeText, fontWeight: 700, fontSize: 12 }}>{dim.letter}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', flex: 1 }}>{dim.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: badgeText, background: badgeBg, borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                        {isC ? 'CRITICAL' : 'ELEVATED'}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: barColor, minWidth: 42, textAlign: 'right', flexShrink: 0 }}>
                        {dim.callRate}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 6, background: trackColor, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${barWidth}%`, background: barColor, borderRadius: 3 }} />
                    </div>
                    {/* Top issues */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {topIssues.map((s) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: SEV_COLOR[s.severity],
                            background: `${SEV_COLOR[s.severity]}18`, borderRadius: 3,
                            padding: '1px 5px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>{SEV_LABEL[s.severity]}</span>
                          <span style={{ fontSize: 11, color: '#475569', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{s.title}</span>
                        </div>
                      ))}
                      {dim.scenarios.length > 7 && (
                        <span style={{ fontSize: 10, color: '#94A3B8', paddingLeft: 2 }}>
                          +{dim.scenarios.length - 7} more issues
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Clear dims — compact */}
            {clearDims.length > 0 && (
              <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 14, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: '#10B981', fontWeight: 700, marginBottom: 8 }}>✓ No Issues</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {clearDims.map(dim => (
                    <span key={dim.key} style={{ background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#059669', fontWeight: 600 }}>
                      {dim.letter} · {dim.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Severity breakdown + recommendation */}
          <div style={{ background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(15,23,42,0.06)', borderLeft: '4px solid #F59E0B', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Severity Split</div>

            {/* Critical */}
            {[
              { label: 'Critical', pct: critPct, count: severity.critical, color: '#EF4444', bg: '#FEE2E2' },
              { label: 'High',     pct: highPct,   count: severity.high,     color: '#F59E0B', bg: '#FEF3C7' },
              { label: 'Med/Low',  pct: medLowPct, count: severity.mediumLow, color: '#94A3B8', bg: '#F1F5F9' },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: row.color }} />
                    <span style={{ fontSize: 11, color: '#475569' }}>{row.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.pct}%</span>
                </div>
                <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 2 }} />
                </div>
              </div>
            ))}

            <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
              <div style={{ background: '#0F172A', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#14B8A6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>RECOMMENDATION</div>
                <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.5 }}>{recommendation}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 4: 3-Week Action Plan ── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 4, height: 20, background: '#6366F1', borderRadius: 2 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>3-Week Action Plan</span>
            <span style={{ fontSize: 13, color: '#94A3B8', marginLeft: 4 }}>· Target: {qaScore} → 100</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'WEEK 1', fixes: week1, title: 'Prompt & Script Updates', pts: w1Pts, gradient: 'linear-gradient(135deg,#14B8A6,#0D9488)', ptsColor: '#14B8A6', ptsBg: '#F0FDFA', ptsBorder: 'rgba(20,184,166,0.2)' },
              { label: 'WEEK 2', fixes: week2, title: 'Process & Workflow',       pts: w2Pts, gradient: 'linear-gradient(135deg,#64748B,#475569)', ptsColor: '#64748B', ptsBg: '#F8FAFC', ptsBorder: 'rgba(100,116,139,0.2)' },
              { label: 'WEEK 3', fixes: week3, title: 'Training & System',        pts: w3Pts, gradient: 'linear-gradient(135deg,#6366F1,#4F46E5)', ptsColor: '#6366F1', ptsBg: '#EEF2FF', ptsBorder: 'rgba(99,102,241,0.2)' },
            ].map(w => (
              <div key={w.label} style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
                <div style={{ background: w.gradient, padding: 16 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{w.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>{w.fixes.length}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{w.title}</div>
                </div>
                <div style={{ background: 'white', padding: 14 }}>
                  {w.fixes.length > 0 ? (
                    <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: '#475569', lineHeight: 1.8 }}>
                      {w.fixes.slice(0, 3).map(f => (
                        <li key={f.id} style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.title}</li>
                      ))}
                      {w.fixes.length > 3 && <li style={{ color: '#94A3B8' }}>+{w.fixes.length - 3} more</li>}
                    </ul>
                  ) : (
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>None scheduled</span>
                  )}
                  <div style={{ background: w.ptsBg, border: `1px solid ${w.ptsBorder}`, borderRadius: 8, padding: '8px 12px', marginTop: 12 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: w.ptsColor }}>+{w.pts} pts</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>est. QA improvement</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION 5: Projection Footer ── */}
        <div style={{ background: '#0F172A', borderRadius: 20, padding: '22px 26px', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>

            {/* Score change */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 14 }}>PROJECTED QA SCORE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#64748B', minWidth: 40 }}>Now</span>
                <span style={{ fontSize: 44, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{qaScore}</span>
                <span style={{ fontSize: 13, color: scoreColor, paddingBottom: 4 }}>{scoreLabel}</span>
              </div>
              <div style={{ fontSize: 22, color: '#334155', marginBottom: 8 }}>→</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#64748B', minWidth: 40 }}>Week 3</span>
                <span style={{ fontSize: 44, fontWeight: 800, color: '#14B8A6', lineHeight: 1 }}>{projectedFinalScore}</span>
                <span style={{ fontSize: 13, color: '#14B8A6', paddingBottom: 4 }}>{getScoreStatus(projectedFinalScore).label}</span>
              </div>
            </div>

            {/* Progress bars */}
            <div style={{ flex: 1.4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#64748B' }}>Current</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>{qaScore}/100</span>
              </div>
              <div style={{ height: 12, background: '#1E293B', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', width: `${qaScore}%`, background: 'linear-gradient(90deg,#F59E0B,#FBBF24)', borderRadius: 6 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 12 }}>
                {[
                  { label: 'W1', score: scoreAfterW1, color: '#14B8A6' },
                  { label: 'W2', score: scoreAfterW2, color: '#64748B' },
                  { label: 'W3', score: projectedFinalScore, color: '#14B8A6' },
                ].map(step => (
                  <div key={step.label} style={{ background: '#1E293B', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>{step.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: step.color }}>{step.score}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#64748B' }}>Projected</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>{projectedFinalScore}/100</span>
              </div>
              <div style={{ height: 12, background: '#1E293B', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${projectedFinalScore}%`, background: 'linear-gradient(90deg,#14B8A6,#10B981)', borderRadius: 6 }} />
              </div>
            </div>

            {/* Uplift tile */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.25)', borderRadius: 16, padding: '20px 24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 10, color: '#14B8A6', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>TOTAL UPLIFT</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: '#14B8A6' }}>+{totalGap}</span>
                  <span style={{ fontSize: 16, color: '#14B8A6', fontWeight: 600 }}>pts</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'W1', pts: w1Pts, color: '#14B8A6' },
                    { label: 'W2', pts: w2Pts, color: '#64748B' },
                    { label: 'W3', pts: w3Pts, color: '#14B8A6' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                      <span style={{ fontSize: 11, color: '#475569' }}>{r.label}</span>
                      <span style={{ fontSize: 11, color: r.color, fontWeight: 600 }}>+{r.pts}pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
