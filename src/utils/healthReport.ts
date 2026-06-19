import jsPDF from 'jspdf';
import { AggregatedScenario, EnhancedFix, Scenario } from '@/types';

// ─── Public interface ────────────────────────────────────────────────────────

export interface HealthReportData {
  scenarios: Scenario[];
  aggregatedScenarios: AggregatedScenario[];
  fixes: EnhancedFix[];
  totalCalls: number;
  runName?: string;
  analysisDate?: string;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface Grade {
  label: string;
  color: [number, number, number];
  bgColor: [number, number, number];
}

interface Driver {
  label: string;
  pct: number;
  color: [number, number, number];
}

interface Opp {
  title: string;
  pct: number;
  scoreFrom: number;
  scoreTo: number;
}

interface Finding {
  severity: string;
  text: string;
  sevColor: [number, number, number];
  sevBg: [number, number, number];
}

interface Action {
  num: number;
  title: string;
  reason: string;
  gain: number;
  color: [number, number, number];
}

// ─── Weights & penalties ──────────────────────────────────────────────────────

const SEV_W: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const SEV_P: Record<string, number> = { low: 3, medium: 8, high: 15, critical: 25 };

// ─── Data helpers ─────────────────────────────────────────────────────────────

function computeScore(scenarios: Scenario[], totalCalls: number): number {
  if (totalCalls === 0) return 100;
  const pen = scenarios.reduce((s, sc) => s + (SEV_P[sc.severity] ?? 3), 0);
  return Math.max(0, Math.min(100, Math.round(100 - pen / totalCalls)));
}

function getGrade(score: number): Grade {
  if (score >= 80) return { label: 'Good',            color: [21, 128, 61],  bgColor: [220, 252, 231] };
  if (score >= 60) return { label: 'Needs Attention', color: [133, 77, 14],  bgColor: [254, 243, 199] };
  if (score >= 40) return { label: 'At Risk',         color: [154, 52, 18],  bgColor: [255, 237, 213] };
  return             { label: 'Critical',             color: [153, 27, 27],  bgColor: [254, 226, 226] };
}

const DIM_SHORT: Record<string, string> = {
  A: 'Conversation Flow',
  B: 'Empathy & Tone',
  C: 'Knowledge & Accuracy',
  D: 'Script Adherence',
  E: 'Resolution & Outcome',
  F: 'Communication Clarity',
  G: 'Novel Issues',
};

const DRIVER_COLORS: [number, number, number][] = [
  [239, 68, 68],
  [245, 158, 11],
  [139, 92, 246],
  [59, 130, 246],
  [100, 116, 139],
];

function computeDrivers(scenarios: Scenario[]): Driver[] {
  const wts: Record<string, number> = {};
  let total = 0;
  scenarios.forEach(s => {
    const key = (s.dimension ?? '').trim().toUpperCase().charAt(0);
    const label = DIM_SHORT[key] ?? (s.dimension?.trim() || 'Other');
    const w = SEV_W[s.severity] ?? 1;
    wts[label] = (wts[label] ?? 0) + w;
    total += w;
  });
  if (!total) return [];
  return Object.entries(wts)
    .map(([label, w], i) => ({ label, pct: Math.round((w / total) * 100), color: DRIVER_COLORS[i % DRIVER_COLORS.length] }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);
}

function getBiggestOpp(aggs: AggregatedScenario[], score: number): Opp {
  if (!aggs.length) return { title: 'No issues detected', pct: 0, scoreFrom: score, scoreTo: score };
  const sorted = [...aggs].sort((a, b) => SEV_W[b.severity] * b.occurrences - SEV_W[a.severity] * a.occurrences);
  const top = sorted[0];
  const totalW = aggs.reduce((s, a) => s + SEV_W[a.severity] * a.occurrences, 0);
  const pct = totalW > 0 ? Math.round((SEV_W[top.severity] * top.occurrences / totalW) * 100) : 0;
  return { title: top.title, pct, scoreFrom: score, scoreTo: Math.min(100, score + Math.min(15, Math.round(pct * 0.22))) };
}

const SEV_COLOR: Record<string, [number, number, number]> = {
  critical: [153, 27, 27],
  high:     [154, 52, 18],
  medium:   [133, 77, 14],
  low:      [21, 128, 61],
};

const SEV_BG: Record<string, [number, number, number]> = {
  critical: [254, 226, 226],
  high:     [255, 237, 213],
  medium:   [254, 243, 199],
  low:      [220, 252, 231],
};

function getKeyFindings(aggs: AggregatedScenario[]): Finding[] {
  return [...aggs]
    .sort((a, b) => SEV_W[b.severity] * b.occurrences - SEV_W[a.severity] * a.occurrences)
    .slice(0, 6)
    .map(a => {
      const n = a.uniqueCalls ?? a.occurrences;
      return {
        severity: a.severity,
        text: `${a.title} — ${n} interaction${n !== 1 ? 's' : ''}`,
        sevColor: SEV_COLOR[a.severity] ?? [100, 116, 139],
        sevBg:   SEV_BG[a.severity]   ?? [241, 245, 249],
      };
    });
}

function getTopActions(fixes: EnhancedFix[], scenarios: Scenario[]): Action[] {
  const rcaCount: Record<string, number> = {};
  scenarios.forEach(s => { if (s.rootCauseType) rcaCount[s.rootCauseType] = (rcaCount[s.rootCauseType] ?? 0) + 1; });
  const total = Math.max(1, scenarios.length);
  const palette: [number, number, number][] = [[239, 68, 68], [245, 158, 11], [59, 130, 246]];
  return fixes.slice(0, 3).map((f, i): Action => ({
    num: i + 1,
    title: f.title,
    reason: f.suggestedSolution,
    gain: Math.min(12, Math.max(1, Math.round(((rcaCount[f.rootCauseType] ?? 0) / total) * 20))),
    color: palette[i],
  }));
}

function calcProjected(score: number, fixes: EnhancedFix[], scenarios: Scenario[]): number {
  const total = scenarios.length;
  if (!total) return score;
  const rcaCount: Record<string, number> = {};
  scenarios.forEach(s => { if (s.rootCauseType) rcaCount[s.rootCauseType] = (rcaCount[s.rootCauseType] ?? 0) + 1; });
  const rec = fixes.reduce((s, f) => s + Math.min(5, ((rcaCount[f.rootCauseType] ?? 0) / total) * 20), 0);
  return Math.min(100, Math.round(score + Math.min(30, rec)));
}

// ─── PDF primitives ───────────────────────────────────────────────────────────

function fill(doc: jsPDF, r: number, g: number, b: number) { doc.setFillColor(r, g, b); }
function ink(doc: jsPDF, r: number, g: number, b: number)  { doc.setTextColor(r, g, b); }
function bold(doc: jsPDF, sz: number)   { doc.setFont('helvetica', 'bold');   doc.setFontSize(sz); }
function normal(doc: jsPDF, sz: number) { doc.setFont('helvetica', 'normal'); doc.setFontSize(sz); }
function italic(doc: jsPDF, sz: number) { doc.setFont('helvetica', 'italic'); doc.setFontSize(sz); }

function cardBg(doc: jsPDF, x: number, y: number, w: number, h: number, topAccent?: [number, number, number]) {
  fill(doc, 255, 255, 255);
  doc.rect(x, y, w, h, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'S');
  if (topAccent) {
    fill(doc, topAccent[0], topAccent[1], topAccent[2]);
    doc.rect(x, y, w, 2, 'F');
  }
}

function sectionEyebrow(doc: jsPDF, label: string, x: number, y: number, color: [number, number, number]): number {
  fill(doc, color[0], color[1], color[2]);
  doc.rect(x, y, 2.5, 5.5, 'F');
  ink(doc, 15, 23, 42);
  bold(doc, 7.5);
  doc.text(label, x + 5, y + 4.5);
  return y + 10;
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function drawRing(
  doc: jsPDF,
  cx: number, cy: number,
  outerR: number, innerR: number,
  score: number,
  color: [number, number, number],
) {
  fill(doc, 226, 232, 240);
  doc.circle(cx, cy, outerR, 'F');

  const pct = Math.min(score / 100, 0.9999);
  const startA = -Math.PI / 2;
  const STEPS = 72;
  fill(doc, color[0], color[1], color[2]);
  for (let i = 0; i < STEPS; i++) {
    if (i / STEPS >= pct) break;
    const a1 = startA + 2 * Math.PI * (i / STEPS);
    const a2 = startA + 2 * Math.PI * Math.min((i + 1) / STEPS, pct);
    const r = outerR + 0.3;
    doc.triangle(cx, cy, cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2), 'F');
  }

  fill(doc, 255, 255, 255);
  doc.circle(cx, cy, innerR, 'F');
}

// ─── Page chrome ──────────────────────────────────────────────────────────────

function drawHeader(doc: jsPDF, W: number, data: HealthReportData): number {
  fill(doc, 15, 23, 42);
  doc.rect(0, 0, W, 20, 'F');

  ink(doc, 255, 255, 255);
  bold(doc, 13);
  doc.text('AI Agent Audit Report', 14, 9);

  italic(doc, 7);
  ink(doc, 148, 163, 184);
  const sub = [
    data.runName && `Run: ${data.runName}`,
    data.analysisDate ?? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  ].filter(Boolean).join('   ·   ');
  doc.text(sub, 14, 16.5);

  fill(doc, 20, 184, 166);
  doc.rect(0, 20, W, 2, 'F');
  return 26;
}

function drawFooter(doc: jsPDF, W: number, H: number) {
  fill(doc, 241, 245, 249);
  doc.rect(0, H - 9, W, 9, 'F');
  ink(doc, 148, 163, 184);
  normal(doc, 6.5);
  doc.text(
    'AI Agent Control Center  ·  Confidential Audit Report  ·  For internal use only',
    W / 2, H - 3.5, { align: 'center' },
  );
}

// ─── Section: Agent Audit Score ───────────────────────────────────────────────

function drawScoreCard(
  doc: jsPDF,
  score: number,
  grade: Grade,
  date: string,
  x: number, y: number, w: number, h: number,
) {
  cardBg(doc, x, y, w, h, grade.color);

  // Section label
  ink(doc, grade.color[0], grade.color[1], grade.color[2]);
  bold(doc, 6.5);
  doc.text('AGENT AUDIT SCORE', x + w / 2, y + 8, { align: 'center' });

  // Ring
  const ringCy = y + 37;
  drawRing(doc, x + w / 2, ringCy, 22, 15, score, grade.color);

  // Score
  ink(doc, grade.color[0], grade.color[1], grade.color[2]);
  bold(doc, 20);
  doc.text(String(score), x + w / 2, ringCy + 3.5, { align: 'center' });
  ink(doc, 148, 163, 184);
  normal(doc, 7);
  doc.text('/ 100', x + w / 2, ringCy + 10.5, { align: 'center' });

  // Status badge
  const badgeY = y + h - 21;
  fill(doc, grade.bgColor[0], grade.bgColor[1], grade.bgColor[2]);
  doc.rect(x + 6, badgeY, w - 12, 10, 'F');
  ink(doc, grade.color[0], grade.color[1], grade.color[2]);
  bold(doc, 9);
  doc.text(grade.label.toUpperCase(), x + w / 2, badgeY + 7, { align: 'center' });

  // Run date
  normal(doc, 6.5);
  ink(doc, 148, 163, 184);
  doc.text(date, x + w / 2, y + h - 5, { align: 'center' });
}

// ─── Section: Executive Summary ───────────────────────────────────────────────

function drawExecutiveSummary(
  doc: jsPDF,
  score: number,
  drivers: Driver[],
  projected: number,
  x: number, y: number, w: number, h: number,
) {
  cardBg(doc, x, y, w, h, [59, 130, 246]);

  let cy = y + 7;
  cy = sectionEyebrow(doc, 'EXECUTIVE SUMMARY', x + 6, cy, [59, 130, 246]);

  // Narrative
  const gain = Math.max(0, projected - score);
  const narrative = score >= 80
    ? `Agent performance is stable with no critical failures detected. Quality gaps are present but non-blocking. Potential improvement opportunity: +${gain} points.`
    : score >= 60
    ? `Agent performance needs attention. Recurring quality issues are impacting call consistency. Potential improvement opportunity: +${gain} points with targeted corrections.`
    : `Agent performance is at risk. Significant quality failures detected across multiple dimensions. Estimated recovery potential: +${gain} points with immediate action.`;

  normal(doc, 8.5);
  ink(doc, 55, 65, 81);
  const narLines = doc.splitTextToSize(narrative, w - 12);
  doc.text(narLines.slice(0, 3), x + 6, cy);
  cy += narLines.slice(0, 3).length * 5.2 + 5;

  // Primary quality loss section
  if (drivers.length > 0) {
    bold(doc, 7);
    ink(doc, 100, 116, 139);
    doc.text('PRIMARY QUALITY LOSS ORIGINATES FROM', x + 6, cy);
    cy += 6;

    const barX = x + 74;
    const barW = w - 80;

    drivers.forEach(d => {
      normal(doc, 7.5);
      ink(doc, 55, 65, 81);
      const label = d.label.length > 21 ? d.label.slice(0, 21) + '…' : d.label;
      doc.text(label, x + 6, cy);

      fill(doc, 226, 232, 240);
      doc.rect(barX, cy - 4, barW, 4.5, 'F');
      fill(doc, d.color[0], d.color[1], d.color[2]);
      doc.rect(barX, cy - 4, barW * (d.pct / 100), 4.5, 'F');

      bold(doc, 7.5);
      ink(doc, 15, 23, 42);
      doc.text(`${d.pct}%`, x + w - 4, cy, { align: 'right' });

      cy += 7;
    });
  }
}

// ─── Section: Highest Impact Improvement ─────────────────────────────────────

function drawImprovementCard(doc: jsPDF, opp: Opp, x: number, y: number, w: number, h: number) {
  cardBg(doc, x, y, w, h, [245, 158, 11]);

  let cy = y + 7;
  cy = sectionEyebrow(doc, 'HIGHEST IMPACT IMPROVEMENT', x + 5, cy, [245, 158, 11]);

  // Issue title
  ink(doc, 15, 23, 42);
  bold(doc, 9.5);
  const titleLines = doc.splitTextToSize(opp.title, w - 10);
  doc.text(titleLines.slice(0, 2), x + 5, cy);
  cy += Math.min(2, titleLines.length) * 5.5 + 3;

  // Contribution stat
  ink(doc, 133, 77, 14);
  normal(doc, 7.5);
  const statLines = doc.splitTextToSize(`${opp.pct}% of quality loss originates from this category`, w - 10);
  doc.text(statLines.slice(0, 2), x + 5, cy);
  cy += Math.min(2, statLines.length) * 4.5 + 6;

  // Expected score gain block
  const jumpH = 20;
  fill(doc, 248, 250, 252);
  doc.rect(x + 5, cy, w - 10, jumpH, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.rect(x + 5, cy, w - 10, jumpH, 'S');

  // "Expected score gain" label
  bold(doc, 6.5);
  ink(doc, 100, 116, 139);
  doc.text('EXPECTED SCORE GAIN', x + 5 + (w - 10) / 2, cy + 5, { align: 'center' });

  ink(doc, 100, 116, 139);
  bold(doc, 18);
  doc.text(String(opp.scoreFrom), x + 5 + (w - 10) * 0.22, cy + 16, { align: 'center' });

  ink(doc, 21, 128, 61);
  bold(doc, 11);
  doc.text('→', x + 5 + (w - 10) * 0.5, cy + 16, { align: 'center' });

  ink(doc, 21, 128, 61);
  bold(doc, 18);
  doc.text(String(opp.scoreTo), x + 5 + (w - 10) * 0.78, cy + 16, { align: 'center' });

  normal(doc, 6);
  ink(doc, 148, 163, 184);
  doc.text('Current', x + 5 + (w - 10) * 0.22, cy + jumpH - 1.5, { align: 'center' });
  doc.text('After Fix', x + 5 + (w - 10) * 0.78, cy + jumpH - 1.5, { align: 'center' });
}

// ─── Section: Key Findings ────────────────────────────────────────────────────

function drawKeyFindings(doc: jsPDF, findings: Finding[], x: number, y: number, w: number, h: number) {
  cardBg(doc, x, y, w, h, [30, 41, 59]);

  let cy = y + 7;
  cy = sectionEyebrow(doc, 'KEY FINDINGS', x + 5, cy, [30, 41, 59]);

  if (!findings.length) {
    italic(doc, 8);
    ink(doc, 148, 163, 184);
    doc.text('No significant findings detected', x + 5, cy + 5);
    return;
  }

  findings.forEach(f => {
    // Severity pill
    fill(doc, f.sevBg[0], f.sevBg[1], f.sevBg[2]);
    doc.rect(x + 5, cy - 3.5, 22, 5.5, 'F');
    bold(doc, 6);
    ink(doc, f.sevColor[0], f.sevColor[1], f.sevColor[2]);
    doc.text(f.severity.toUpperCase(), x + 16, cy + 0.5, { align: 'center' });

    // Finding text
    normal(doc, 7.5);
    ink(doc, 55, 65, 81);
    const lines = doc.splitTextToSize(f.text, w - 33);
    doc.text(lines[0], x + 30, cy + 0.5);

    cy += 8;
  });
}

// ─── Section: Recommended Actions ────────────────────────────────────────────

function drawRecommendedActions(doc: jsPDF, actions: Action[], x: number, y: number, totalW: number, h: number) {
  if (!actions.length) return;
  const colW = (totalW - 10) / 3;

  actions.slice(0, 3).forEach((action, i) => {
    const cx = x + i * (colW + 5);
    cardBg(doc, cx, y, colW, h, action.color);

    // Left accent stripe
    fill(doc, action.color[0], action.color[1], action.color[2]);
    doc.rect(cx, y, 2.5, h, 'F');

    let cy = y + 8;

    // Action label
    bold(doc, 7);
    ink(doc, action.color[0], action.color[1], action.color[2]);
    doc.text(`ACTION #${action.num}`, cx + 6, cy + 1);
    cy += 10;

    // Title
    ink(doc, 15, 23, 42);
    bold(doc, 9.5);
    const titleLines = doc.splitTextToSize(action.title, colW - 10);
    doc.text(titleLines.slice(0, 2), cx + 6, cy);
    cy += Math.min(2, titleLines.length) * 5.5 + 3;

    // Reason
    normal(doc, 7.5);
    ink(doc, 100, 116, 139);
    const reasonLines = doc.splitTextToSize(action.reason, colW - 10);
    doc.text(reasonLines.slice(0, 4), cx + 6, cy);

    // Expected impact badge
    const badgeY = y + h - 13;
    fill(doc, action.color[0], action.color[1], action.color[2]);
    doc.rect(cx + 6, badgeY, colW - 12, 9, 'F');
    ink(doc, 255, 255, 255);
    bold(doc, 7.5);
    doc.text(`Expected Impact: +${action.gain} points`, cx + colW / 2, badgeY + 6.2, { align: 'center' });
  });
}

// ─── Section: Expected Impact ─────────────────────────────────────────────────

function drawExpectedImpact(
  doc: jsPDF,
  score: number,
  projected: number,
  actionCount: number,
  x: number, y: number, w: number, h: number,
) {
  fill(doc, 15, 23, 42);
  doc.rect(x, y, w, h, 'F');

  ink(doc, 20, 184, 166);
  bold(doc, 7);
  doc.text('EXPECTED IMPACT', x + 10, y + 8);

  const midY = y + h / 2 + 4;

  // Current score
  ink(doc, 100, 116, 139);
  bold(doc, 26);
  doc.text(String(score), x + 34, midY, { align: 'center' });
  normal(doc, 6.5);
  ink(doc, 100, 116, 139);
  doc.text('CURRENT', x + 34, midY + 8, { align: 'center' });

  // Arrow
  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(0.7);
  doc.line(x + 52, midY - 2.5, x + 80, midY - 2.5);
  fill(doc, 20, 184, 166);
  doc.triangle(x + 82, midY - 2.5, x + 78, midY - 5.5, x + 78, midY + 0.5, 'F');
  doc.setLineWidth(0.2);

  // Projected score
  ink(doc, 21, 128, 61);
  bold(doc, 26);
  doc.text(String(projected), x + 100, midY, { align: 'center' });
  normal(doc, 6.5);
  doc.text('PROJECTED', x + 100, midY + 8, { align: 'center' });

  // Stats
  const stats = [
    { label: 'TIMELINE',    value: '3 Weeks' },
    { label: 'ACTIONS',     value: String(actionCount) },
    { label: 'TOTAL GAIN',  value: `+${Math.max(0, projected - score)}` },
  ];

  const statsStartX = x + w - 110;
  stats.forEach((s, i) => {
    const sx = statsStartX + i * 37;
    bold(doc, 11);
    ink(doc, 255, 255, 255);
    doc.text(s.value, sx, midY, { align: 'center' });
    normal(doc, 6);
    ink(doc, 100, 116, 139);
    doc.text(s.label, sx, midY + 8, { align: 'center' });
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateHealthReportPDF(data: HealthReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.width;   // 210mm
  const H = doc.internal.pageSize.height;  // 297mm
  const M = 12;                            // left/right margin
  const CW = W - 2 * M;                   // 186mm content width

  // ── Precompute ──────────────────────────────────────────────────────────────
  const score     = computeScore(data.scenarios, data.totalCalls);
  const grade     = getGrade(score);
  const drivers   = computeDrivers(data.scenarios);
  const opp       = getBiggestOpp(data.aggregatedScenarios, score);
  const findings  = getKeyFindings(data.aggregatedScenarios);
  const actions   = getTopActions(data.fixes, data.scenarios);
  const projected = calcProjected(score, data.fixes, data.scenarios);
  const dateStr   = data.analysisDate ?? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // ── Page chrome ─────────────────────────────────────────────────────────────
  let y = drawHeader(doc, W, data);
  drawFooter(doc, W, H);

  // ── ROW 1: Agent Audit Score (62mm) + Executive Summary (119mm)  h=78 ──────
  const HERO_H  = 78;
  const SCORE_W = 62;
  const SUMM_W  = CW - SCORE_W - 5;

  drawScoreCard(doc, score, grade, dateStr, M, y, SCORE_W, HERO_H);
  drawExecutiveSummary(doc, score, drivers, projected, M + SCORE_W + 5, y, SUMM_W, HERO_H);
  y += HERO_H + 5;

  // ── ROW 2: Highest Impact Improvement (88mm) + Key Findings (93mm)  h=62 ──
  const MID_H  = 62;
  const IMP_W  = 88;
  const FIND_W = CW - IMP_W - 5;

  drawImprovementCard(doc, opp, M, y, IMP_W, MID_H);
  drawKeyFindings(doc, findings, M + IMP_W + 5, y, FIND_W, MID_H);
  y += MID_H + 5;

  // ── ROW 3: Recommended Actions  h=64 ─────────────────────────────────────
  bold(doc, 8);
  ink(doc, 100, 116, 139);
  doc.text('RECOMMENDED ACTIONS', M, y + 6);
  fill(doc, 226, 232, 240);
  doc.rect(M + 54, y + 3.5, CW - 54, 0.4, 'F');
  y += 12;

  const ACT_H = 64;
  drawRecommendedActions(doc, actions, M, y, CW, ACT_H);
  y += ACT_H + 5;

  // ── ROW 4: Expected Impact banner  h=32 ──────────────────────────────────
  const IMP_BAN_H = 32;
  drawExpectedImpact(doc, score, projected, actions.length, M, y, CW, IMP_BAN_H);

  // ── Save ────────────────────────────────────────────────────────────────────
  const ts = new Date().toISOString().split('T')[0];
  doc.save(`Agent_Audit_Report_${ts}.pdf`);
}
