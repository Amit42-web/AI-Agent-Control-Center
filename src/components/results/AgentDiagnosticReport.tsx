'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';

// ─── Constants ───────────────────────────────────────────────────────────────

const DIMENSION_MAP: Record<string, { letter: string; name: string; desc: string }> = {
  'Conversation Control & Flow Management': { letter: 'A', name: 'Conversation Control & Flow', desc: 'Managing conversation flow and agent direction' },
  'Language Quality & Human-Likeness': { letter: 'B', name: 'Empathy & Tone', desc: 'Emotional intelligence & tone' },
  'Knowledge & Accuracy': { letter: 'C', name: 'Knowledge & Accuracy', desc: 'Accuracy of information provided' },
  'Process & Policy Adherence': { letter: 'D', name: 'Script Adherence', desc: 'Following required scripts & compliance protocols' },
  'Temporal Dynamics & Turn-Taking': { letter: 'E', name: 'Resolution & Outcome', desc: 'Response timing and resolution quality' },
  'Context Tracking & Intent Alignment': { letter: 'F', name: 'Communication Clarity', desc: 'Clear, understandable responses' },
  'Novel & Emerging Issues': { letter: 'G', name: 'Novel & Emerging Issues', desc: 'Unexpected new problems' },
};

const SEV_P: Record<string, number> = { low: 3, medium: 8, high: 15, critical: 25 };

function computeScore(scenarios: Array<{ severity: string }>): number {
  if (!scenarios.length) return 100;
  const penalty = scenarios.reduce((sum, s) => sum + (SEV_P[s.severity] ?? 8), 0);
  return Math.max(0, 100 - Math.round((penalty / (scenarios.length * 25)) * 100));
}

function getScoreStatus(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excellent', color: '#10B981' };
  if (score >= 80) return { label: 'Good', color: '#14B8A6' };
  if (score >= 70) return { label: 'Fair', color: '#F59E0B' };
  if (score >= 60) return { label: 'Poor', color: '#F97316' };
  return { label: 'Critical', color: '#EF4444' };
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
        <circle
          cx={100} cy={100} r={r}
          fill="none"
          stroke={arcColor}
          strokeWidth={16}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
        />
        <text x={100} y={92} textAnchor="middle" fill="white" fontSize={38} fontWeight={700} fontFamily="Plus Jakarta Sans, sans-serif">{score}</text>
        <text x={100} y={110} textAnchor="middle" fill="#94A3B8" fontSize={13} fontFamily="Plus Jakarta Sans, sans-serif">/100</text>
        <circle cx={88} cy={126} r={4} fill={color} />
        <text x={96} y={130} textAnchor="start" fill={color} fontSize={12} fontFamily="Plus Jakarta Sans, sans-serif">{label}</text>
      </svg>
      <span style={{ fontSize: 10, color: '#64748B', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>QA SCORE</span>
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg?: string;
  color: string;
  fillPct: number;
  subtext: string;
  badge?: string;
  borderTop?: string;
}

function MetricCard({ label, value, icon, iconBg, color, fillPct, subtext, badge, borderTop }: MetricCardProps) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      padding: '15px 16px',
      boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
      borderTop: borderTop || undefined,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</span>
        {iconBg && (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</span>
        {badge && (
          <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}1A`, border: `1px solid ${color}33`, borderRadius: 6, padding: '2px 8px', marginBottom: 4 }}>{badge}</span>
        )}
      </div>
      <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(fillPct, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 11, color: '#94A3B8' }}>{subtext}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentDiagnosticReport() {
  const { transcripts, scenarioResults, aggregatedScenarios, enhancedFixes, currentAnalysisName, goToStep } = useAppStore();

  const allScenarios = scenarioResults?.scenarios ?? [];
  const allFixes = enhancedFixes?.fixes ?? [];
  const totalCalls = transcripts.length;
  const totalIncidents = allScenarios.length;
  const callsAffected = new Set(allScenarios.map(s => s.callId)).size;
  const callsAffectedPct = totalCalls > 0 ? Math.round((callsAffected / totalCalls) * 100) : 0;
  const fixesIdentified = allFixes.length;
  const qaScore = computeScore(allScenarios);
  const { label: scoreLabel, color: scoreColor } = getScoreStatus(qaScore);

  const severity = {
    critical: allScenarios.filter(s => s.severity === 'critical').length,
    high: allScenarios.filter(s => s.severity === 'high').length,
    mediumLow: allScenarios.filter(s => s.severity === 'medium' || s.severity === 'low').length,
  };

  // Weekly plan
  const week1 = allFixes.filter(f => f.fixType === 'script');
  const week2 = allFixes.filter(f => f.fixType === 'process');
  const week3 = allFixes.filter(f => f.fixType === 'training' || f.fixType === 'system');
  const totalFixes = allFixes.length;
  const totalGap = 100 - qaScore;
  const w1Pts = totalFixes > 0 ? Math.round((week1.length / totalFixes) * totalGap) : 0;
  const w2Pts = totalFixes > 0 ? Math.round((week2.length / totalFixes) * totalGap) : 0;
  const w3Pts = totalGap - w1Pts - w2Pts;

  const scoreAfterW1 = qaScore + w1Pts;
  const scoreAfterW2 = scoreAfterW1 + w2Pts;
  const projectedFinalScore = Math.min(100, qaScore + w1Pts + w2Pts + w3Pts);

  const runName = currentAnalysisName || 'Unnamed Run';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // ─── Dimensions ─────────────────────────────────────────────────────────────

  const aggs = aggregatedScenarios ?? [];

  interface DimData {
    key: string;
    letter: string;
    name: string;
    desc: string;
    incidents: number;
    pct: number;
    status: 'critical' | 'elevated' | 'clear';
  }

  const dimMap: Record<string, DimData> = {};
  for (const [dimKey, meta] of Object.entries(DIMENSION_MAP)) {
    dimMap[dimKey] = { key: dimKey, ...meta, incidents: 0, pct: 0, status: 'clear' };
  }

  for (const agg of aggs) {
    const dim = agg.dimension;
    if (!dimMap[dim]) {
      // Unmapped dimension — try to find closest or skip
      continue;
    }
    dimMap[dim].incidents += agg.occurrences;
    if (agg.severity === 'critical') {
      dimMap[dim].status = 'critical';
    } else if (agg.severity === 'high' && dimMap[dim].status !== 'critical') {
      dimMap[dim].status = 'elevated';
    } else if (dimMap[dim].status === 'clear' && dimMap[dim].incidents > 0) {
      dimMap[dim].status = 'elevated';
    }
  }

  const allDims = Object.values(dimMap).map(d => ({
    ...d,
    pct: totalIncidents > 0 ? (d.incidents / totalIncidents) * 100 : 0,
  }));

  const activeDims = allDims.filter(d => d.incidents > 0).sort((a, b) => b.incidents - a.incidents);
  const clearDims = allDims.filter(d => d.incidents === 0);

  const maxIncidents = activeDims.length > 0 ? activeDims[0].incidents : 1;

  const topDim = activeDims[0];
  const otherDims = activeDims.slice(1);

  // ─── Incident Share ──────────────────────────────────────────────────────────

  const totalSev = severity.critical + severity.high + severity.mediumLow || 1;
  const critPct = (severity.critical / totalSev) * 100;
  const highPct = (severity.high / totalSev) * 100;
  const medLowPct = (severity.mediumLow / totalSev) * 100;

  // Legend colors for dim share
  const dimColors: Record<string, string> = {};
  for (const d of activeDims) {
    dimColors[d.key] = d.status === 'critical' ? '#EF4444' : '#F59E0B';
  }

  const recommendation = severity.critical > 0
    ? 'Address critical incidents immediately and schedule training review within 1 week.'
    : severity.high > 0
      ? 'Focus on high-severity issues in weekly team review. Prioritize Week 1 script fixes.'
      : 'Maintain current performance. Implement preventive measures in Week 3.';

  return (
    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', background: '#EDF0F5', minHeight: '100vh' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 40px' }}>

        {/* Back button */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => goToStep('fixes')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: '#475569',
              background: 'white', border: '1px solid #E2E8F0',
              borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
            }}
          >
            ← Back to Fixes
          </button>
        </div>

        {/* ── SECTION 1: Header ── */}
        <div style={{
          background: '#0F172A', borderRadius: 20, padding: '24px 28px',
          marginBottom: 12, position: 'relative', overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
        }}>
          {/* Decorative glows */}
          <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '50%', height: '200%', background: 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'absolute', bottom: '-60%', left: '30%', width: '60%', height: '200%', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* Left column */}
            <div style={{ flexGrow: 1 }}>
              {/* Small label row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.5)' }} />
                <span style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>AI AGENT CONTROL CENTER</span>
              </div>
              {/* H1 */}
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'white', margin: '0 0 6px' }}>Agent Diagnostic Report</h1>
              {/* Subtitle */}
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Run: {runName} · Date: {date} · Confidential QA Report</p>
              {/* Badges */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#FCA5A5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 20, padding: '4px 10px' }}>🔴 {severity.critical} Critical</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#FCD34D', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 20, padding: '4px 10px' }}>🟡 {severity.high} High Severity</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.22)', borderRadius: 20, padding: '4px 10px' }}>⚫ {severity.mediumLow} Medium / Low</span>
              </div>
            </div>
            {/* Right column — DonutGauge */}
            <div style={{ flexShrink: 0 }}>
              <DonutGauge score={qaScore} />
            </div>
          </div>

          {/* Bottom accent line */}
          <div style={{ position: 'relative', zIndex: 1, marginTop: 20, height: 3, borderRadius: 2, background: 'linear-gradient(90deg, #14B8A6, #6366F1, #14B8A6)' }} />
        </div>

        {/* ── SECTION 2: Key Metrics ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
          <MetricCard
            label="Total Calls"
            value={totalCalls}
            icon={<svg width={18} height={18} fill="none" stroke="#14B8A6" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>}
            iconBg="#F0FDFA"
            color="#14B8A6"
            fillPct={100}
            subtext="Total call sessions"
          />
          <MetricCard
            label="Total Incidents"
            value={totalIncidents}
            icon={<svg width={18} height={18} fill="none" stroke="#F59E0B" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"/></svg>}
            iconBg="#FFFBEB"
            color="#F59E0B"
            fillPct={100}
            subtext="Across all dimensions"
          />
          <MetricCard
            label="Calls Affected"
            value={callsAffected}
            icon={null}
            color="#EF4444"
            fillPct={callsAffectedPct}
            subtext="Of total call sessions"
            badge={`${callsAffectedPct}%`}
            borderTop="3px solid #EF4444"
          />
          <MetricCard
            label="Fixes Identified"
            value={fixesIdentified}
            icon={<svg width={18} height={18} fill="none" stroke="#6366F1" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>}
            iconBg="#EEF2FF"
            color="#6366F1"
            fillPct={100}
            subtext="Actionable improvements"
          />
        </div>

        {/* ── SECTION 3: Two-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 210px', gap: 12, marginBottom: 12 }}>

          {/* LEFT: Performance by Dimension */}
          <div style={{ background: 'white', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 4, height: 20, background: '#14B8A6', borderRadius: 2 }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Performance by Dimension</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>Critical</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>Elevated</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>No Issues</span>
                </div>
              </div>
            </div>

            {/* Top dimension */}
            {topDim && (
              <div style={{ background: '#FFF5F5', borderLeft: '3px solid #EF4444', borderRadius: 12, padding: 16, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{topDim.letter}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{topDim.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: '2px 6px' }}>CRITICAL</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748B' }}>{topDim.desc}</span>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#EF4444', flexShrink: 0 }}>{topDim.incidents}</span>
                </div>
                <div style={{ height: 9, background: '#FEE2E2', borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: '100%', background: '#EF4444', borderRadius: 5 }} />
                </div>
                <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>▲ Top issue — {topDim.pct.toFixed(0)}% of all incidents</div>
              </div>
            )}

            {/* Other active dimensions */}
            {otherDims.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {otherDims.map(dim => {
                  const barColor = dim.status === 'critical' ? '#EF4444' : '#F59E0B';
                  const trackColor = dim.status === 'critical' ? '#FEE2E2' : '#FEF3C7';
                  const badgeBg = dim.status === 'critical' ? '#FEE2E2' : '#FEF3C7';
                  const badgeText = dim.status === 'critical' ? '#EF4444' : '#F59E0B';
                  const badgeLabel = dim.status === 'critical' ? 'CRITICAL' : 'ELEVATED';
                  const fillPct = maxIncidents > 0 ? (dim.incidents / maxIncidents) * 100 : 0;

                  return (
                    <div key={dim.key} style={{ padding: 12, borderRadius: 10, background: '#FAFAFA', border: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: badgeText, fontWeight: 700, fontSize: 12 }}>{dim.letter}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{dim.name}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: badgeText, background: badgeBg, borderRadius: 4, padding: '1px 5px' }}>{badgeLabel}</span>
                          </div>
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>{dim.desc}</span>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: barColor, flexShrink: 0 }}>{dim.incidents}</span>
                      </div>
                      <div style={{ height: 7, background: trackColor, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${fillPct}%`, background: barColor, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No active dims fallback */}
            {activeDims.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 13 }}>No incidents detected across all dimensions.</div>
            )}

            {/* Clear divider */}
            {clearDims.length > 0 && (
              <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 14, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: '#10B981', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>✓ No Issues Detected in These Areas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {clearDims.map(dim => (
                    <div key={dim.key} style={{ background: '#F0FDF4', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#059669', fontWeight: 700, fontSize: 11 }}>{dim.letter}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{dim.name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#059669', background: '#D1FAE5', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>✓ Clear</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Card 1: Incident Severity */}
            <div style={{ background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(15,23,42,0.06)', borderLeft: '4px solid #F59E0B' }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>Incident Severity</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>Distribution across levels</div>
              </div>
              {/* Critical */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
                    <span style={{ fontSize: 11, color: '#475569' }}>Critical</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: severity.critical === 0 ? '#10B981' : '#EF4444' }}>{severity.critical}</span>
                </div>
                <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${critPct}%`, background: '#EF4444', borderRadius: 2 }} />
                </div>
              </div>
              {/* High */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                    <span style={{ fontSize: 11, color: '#475569' }}>High</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>{severity.high}</span>
                </div>
                <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${highPct}%`, background: '#F59E0B', borderRadius: 2 }} />
                </div>
              </div>
              {/* Med/Low */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#94A3B8' }} />
                    <span style={{ fontSize: 11, color: '#475569' }}>Med/Low</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>{severity.mediumLow}</span>
                </div>
                <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${medLowPct}%`, background: '#94A3B8', borderRadius: 2 }} />
                </div>
              </div>
              {/* Footer callout */}
              <div style={{ background: '#F0FDF4', borderLeft: '3px solid #10B981', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ fontSize: 11, color: '#059669' }}>
                  {severity.critical === 0 ? '✓ No critical incidents detected' : `${severity.critical} critical issue${severity.critical > 1 ? 's' : ''} require immediate attention`}
                </span>
              </div>
            </div>

            {/* Card 2: Incident Share */}
            <div style={{ background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(15,23,42,0.06)', borderLeft: '4px solid #6366F1' }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>Incident Share</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>By dimension</div>
              </div>
              {/* Stacked bar */}
              <div style={{ height: 18, borderRadius: 9, overflow: 'hidden', display: 'flex', marginBottom: 12, background: '#F1F5F9' }}>
                {activeDims.map((d, i) => (
                  <div
                    key={d.key}
                    style={{
                      height: '100%',
                      width: `${d.pct}%`,
                      background: dimColors[d.key] || '#94A3B8',
                      marginLeft: i > 0 ? 2 : 0,
                    }}
                  />
                ))}
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeDims.slice(0, 4).map(d => (
                  <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: dimColors[d.key] || '#94A3B8', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#475569', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{d.incidents}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{d.pct.toFixed(0)}%</span>
                  </div>
                ))}
                {activeDims.length === 0 && (
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>No incidents to display</span>
                )}
              </div>
            </div>

            {/* Card 3: Risk Assessment */}
            <div style={{ background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(15,23,42,0.06)', borderLeft: '4px solid #EF4444' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Risk Assessment</div>
              {/* Risk boxes */}
              <div style={{ background: '#F0FDF4', borderLeft: '3px solid #10B981', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>IMMEDIATE RISK</div>
                <div style={{ fontSize: 11, color: '#0F172A' }}>
                  {severity.critical > 0 ? 'Critical incidents found — immediate action required' : 'No immediate critical risks identified'}
                </div>
              </div>
              <div style={{ background: '#F0FDF4', borderLeft: '3px solid #10B981', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>MEDIUM-TERM RISK</div>
                <div style={{ fontSize: 11, color: '#0F172A' }}>
                  {severity.high > 0 ? `${severity.high} high-severity issue${severity.high > 1 ? 's' : ''} need attention within 2 weeks` : 'Low medium-term risk if fixes are applied'}
                </div>
              </div>
              {/* Dark recommendation */}
              <div style={{ background: '#0F172A', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#14B8A6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>RECOMMENDATION</div>
                <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.5 }}>{recommendation}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 4: 3-Week Action Plan ── */}
        <div style={{ marginBottom: 12 }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 4, height: 20, background: '#6366F1', borderRadius: 2 }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>3-Week Action Plan</span>
            <span style={{ fontSize: 13, color: '#94A3B8', marginLeft: 4 }}>· Target: {qaScore} → 100 in 3 weeks</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>

            {/* Week 1 */}
            <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
              <div style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)', padding: 16 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>WEEK 1</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>{week1.length}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Prompt & Script Updates</div>
              </div>
              <div style={{ background: 'white', padding: 14 }}>
                {week1.length > 0 ? (
                  <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: '#475569', lineHeight: 1.8 }}>
                    {week1.slice(0, 3).map(f => (
                      <li key={f.id} style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.title}</li>
                    ))}
                    {week1.length > 3 && <li style={{ color: '#94A3B8' }}>+{week1.length - 3} more</li>}
                  </ul>
                ) : (
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>No script fixes scheduled</span>
                )}
                <div style={{ background: '#F0FDFA', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 8, padding: '8px 12px', marginTop: 12 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#14B8A6' }}>+{w1Pts} pts</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>est. QA improvement</div>
                </div>
              </div>
            </div>

            {/* Week 2 */}
            <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.06)', opacity: 0.85 }}>
              <div style={{ background: 'linear-gradient(135deg, #64748B, #475569)', padding: 16 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>WEEK 2</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>{week2.length}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Process & Workflow</div>
              </div>
              <div style={{ background: 'white', padding: 14 }}>
                {week2.length > 0 ? (
                  <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: '#475569', lineHeight: 1.8 }}>
                    {week2.slice(0, 3).map(f => (
                      <li key={f.id} style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.title}</li>
                    ))}
                    {week2.length > 3 && <li style={{ color: '#94A3B8' }}>+{week2.length - 3} more</li>}
                  </ul>
                ) : (
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>No fixes scheduled · Observation & monitoring period</span>
                )}
                <div style={{ background: '#F8FAFC', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 8, padding: '8px 12px', marginTop: 12 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#64748B' }}>+{w2Pts} pts</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>est. QA improvement</div>
                </div>
              </div>
            </div>

            {/* Week 3 */}
            <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
              <div style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', padding: 16 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>WEEK 3</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>{week3.length}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Training & System</div>
              </div>
              <div style={{ background: 'white', padding: 14 }}>
                {week3.length > 0 ? (
                  <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: '#475569', lineHeight: 1.8 }}>
                    {week3.slice(0, 3).map(f => (
                      <li key={f.id} style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.title}</li>
                    ))}
                    {week3.length > 3 && <li style={{ color: '#94A3B8' }}>+{week3.length - 3} more</li>}
                  </ul>
                ) : (
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>No training fixes scheduled</span>
                )}
                <div style={{ background: '#EEF2FF', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '8px 12px', marginTop: 12 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#6366F1' }}>+{w3Pts} pts</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>est. QA improvement</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── SECTION 5: Projection Footer ── */}
        <div style={{
          background: '#0F172A', borderRadius: 20, padding: '22px 26px',
          boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>

            {/* Col 1: Score Change */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 14 }}>PROJECTED QA SCORE</div>
              {/* Now row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#64748B', minWidth: 40 }}>Now</span>
                <span style={{ fontSize: 44, fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>{qaScore}</span>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
                    <span style={{ fontSize: 13, color: '#F59E0B' }}>{scoreLabel}</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 22, color: '#334155', marginBottom: 8 }}>→</div>
              {/* Week 3 row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#64748B', minWidth: 40 }}>Week 3</span>
                <span style={{ fontSize: 44, fontWeight: 800, color: '#14B8A6', lineHeight: 1 }}>{projectedFinalScore}</span>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#14B8A6' }} />
                    <span style={{ fontSize: 13, color: '#14B8A6' }}>{getScoreStatus(projectedFinalScore).label}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Col 2: Progress Bars */}
            <div style={{ flex: 1.4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#64748B' }}>Current</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>{qaScore}/100</span>
              </div>
              <div style={{ height: 12, background: '#1E293B', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', width: `${qaScore}%`, background: 'linear-gradient(90deg, #F59E0B, #FBBF24)', borderRadius: 6 }} />
              </div>
              {/* Mini step grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 12 }}>
                {[
                  { label: 'W1', score: scoreAfterW1, color: '#14B8A6' },
                  { label: 'W2', score: scoreAfterW2, color: '#64748B' },
                  { label: 'W3', score: projectedFinalScore, color: projectedFinalScore > scoreAfterW2 ? '#14B8A6' : '#64748B' },
                ].map(step => (
                  <div key={step.label} style={{ background: '#1E293B', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>{step.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: step.color }}>{step.score}</div>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: step.color, margin: '3px auto 0' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#64748B' }}>Projected</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>{projectedFinalScore}/100</span>
              </div>
              <div style={{ height: 12, background: '#1E293B', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${projectedFinalScore}%`, background: 'linear-gradient(90deg, #14B8A6, #10B981)', borderRadius: 6 }} />
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>
                Based on {fixesIdentified} identified fix{fixesIdentified !== 1 ? 'es' : ''} across {week1.length ? 'script, ' : ''}{week2.length ? 'process, ' : ''}{week3.length ? 'training & system' : ''} categories.
              </div>
            </div>

            {/* Col 3: Uplift Tile */}
            <div style={{ flexShrink: 0 }}>
              <div style={{
                background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.25)',
                borderRadius: 16, padding: '20px 24px', height: '100%',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 10, color: '#14B8A6', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>TOTAL UPLIFT</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: '#14B8A6' }}>+{totalGap}</span>
                  <span style={{ fontSize: 16, color: '#14B8A6', fontWeight: 600 }}>pts</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                    <span style={{ fontSize: 11, color: '#475569' }}>W1</span>
                    <span style={{ fontSize: 11, color: '#14B8A6', fontWeight: 600 }}>+{w1Pts}pts</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                    <span style={{ fontSize: 11, color: '#475569' }}>W2</span>
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>+{w2Pts}pts</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                    <span style={{ fontSize: 11, color: '#475569' }}>W3</span>
                    <span style={{ fontSize: 11, color: '#14B8A6', fontWeight: 600 }}>+{w3Pts}pts</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
