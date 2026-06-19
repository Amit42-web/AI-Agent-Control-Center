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

interface Risk {
  level: string;
  levelColor: [number, number, number];
  primaryRisk: string;
  impact: string;
  urgency: string;
  urgencyColor: [number, number, number];
}

interface Rx {
  num: number;
  title: string;
  why: string;
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

function computeRisk(scenarios: Scenario[], aggs: AggregatedScenario[]): Risk {
  const crit = scenarios.filter(s => s.severity === 'critical').length;
  const high = scenarios.filter(s => s.severity === 'high').length;
  const top = aggs.length ? [...aggs].sort((a, b) => SEV_W[b.severity] * b.occurrences - SEV_W[a.severity] * a.occurrences)[0] : null;
  if (crit > 0) return {
    level: 'High', levelColor: [153, 27, 27],
    primaryRisk: top?.title ?? `${crit} critical issue${crit > 1 ? 's' : ''} detected`,
    impact: 'Immediate customer risk and potential compliance exposure.',
    urgency: 'High', urgencyColor: [153, 27, 27],
  };
  if (high >= 2) return {
    level: 'Medium', levelColor: [133, 77, 14],
    primaryRisk: top?.title ?? `${high} high-severity patterns detected`,
    impact: 'Quality inconsistency impacting satisfaction and resolution rates.',
    urgency: 'Medium', urgencyColor: [133, 77, 14],
  };
  if (scenarios.length > 0) return {
    level: 'Medium', levelColor: [133, 77, 14],
    primaryRisk: top?.title ?? 'Recurring quality gaps detected',
    impact: 'Inconsistent agent behaviour affecting overall quality score.',
    urgency: 'Low', urgencyColor: [21, 128, 61],
  };
  return {
    level: 'Low', levelColor: [21, 128, 61],
    primaryRisk: 'No significant risks identified',
    impact: 'Agent performing within acceptable parameters.',
    urgency: 'Low', urgencyColor: [21, 128, 61],
  };
}

function getEvidence(aggs: AggregatedScenario[]): string[] {
  return [...aggs]
    .sort((a, b) => SEV_W[b.severity] * b.occurrences - SEV_W[a.severity] * a.occurrences)
    .slice(0, 5)
    .map(a => {
      const n = a.uniqueCalls ?? a.occurrences;
      return `${a.title} — ${n} call${n !== 1 ? 's' : ''}`;
    });
}

function getTopRx(fixes: EnhancedFix[], scenarios: Scenario[]): Rx[] {
  const rcaCount: Record<string, number> = {};
  scenarios.forEach(s => { if (s.rootCauseType) rcaCount[s.rootCauseType] = (rcaCount[s.rootCauseType] ?? 0) + 1; });
  const total = Math.max(1, scenarios.length);
  const palette: [number, number, number][] = [[239, 68, 68], [245, 158, 11], [59, 130, 246]];
  return fixes.slice(0, 3).map((f, i): Rx => ({
    num: i + 1,
    title: f.title,
    why: f.suggestedSolution,
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

function eyebrow(doc: jsPDF, label: string, x: number, y: number, color: [number, number, number]): number {
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
  doc.text('AI Agent Diagnostic Report', 14, 9);

  italic(doc, 7);
  ink(doc, 148, 163, 184);
  const sub = [
    data.runName && `Run: ${data.runName}`,
    data.analysisDate ?? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  ].filter(Boolean).join('   ·   ');
  doc.text(sub, 14, 16.5);

  // Teal accent
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
    'AI Agent Control Center  ·  Confidential QA Report  ·  For internal use only',
    W / 2, H - 3.5, { align: 'center' },
  );
}

// ─── Section renderers ────────────────────────────────────────────────────────

function drawScoreCard(doc: jsPDF, score: number, grade: Grade, x: number, y: number, w: number, h: number) {
  cardBg(doc, x, y, w, h, grade.color);

  // Eyebrow
  ink(doc, grade.color[0], grade.color[1], grade.color[2]);
  bold(doc, 6.5);
  doc.text('HEALTH SCORE', x + w / 2, y + 8, { align: 'center' });

  // Ring
  const ringCy = y + 37;
  drawRing(doc, x + w / 2, ringCy, 22, 15, score, grade.color);

  // Score number
  ink(doc, grade.color[0], grade.color[1], grade.color[2]);
  bold(doc, 20);
  doc.text(String(score), x + w / 2, ringCy + 3.5, { align: 'center' });
  ink(doc, 148, 163, 184);
  normal(doc, 7);
  doc.text('/ 100', x + w / 2, ringCy + 10.5, { align: 'center' });

  // Status badge
  const badgeY = y + h - 18;
  fill(doc, grade.bgColor[0], grade.bgColor[1], grade.bgColor[2]);
  doc.rect(x + 6, badgeY, w - 12, 10, 'F');
  ink(doc, grade.color[0], grade.color[1], grade.color[2]);
  bold(doc, 9);
  doc.text(grade.label.toUpperCase(), x + w / 2, badgeY + 7, { align: 'center' });
}

function drawDiagnosisCard(
  doc: jsPDF,
  score: number,
  grade: Grade,
  drivers: Driver[],
  projected: number,
  x: number, y: number, w: number, h: number,
) {
  cardBg(doc, x, y, w, h, [59, 130, 246]);

  let cy = y + 7;
  cy = eyebrow(doc, 'DIAGNOSIS SUMMARY', x + 6, cy, [59, 130, 246]);

  // Narrative
  const gain = Math.max(0, projected - score);
  const narrative = score >= 80
    ? `Agent performance is stable with no critical failures detected. Quality gaps are present but non-blocking. Estimated improvement opportunity: +${gain} points — recoverable within 3 weeks.`
    : score >= 60
    ? `Agent performance needs attention. Recurring quality issues are impacting call consistency. Estimated improvement opportunity: +${gain} points with targeted corrections.`
    : `Agent performance is at risk. Significant quality failures detected across multiple dimensions. Estimated recovery potential: +${gain} points with immediate action.`;

  normal(doc, 8.5);
  ink(doc, 55, 65, 81);
  const narLines = doc.splitTextToSize(narrative, w - 12);
  doc.text(narLines.slice(0, 3), x + 6, cy);
  cy += narLines.slice(0, 3).length * 5.2 + 5;

  // Drivers
  if (drivers.length > 0) {
    bold(doc, 7);
    ink(doc, 100, 116, 139);
    doc.text('PRIMARY QUALITY-LOSS DRIVERS', x + 6, cy);
    cy += 6;

    const barX = x + 72;
    const barW = w - 78;

    drivers.forEach(d => {
      // Label
      normal(doc, 7.5);
      ink(doc, 55, 65, 81);
      const label = d.label.length > 20 ? d.label.slice(0, 20) + '…' : d.label;
      doc.text(label, x + 6, cy);

      // Track + fill
      fill(doc, 226, 232, 240);
      doc.rect(barX, cy - 4, barW, 4.5, 'F');
      fill(doc, d.color[0], d.color[1], d.color[2]);
      doc.rect(barX, cy - 4, barW * (d.pct / 100), 4.5, 'F');

      // Pct
      bold(doc, 7.5);
      ink(doc, 15, 23, 42);
      doc.text(`${d.pct}%`, x + w - 4, cy, { align: 'right' });

      cy += 7;
    });
  }
}

function drawOppCard(doc: jsPDF, opp: Opp, x: number, y: number, w: number, h: number) {
  cardBg(doc, x, y, w, h, [245, 158, 11]);

  let cy = y + 7;
  cy = eyebrow(doc, 'BIGGEST OPPORTUNITY', x + 5, cy, [245, 158, 11]);

  // Title
  ink(doc, 15, 23, 42);
  bold(doc, 9.5);
  const titleLines = doc.splitTextToSize(opp.title, w - 10);
  doc.text(titleLines.slice(0, 2), x + 5, cy);
  cy += Math.min(2, titleLines.length) * 5.5 + 3;

  // Stat
  ink(doc, 133, 77, 14);
  normal(doc, 7.5);
  const statLines = doc.splitTextToSize(`${opp.pct}% of total quality loss originates here`, w - 10);
  doc.text(statLines.slice(0, 2), x + 5, cy);
  cy += Math.min(2, statLines.length) * 4.5 + 6;

  // Score jump block
  const jumpH = 18;
  fill(doc, 248, 250, 252);
  doc.rect(x + 5, cy, w - 10, jumpH, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.rect(x + 5, cy, w - 10, jumpH, 'S');

  const midX = x + 5 + (w - 10) / 2;

  ink(doc, 100, 116, 139);
  bold(doc, 18);
  doc.text(String(opp.scoreFrom), x + 5 + (w - 10) * 0.22, cy + 12, { align: 'center' });

  ink(doc, 21, 128, 61);
  bold(doc, 11);
  doc.text('→', midX, cy + 12, { align: 'center' });

  ink(doc, 21, 128, 61);
  bold(doc, 18);
  doc.text(String(opp.scoreTo), x + 5 + (w - 10) * 0.78, cy + 12, { align: 'center' });

  normal(doc, 6);
  ink(doc, 148, 163, 184);
  doc.text('Current', x + 5 + (w - 10) * 0.22, cy + jumpH - 1.5, { align: 'center' });
  doc.text('After Fix', x + 5 + (w - 10) * 0.78, cy + jumpH - 1.5, { align: 'center' });
}

function drawRiskCard(doc: jsPDF, risk: Risk, x: number, y: number, w: number, h: number) {
  cardBg(doc, x, y, w, h, risk.levelColor);

  let cy = y + 7;
  cy = eyebrow(doc, 'OVERALL RISK', x + 5, cy, risk.levelColor);

  ink(doc, risk.levelColor[0], risk.levelColor[1], risk.levelColor[2]);
  bold(doc, 20);
  doc.text(risk.level, x + 5, cy + 5);
  cy += 12;

  const field = (label: string, value: string, color?: [number, number, number]) => {
    bold(doc, 7);
    ink(doc, 100, 116, 139);
    doc.text(label, x + 5, cy);
    cy += 5;
    normal(doc, 7.5);
    ink(doc, color ? color[0] : 55, color ? color[1] : 65, color ? color[2] : 81);
    const lines = doc.splitTextToSize(value, w - 10);
    doc.text(lines.slice(0, 3), x + 5, cy);
    cy += Math.min(3, lines.length) * 4.5 + 5;
  };

  field('PRIMARY RISK', risk.primaryRisk);
  field('BUSINESS IMPACT', risk.impact);

  // Urgency badge
  bold(doc, 7);
  ink(doc, 100, 116, 139);
  doc.text('URGENCY', x + 5, cy);
  cy += 5;
  fill(doc, risk.urgencyColor[0], risk.urgencyColor[1], risk.urgencyColor[2]);
  doc.rect(x + 5, cy - 4, 30, 6.5, 'F');
  ink(doc, 255, 255, 255);
  bold(doc, 7);
  doc.text(risk.urgency.toUpperCase(), x + 20, cy + 0.5, { align: 'center' });
}

function drawEvidenceCard(doc: jsPDF, lines: string[], x: number, y: number, w: number, h: number) {
  cardBg(doc, x, y, w, h, [139, 92, 246]);

  let cy = y + 7;
  cy = eyebrow(doc, 'EVIDENCE OBSERVED', x + 5, cy, [139, 92, 246]);

  if (!lines.length) {
    italic(doc, 8);
    ink(doc, 148, 163, 184);
    doc.text('No specific evidence recorded', x + 5, cy + 5);
    return;
  }

  lines.forEach(line => {
    fill(doc, 139, 92, 246);
    doc.circle(x + 7, cy + 0.5, 1.3, 'F');
    normal(doc, 7.5);
    ink(doc, 55, 65, 81);
    const wrapped = doc.splitTextToSize(line, w - 14);
    doc.text(wrapped[0], x + 11, cy + 1.5);
    cy += 8;
  });
}

function drawPrescriptions(doc: jsPDF, rxList: Rx[], x: number, y: number, totalW: number, h: number) {
  if (!rxList.length) return;
  const colW = (totalW - 10) / 3;

  rxList.slice(0, 3).forEach((rx, i) => {
    const cx = x + i * (colW + 5);
    cardBg(doc, cx, y, colW, h, rx.color);

    // Left accent stripe
    fill(doc, rx.color[0], rx.color[1], rx.color[2]);
    doc.rect(cx, y, 2.5, h, 'F');

    let cy = y + 8;

    // Rx label
    italic(doc, 11);
    ink(doc, rx.color[0], rx.color[1], rx.color[2]);
    doc.text('Rx', cx + 6, cy + 1);
    bold(doc, 7);
    ink(doc, 148, 163, 184);
    doc.text(`Prescription #${rx.num}`, cx + 17, cy + 1);
    cy += 10;

    // Title
    ink(doc, 15, 23, 42);
    bold(doc, 9.5);
    const titleLines = doc.splitTextToSize(rx.title, colW - 10);
    doc.text(titleLines.slice(0, 2), cx + 6, cy);
    cy += Math.min(2, titleLines.length) * 5.5 + 3;

    // Why
    normal(doc, 7.5);
    ink(doc, 100, 116, 139);
    const whyLines = doc.splitTextToSize(rx.why, colW - 10);
    doc.text(whyLines.slice(0, 4), cx + 6, cy);

    // Expected gain badge
    const badgeY = y + h - 13;
    fill(doc, rx.color[0], rx.color[1], rx.color[2]);
    doc.rect(cx + 6, badgeY, colW - 12, 9, 'F');
    ink(doc, 255, 255, 255);
    bold(doc, 7.5);
    doc.text(`Expected gain: +${rx.gain} points`, cx + colW / 2, badgeY + 6.2, { align: 'center' });
  });
}

function drawOutcomeBanner(
  doc: jsPDF,
  score: number,
  projected: number,
  rxCount: number,
  x: number, y: number, w: number, h: number,
) {
  fill(doc, 15, 23, 42);
  doc.rect(x, y, w, h, 'F');

  // Section label
  ink(doc, 20, 184, 166);
  bold(doc, 7);
  doc.text('EXPECTED OUTCOME', x + 10, y + 8);

  const midY = y + h / 2 + 4;

  // Current score
  ink(doc, 100, 116, 139);
  bold(doc, 26);
  doc.text(String(score), x + 34, midY, { align: 'center' });
  normal(doc, 6.5);
  ink(doc, 100, 116, 139);
  doc.text('CURRENT', x + 34, midY + 8, { align: 'center' });

  // Arrow line
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

  // Stats trio
  const stats = [
    { label: 'TIMELINE', value: '3 Weeks' },
    { label: 'PRESCRIPTIONS', value: String(rxCount) },
    { label: 'SCORE GAIN', value: `+${Math.max(0, projected - score)}` },
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
  const CW = W - 2 * M;                   // 186mm

  // ── Precompute ──────────────────────────────────────────────────────────────
  const score     = computeScore(data.scenarios, data.totalCalls);
  const grade     = getGrade(score);
  const drivers   = computeDrivers(data.scenarios);
  const opp       = getBiggestOpp(data.aggregatedScenarios, score);
  const risk      = computeRisk(data.scenarios, data.aggregatedScenarios);
  const evidence  = getEvidence(data.aggregatedScenarios);
  const rxList    = getTopRx(data.fixes, data.scenarios);
  const projected = calcProjected(score, data.fixes, data.scenarios);

  // ── Page chrome ─────────────────────────────────────────────────────────────
  let y = drawHeader(doc, W, data);
  drawFooter(doc, W, H);

  // ── ROW 1: Health Score (62mm) + Diagnosis Summary (119mm)  h=78 ──────────
  const HERO_H = 78;
  const SCORE_W = 62;
  const DIAG_W = CW - SCORE_W - 5;

  drawScoreCard(doc, score, grade, M, y, SCORE_W, HERO_H);
  drawDiagnosisCard(doc, score, grade, drivers, projected, M + SCORE_W + 5, y, DIAG_W, HERO_H);
  y += HERO_H + 5;

  // ── ROW 2: Biggest Opportunity + Overall Risk + Evidence  h=62 ───────────
  const MID_H = 62;
  const COL_W = (CW - 10) / 3;

  drawOppCard(doc, opp, M, y, COL_W, MID_H);
  drawRiskCard(doc, risk, M + COL_W + 5, y, COL_W, MID_H);
  drawEvidenceCard(doc, evidence, M + (COL_W + 5) * 2, y, COL_W, MID_H);
  y += MID_H + 5;

  // ── ROW 3: Top Prescriptions  h=64 ────────────────────────────────────────
  // Section header
  bold(doc, 8);
  ink(doc, 100, 116, 139);
  doc.text('TOP PRESCRIPTIONS', M, y + 6);
  fill(doc, 226, 232, 240);
  doc.rect(M + 49, y + 3.5, CW - 49, 0.4, 'F');
  y += 12;

  const RX_H = 64;
  drawPrescriptions(doc, rxList, M, y, CW, RX_H);
  y += RX_H + 5;

  // ── ROW 4: Expected Outcome banner  h=32 ──────────────────────────────────
  const OUT_H = 32;
  drawOutcomeBanner(doc, score, projected, rxList.length, M, y, CW, OUT_H);

  // ── Save ────────────────────────────────────────────────────────────────────
  const ts = new Date().toISOString().split('T')[0];
  doc.save(`Agent_Diagnostic_Report_${ts}.pdf`);
}
