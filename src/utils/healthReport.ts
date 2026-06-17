import jsPDF from 'jspdf';
import { AggregatedScenario, EnhancedFix, RootCauseType, Scenario } from '@/types';

export interface HealthReportData {
  scenarios: Scenario[];
  aggregatedScenarios: AggregatedScenario[];
  fixes: EnhancedFix[];
  totalCalls: number;
  runName?: string;
  analysisDate?: string;
}

// ─── Data helpers ────────────────────────────────────────────────────────────

const SEV_WEIGHT: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const SEV_PENALTY: Record<string, number> = { low: 3, medium: 8, high: 15, critical: 25 };

function computeHealthScore(scenarios: Scenario[], totalCalls: number): number {
  if (totalCalls === 0) return 100;
  let pen = 0;
  scenarios.forEach(s => (pen += SEV_PENALTY[s.severity] ?? 3));
  return Math.max(0, Math.min(100, Math.round(100 - pen / totalCalls)));
}

interface Grade {
  grade: string;
  label: string;
  color: [number, number, number];
  bgColor: [number, number, number];
}

function getGrade(score: number): Grade {
  if (score >= 80) return { grade: 'A', label: 'Healthy', color: [21, 128, 61], bgColor: [220, 252, 231] };
  if (score >= 60) return { grade: 'B', label: 'Moderate Risk', color: [133, 77, 14], bgColor: [254, 243, 199] };
  if (score >= 40) return { grade: 'C', label: 'High Risk', color: [154, 52, 18], bgColor: [255, 237, 213] };
  return { grade: 'D', label: 'Critical', color: [153, 27, 27], bgColor: [254, 226, 226] };
}

const DIMENSION_MAP = [
  { key: 'A', label: 'Conversation Control & Flow' },
  { key: 'B', label: 'Empathy & Tone' },
  { key: 'C', label: 'Knowledge & Accuracy' },
  { key: 'D', label: 'Script Adherence' },
  { key: 'E', label: 'Resolution & Outcome' },
  { key: 'F', label: 'Communication Clarity' },
  { key: 'G', label: 'Novel & Emerging Issues' },
];

interface VitalSign {
  dim: string;
  label: string;
  status: 'Optimal' | 'Mild' | 'Monitoring' | 'Elevated' | 'Critical';
  count: number;
  statusColor: [number, number, number];
}

function getVitalSigns(scenarios: Scenario[]): VitalSign[] {
  return DIMENSION_MAP.map(({ key, label }) => {
    const dimScenarios = scenarios.filter(s => {
      if (!s.dimension) return false;
      const d = s.dimension.trim().toUpperCase();
      return (
        d === key ||
        d.startsWith(key + ' ') ||
        d.startsWith(key + '-') ||
        d.startsWith('DIM ' + key) ||
        d.startsWith('DIMENSION ' + key) ||
        label
          .toUpperCase()
          .split(' ')
          .some(w => w.length > 4 && d.includes(w))
      );
    });

    const critCount = dimScenarios.filter(s => s.severity === 'critical').length;
    const highCount = dimScenarios.filter(s => s.severity === 'high').length;
    const count = dimScenarios.length;

    let status: VitalSign['status'];
    let statusColor: [number, number, number];

    if (count === 0) {
      status = 'Optimal'; statusColor = [21, 128, 61];
    } else if (critCount > 0 || highCount >= 2) {
      status = 'Critical'; statusColor = [153, 27, 27];
    } else if (highCount > 0 || count >= 4) {
      status = 'Elevated'; statusColor = [154, 52, 18];
    } else if (count >= 2) {
      status = 'Monitoring'; statusColor = [133, 77, 14];
    } else {
      status = 'Mild'; statusColor = [21, 128, 61];
    }

    return { dim: key, label, status, count, statusColor };
  });
}

function topAggregated(aggs: AggregatedScenario[], n: number): AggregatedScenario[] {
  return [...aggs]
    .sort((a, b) => SEV_WEIGHT[b.severity] * b.occurrences - SEV_WEIGHT[a.severity] * a.occurrences)
    .slice(0, n);
}

function calcProjectedScore(currentScore: number, fixes: EnhancedFix[], scenarios: Scenario[]): number {
  const total = scenarios.length;
  if (total === 0) return currentScore;

  const rcaCount: Record<string, number> = {};
  scenarios.forEach(s => {
    if (s.rootCauseType) rcaCount[s.rootCauseType] = (rcaCount[s.rootCauseType] ?? 0) + 1;
  });

  let totalRecovery = 0;
  fixes.forEach(fix => {
    const incidents = rcaCount[fix.rootCauseType] ?? 0;
    totalRecovery += Math.min(5, (incidents / total) * 20);
  });

  return Math.min(100, Math.round(currentScore + Math.min(30, totalRecovery)));
}

// ─── PDF drawing helpers ──────────────────────────────────────────────────────

function fill(doc: jsPDF, r: number, g: number, b: number) {
  doc.setFillColor(r, g, b);
}

function ink(doc: jsPDF, r: number, g: number, b: number) {
  doc.setTextColor(r, g, b);
}

function bold(doc: jsPDF, size: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
}

function normal(doc: jsPDF, size: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
}

function italic(doc: jsPDF, size: number) {
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(size);
}

function drawPageHeader(doc: jsPDF, W: number, runName?: string, date?: string): number {
  fill(doc, 15, 23, 42);
  doc.rect(0, 0, W, 22, 'F');

  ink(doc, 255, 255, 255);
  bold(doc, 14);
  doc.text('AI Agent Health Report', 15, 10);

  italic(doc, 7.5);
  ink(doc, 148, 163, 184);
  const sub = [runName && `Run: ${runName}`, `Date: ${date || new Date().toLocaleDateString()}`]
    .filter(Boolean)
    .join('  |  ');
  doc.text(sub, 15, 17);

  // Teal accent
  fill(doc, 20, 184, 166);
  doc.rect(0, 22, W, 1.5, 'F');

  return 30;
}

function sectionLabel(doc: jsPDF, label: string, x: number, y: number): number {
  fill(doc, 20, 184, 166);
  doc.rect(x, y, 3, 5, 'F');
  ink(doc, 15, 23, 42);
  bold(doc, 9);
  doc.text(label, x + 7, y + 4);
  return y + 10;
}

function addPageFooter(doc: jsPDF, W: number, H: number) {
  fill(doc, 241, 245, 249);
  doc.rect(0, H - 8, W, 8, 'F');
  ink(doc, 148, 163, 184);
  normal(doc, 6.5);
  doc.text('AI Agent Control Center — Confidential Diagnostic Report', W / 2, H - 2.5, { align: 'center' });
}

// ─── Page 1: Overview + Vital Signs ──────────────────────────────────────────

function drawPage1(
  doc: jsPDF,
  data: HealthReportData,
  score: number,
  grade: Grade,
  vitals: VitalSign[],
  W: number,
  margin: number
): void {
  const H = doc.internal.pageSize.height;
  const contentW = W - 2 * margin;
  let y = drawPageHeader(doc, W, data.runName, data.analysisDate);

  // ── Overall Condition Card
  fill(doc, grade.bgColor[0], grade.bgColor[1], grade.bgColor[2]);
  doc.rect(margin, y, contentW, 56, 'F');

  // Grade circle
  fill(doc, grade.color[0], grade.color[1], grade.color[2]);
  doc.circle(margin + 20, y + 27, 16, 'F');
  ink(doc, 255, 255, 255);
  bold(doc, 22);
  doc.text(grade.grade, margin + 20, y + 31.5, { align: 'center' });

  // Condition headline
  const rx = margin + 42;
  ink(doc, grade.color[0], grade.color[1], grade.color[2]);
  bold(doc, 15);
  doc.text(`Overall Condition: ${grade.label}`, rx, y + 14);

  normal(doc, 10);
  ink(doc, 15, 23, 42);
  doc.text(`Health Score: ${score} / 100`, rx, y + 24);

  const callsWithIssues = new Set(data.scenarios.map(s => s.callId)).size;
  const pctAffected = data.totalCalls > 0 ? Math.round((callsWithIssues / data.totalCalls) * 100) : 0;
  const critCount = data.scenarios.filter(s => s.severity === 'critical').length;
  const highCount = data.scenarios.filter(s => s.severity === 'high').length;

  ink(doc, 55, 65, 81);
  normal(doc, 8.5);
  doc.text(
    `${critCount} critical · ${highCount} high severity incidents across ${data.totalCalls} calls`,
    rx,
    y + 33
  );
  doc.text(`Est. ${pctAffected}% of calls impacted by quality issues`, rx, y + 41);

  // Recommended action line
  let reco: string;
  if (score >= 80) reco = 'Maintain current protocols. Monitor for emerging patterns.';
  else if (score >= 60) reco = 'Review high-severity issues. Prioritise script prompt updates.';
  else if (score >= 40) reco = 'Immediate review required. Escalate critical incidents before next deployment.';
  else reco = 'Critical intervention needed. Halt deployment pending remediation.';

  fill(doc, grade.color[0], grade.color[1], grade.color[2]);
  doc.rect(margin, y + 48, contentW, 0.5, 'F');

  ink(doc, grade.color[0], grade.color[1], grade.color[2]);
  bold(doc, 8);
  doc.text('Recommended:', rx - 38, y + 54);
  ink(doc, 55, 65, 81);
  normal(doc, 8);
  doc.text(reco, rx - 12, y + 54);

  y += 62;

  // ── Stats strip
  fill(doc, 15, 23, 42);
  doc.rect(margin, y, contentW, 16, 'F');
  const stats = [
    { label: 'Total Calls', value: String(data.totalCalls) },
    { label: 'Total Incidents', value: String(data.scenarios.length) },
    { label: 'Calls Affected', value: `${callsWithIssues} (${pctAffected}%)` },
    { label: 'Fixes Identified', value: String(data.fixes.length) },
  ];
  const sw = contentW / 4;
  stats.forEach((s, i) => {
    const sx = margin + i * sw + sw / 2;
    ink(doc, 100, 116, 139);
    normal(doc, 6.5);
    doc.text(s.label, sx, y + 6, { align: 'center' });
    ink(doc, 255, 255, 255);
    bold(doc, 11);
    doc.text(s.value, sx, y + 13, { align: 'center' });
  });

  y += 22;

  // ── Conversation Vital Signs
  y = sectionLabel(doc, 'CONVERSATION VITAL SIGNS', margin, y);

  // Table header
  fill(doc, 30, 41, 59);
  doc.rect(margin, y, contentW, 7, 'F');
  ink(doc, 255, 255, 255);
  bold(doc, 7.5);
  doc.text('Dim', margin + 3, y + 5);
  doc.text('Vital Sign', margin + 14, y + 5);
  doc.text('Status', margin + 118, y + 5);
  doc.text('Incidents', margin + 152, y + 5);
  y += 7;

  vitals.forEach((v, i) => {
    const rowH = 8;
    if (i % 2 === 0) {
      fill(doc, 248, 250, 252);
      doc.rect(margin, y, contentW, rowH, 'F');
    } else {
      fill(doc, 241, 245, 249);
      doc.rect(margin, y, contentW, rowH, 'F');
    }

    ink(doc, 15, 23, 42);
    bold(doc, 7.5);
    doc.text(v.dim, margin + 3, y + 5.5);
    normal(doc, 7.5);
    doc.text(v.label, margin + 14, y + 5.5);

    // Status badge
    fill(doc, v.statusColor[0], v.statusColor[1], v.statusColor[2]);
    doc.rect(margin + 116, y + 1.5, 30, 5, 'F');
    ink(doc, 255, 255, 255);
    bold(doc, 6.5);
    doc.text(v.status, margin + 131, y + 5.5, { align: 'center' });

    ink(doc, 55, 65, 81);
    normal(doc, 7.5);
    doc.text(v.count > 0 ? `${v.count}` : '—', margin + 152, y + 5.5);

    y += rowH;
  });

  addPageFooter(doc, W, H);
}

// ─── Page 2: Diagnoses ────────────────────────────────────────────────────────

function drawPage2(
  doc: jsPDF,
  data: HealthReportData,
  diagnoses: AggregatedScenario[],
  W: number,
  margin: number
): void {
  const H = doc.internal.pageSize.height;
  const contentW = W - 2 * margin;
  let y = drawPageHeader(doc, W, data.runName, data.analysisDate);

  y = sectionLabel(doc, 'DIAGNOSES', margin, y);
  y += 2;

  const diagConfig = [
    { label: 'PRIMARY DIAGNOSIS', headerColor: [153, 27, 27] as [number, number, number], bgColor: [254, 242, 242] as [number, number, number] },
    { label: 'SECONDARY DIAGNOSIS', headerColor: [154, 52, 18] as [number, number, number], bgColor: [255, 247, 237] as [number, number, number] },
  ];

  const sevColors: Record<string, [number, number, number]> = {
    critical: [153, 27, 27],
    high: [154, 52, 18],
    medium: [133, 77, 14],
    low: [21, 128, 61],
  };
  const ftColors: Record<string, [number, number, number]> = {
    script: [37, 99, 235],
    process: [147, 51, 234],
    training: [5, 150, 105],
    system: [75, 85, 99],
  };
  const ftLabels: Record<string, string> = {
    script: 'Script Update',
    process: 'Process Change',
    training: 'Training Required',
    system: 'System Update',
  };

  diagnoses.slice(0, 2).forEach((diag, idx) => {
    const cfg = diagConfig[idx];
    const colW = (contentW - 6) / 2;
    const rightX = margin + colW + 6;

    // Card header
    fill(doc, cfg.headerColor[0], cfg.headerColor[1], cfg.headerColor[2]);
    doc.rect(margin, y, contentW, 6, 'F');
    ink(doc, 255, 255, 255);
    bold(doc, 7.5);
    doc.text(cfg.label, margin + 4, y + 4.3);

    // Severity badge in header
    const sc = sevColors[diag.severity] ?? [55, 65, 81];
    fill(doc, sc[0] + 40, sc[1] + 40, sc[2] + 40);
    doc.rect(W - margin - 30, y + 0.5, 28, 5, 'F');
    ink(doc, sc[0], sc[1], sc[2]);
    bold(doc, 7);
    doc.text(diag.severity.toUpperCase(), W - margin - 16, y + 4.3, { align: 'center' });

    // Card body
    fill(doc, cfg.bgColor[0], cfg.bgColor[1], cfg.bgColor[2]);
    doc.rect(margin, y + 6, contentW, 90, 'F');
    y += 6;

    // Title
    ink(doc, 15, 23, 42);
    bold(doc, 11);
    const titleLines = doc.splitTextToSize(diag.title, contentW - 8);
    doc.text(titleLines.slice(0, 2), margin + 4, y + 8);
    const titleH = Math.min(2, titleLines.length) * 6.5 + 10;

    // Left column: symptoms + impact
    let lx = margin + 4;
    let ly = y + titleH;

    ink(doc, 55, 65, 81);
    bold(doc, 8);
    doc.text('Symptoms Observed:', lx, ly);
    ly += 5;

    const symptoms = diag.scenarios
      .map(s => s.whatHappened)
      .filter((w): w is string => Boolean(w))
      .slice(0, 3);

    normal(doc, 7.5);
    symptoms.forEach(sym => {
      const lines = doc.splitTextToSize(`• ${sym}`, colW - 4);
      ink(doc, 55, 65, 81);
      doc.text(lines.slice(0, 2), lx, ly);
      ly += Math.min(2, lines.length) * 4.5 + 1;
    });

    ly += 3;
    const impact = diag.scenarios[0]?.impact;
    if (impact) {
      ink(doc, 55, 65, 81);
      bold(doc, 8);
      doc.text('Patient Impact:', lx, ly);
      ly += 5;
      normal(doc, 7.5);
      const impLines = doc.splitTextToSize(impact, colW - 4);
      doc.text(impLines.slice(0, 3), lx, ly);
    }

    // Right column
    let rx2 = rightX;
    let ry = y + titleH;

    const pct = data.totalCalls > 0 ? Math.round((diag.uniqueCalls / data.totalCalls) * 100) : 0;

    // Prevalence badge
    fill(doc, cfg.headerColor[0], cfg.headerColor[1], cfg.headerColor[2]);
    doc.rect(rx2, ry, colW, 20, 'F');
    ink(doc, 255, 255, 255);
    bold(doc, 20);
    doc.text(`${pct}%`, rx2 + colW / 2, ry + 13, { align: 'center' });
    normal(doc, 7);
    doc.text('of conversations affected', rx2 + colW / 2, ry + 19, { align: 'center' });
    ry += 24;

    ink(doc, 75, 85, 99);
    normal(doc, 7.5);
    doc.text(`${diag.occurrences} total incidents · ${diag.uniqueCalls} calls`, rx2, ry);
    ry += 8;

    const linkedFix = data.fixes.find(f => f.rootCauseType === diag.rootCauseType);
    if (linkedFix) {
      ink(doc, 55, 65, 81);
      bold(doc, 8);
      doc.text('Prescription:', rx2, ry);
      ry += 5;
      normal(doc, 7.5);
      const fixLines = doc.splitTextToSize(linkedFix.suggestedSolution, colW - 2);
      ink(doc, 15, 23, 42);
      doc.text(fixLines.slice(0, 4), rx2, ry);
      ry += Math.min(4, fixLines.length) * 4.5 + 4;

      const ftc = ftColors[linkedFix.fixType] ?? [55, 65, 81];
      fill(doc, ftc[0], ftc[1], ftc[2]);
      const ftText = ftLabels[linkedFix.fixType] ?? linkedFix.fixType;
      doc.rect(rx2, ry, 42, 5, 'F');
      ink(doc, 255, 255, 255);
      bold(doc, 7);
      doc.text(ftText, rx2 + 21, ry + 3.7, { align: 'center' });
    }

    y += 96; // advance past card
    y += 6; // gap between cards
  });

  addPageFooter(doc, W, H);
}

// ─── Page 3: Risk Assessment + Treatment Plan + Projected Score ───────────────

function drawPage3(
  doc: jsPDF,
  data: HealthReportData,
  currentScore: number,
  projectedScore: number,
  W: number,
  margin: number
): void {
  const H = doc.internal.pageSize.height;
  const contentW = W - 2 * margin;
  let y = drawPageHeader(doc, W, data.runName, data.analysisDate);

  // ── Risk Assessment
  y = sectionLabel(doc, 'RISK ASSESSMENT', margin, y);

  const colW = (contentW - 5) / 2;
  const col2X = margin + colW + 5;

  const immediateRisks = [...data.aggregatedScenarios]
    .filter(a => a.severity === 'critical' || (a.severity === 'high' && a.occurrences >= 3))
    .sort((a, b) => SEV_WEIGHT[b.severity] * b.occurrences - SEV_WEIGHT[a.severity] * a.occurrences)
    .slice(0, 3);

  const mediumRisks = [...data.aggregatedScenarios]
    .filter(a => !immediateRisks.includes(a))
    .filter(a => a.severity === 'high' || (a.severity === 'medium' && a.occurrences >= 3))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 3);

  const riskCardH = Math.max(
    14 + immediateRisks.length * 20,
    14 + mediumRisks.length * 20,
    40
  );

  // Immediate Risk
  fill(doc, 254, 226, 226);
  doc.rect(margin, y, colW, riskCardH, 'F');
  fill(doc, 153, 27, 27);
  doc.rect(margin, y, colW, 6, 'F');
  ink(doc, 255, 255, 255);
  bold(doc, 8);
  doc.text('IMMEDIATE RISK', margin + 4, y + 4.5);
  let ry1 = y + 10;

  if (immediateRisks.length === 0) {
    ink(doc, 75, 85, 99);
    italic(doc, 7.5);
    doc.text('No immediate critical risks identified', margin + 4, ry1 + 5);
  } else {
    immediateRisks.forEach(risk => {
      fill(doc, 153, 27, 27);
      doc.circle(margin + 5, ry1 + 2, 1.5, 'F');
      ink(doc, 15, 23, 42);
      bold(doc, 7.5);
      const t = doc.splitTextToSize(risk.title, colW - 14);
      doc.text(t[0], margin + 10, ry1 + 3);
      ry1 += 6;
      ink(doc, 100, 116, 139);
      normal(doc, 6.5);
      doc.text(`${risk.occurrences} incidents · ${risk.uniqueCalls} calls`, margin + 10, ry1);
      ry1 += 5;
      const impact = risk.scenarios[0]?.impact;
      if (impact) {
        ink(doc, 55, 65, 81);
        italic(doc, 6.5);
        const il = doc.splitTextToSize(`Likely: ${impact}`, colW - 14);
        doc.text(il[0], margin + 10, ry1);
        ry1 += 6;
      }
    });
  }

  // Medium Risk
  fill(doc, 255, 237, 213);
  doc.rect(col2X, y, colW, riskCardH, 'F');
  fill(doc, 154, 52, 18);
  doc.rect(col2X, y, colW, 6, 'F');
  ink(doc, 255, 255, 255);
  bold(doc, 8);
  doc.text('MEDIUM-TERM RISK', col2X + 4, y + 4.5);
  let ry2 = y + 10;

  if (mediumRisks.length === 0) {
    ink(doc, 75, 85, 99);
    italic(doc, 7.5);
    doc.text('No significant medium-term risks', col2X + 4, ry2 + 5);
  } else {
    mediumRisks.forEach(risk => {
      fill(doc, 154, 52, 18);
      doc.circle(col2X + 5, ry2 + 2, 1.5, 'F');
      ink(doc, 15, 23, 42);
      bold(doc, 7.5);
      const t = doc.splitTextToSize(risk.title, colW - 14);
      doc.text(t[0], col2X + 10, ry2 + 3);
      ry2 += 6;
      ink(doc, 100, 116, 139);
      normal(doc, 6.5);
      doc.text(`${risk.occurrences} incidents · ${risk.uniqueCalls} calls`, col2X + 10, ry2);
      ry2 += 5;
      const impact = risk.scenarios[0]?.impact;
      if (impact) {
        ink(doc, 55, 65, 81);
        italic(doc, 6.5);
        const il = doc.splitTextToSize(`Watch: ${impact}`, colW - 14);
        doc.text(il[0], col2X + 10, ry2);
        ry2 += 6;
      }
    });
  }

  y += riskCardH + 12;

  // ── Treatment Plan
  y = sectionLabel(doc, 'TREATMENT PLAN', margin, y);
  y += 2;

  const total = data.scenarios.length;
  const rcaCount: Record<string, number> = {};
  data.scenarios.forEach(s => {
    if (s.rootCauseType) rcaCount[s.rootCauseType] = (rcaCount[s.rootCauseType] ?? 0) + 1;
  });
  const calcRecovery = (weekFixes: EnhancedFix[]) => {
    let inc = 0;
    weekFixes.forEach(f => (inc += rcaCount[f.rootCauseType] ?? 0));
    return total > 0 ? Math.min(15, Math.round((inc / total) * 25)) : 0;
  };

  const weeks = [
    {
      label: 'Week 1', theme: 'Prompt & Script Updates',
      fixes: data.fixes.filter(f => f.fixType === 'script'),
      color: [37, 99, 235] as [number, number, number],
    },
    {
      label: 'Week 2', theme: 'Process & Workflow Changes',
      fixes: data.fixes.filter(f => f.fixType === 'process'),
      color: [147, 51, 234] as [number, number, number],
    },
    {
      label: 'Week 3', theme: 'Training & System Updates',
      fixes: data.fixes.filter(f => f.fixType === 'training' || f.fixType === 'system'),
      color: [5, 150, 105] as [number, number, number],
    },
  ];

  const cardW = (contentW - 8) / 3;
  const cardH = 52;

  weeks.forEach((week, i) => {
    const wx = margin + i * (cardW + 4);
    const recovery = calcRecovery(week.fixes);

    fill(doc, week.color[0], week.color[1], week.color[2]);
    doc.rect(wx, y, cardW, 7, 'F');
    ink(doc, 255, 255, 255);
    bold(doc, 9);
    doc.text(week.label, wx + cardW / 2, y + 5.2, { align: 'center' });

    fill(doc, 241, 245, 249);
    doc.rect(wx, y + 7, cardW, cardH - 7, 'F');

    ink(doc, 15, 23, 42);
    bold(doc, 8);
    const themeLines = doc.splitTextToSize(week.theme, cardW - 6);
    doc.text(themeLines, wx + 3, y + 14);
    let wy = y + 14 + themeLines.length * 5.5;

    ink(doc, 100, 116, 139);
    normal(doc, 7);
    doc.text(`${week.fixes.length} fix${week.fixes.length !== 1 ? 'es' : ''}`, wx + 3, wy);
    wy += 5;

    ink(doc, 55, 65, 81);
    normal(doc, 7);
    week.fixes.slice(0, 2).forEach(fix => {
      const fl = doc.splitTextToSize(`• ${fix.title}`, cardW - 6);
      doc.text(fl[0], wx + 3, wy);
      wy += 4.5;
    });
    if (week.fixes.length > 2) {
      ink(doc, 100, 116, 139);
      doc.text(`+ ${week.fixes.length - 2} more`, wx + 3, wy);
    }

    // Recovery footer
    fill(doc, week.color[0], week.color[1], week.color[2]);
    doc.rect(wx, y + cardH - 7, cardW, 7, 'F');
    ink(doc, 255, 255, 255);
    bold(doc, 7.5);
    doc.text(`Expected recovery: +${recovery}%`, wx + cardW / 2, y + cardH - 2.5, { align: 'center' });
  });

  y += cardH + 14;

  // ── Projected Health Score
  y = sectionLabel(doc, 'PROJECTED HEALTH SCORE', margin, y);
  y += 3;

  const currentGrade = getGrade(currentScore);
  const projectedGrade = getGrade(projectedScore);

  // Score bar background
  fill(doc, 226, 232, 240);
  doc.rect(margin, y, contentW, 18, 'F');

  // Current bar
  const barW = Math.max(4, (contentW - 4) * (currentScore / 100));
  fill(doc, currentGrade.color[0], currentGrade.color[1], currentGrade.color[2]);
  doc.rect(margin + 2, y + 2, barW, 5, 'F');

  // Projected bar
  const projBarW = Math.max(4, (contentW - 4) * (projectedScore / 100));
  fill(doc, projectedGrade.color[0], projectedGrade.color[1], projectedGrade.color[2]);
  doc.rect(margin + 2, y + 10, projBarW, 5, 'F');

  // Labels inside/outside bars
  ink(doc, 255, 255, 255);
  bold(doc, 7);
  if (barW > 30) doc.text(`Now: ${currentScore}`, margin + 4, y + 5.8);
  if (projBarW > 40) doc.text(`Projected: ${projectedScore}`, margin + 4, y + 13.8);

  y += 22;

  ink(doc, currentGrade.color[0], currentGrade.color[1], currentGrade.color[2]);
  bold(doc, 9);
  doc.text(`Current: ${currentScore}/100 — ${currentGrade.label}`, margin, y);

  ink(doc, projectedGrade.color[0], projectedGrade.color[1], projectedGrade.color[2]);
  doc.text(`Projected: ${projectedScore}/100 — ${projectedGrade.label}`, margin + contentW / 2, y);

  y += 8;
  ink(doc, 100, 116, 139);
  italic(doc, 7);
  doc.text(
    'Projection assumes successful implementation of all identified fixes within 3 weeks.',
    margin,
    y
  );

  addPageFooter(doc, W, H);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateHealthReportPDF(data: HealthReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.width;
  const margin = 15;

  const score = computeHealthScore(data.scenarios, data.totalCalls);
  const grade = getGrade(score);
  const vitals = getVitalSigns(data.scenarios);
  const diagnoses = topAggregated(data.aggregatedScenarios, 2);
  const projectedScore = calcProjectedScore(score, data.fixes, data.scenarios);

  drawPage1(doc, data, score, grade, vitals, W, margin);

  if (data.aggregatedScenarios.length > 0) {
    doc.addPage();
    drawPage2(doc, data, diagnoses, W, margin);
  }

  doc.addPage();
  drawPage3(doc, data, score, projectedScore, W, margin);

  // Page numbers
  const pageCount = (doc.internal as any).pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.height;
    ink(doc, 148, 163, 184);
    normal(doc, 6.5);
    doc.text(`${i} / ${pageCount}`, W - margin, H - 3);
  }

  const ts = new Date().toISOString().split('T')[0];
  doc.save(`Agent_Diagnostic_Report_${ts}.pdf`);
}
