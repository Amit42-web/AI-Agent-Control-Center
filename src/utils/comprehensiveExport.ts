import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import {
  AnalysisResult,
  Scenario,
  EnhancedFix,
  FixSuggestions,
  FlowType,
  Transcript,
} from '@/types';
import { AggregatedScenario } from './aggregateScenarios';

interface ExportData {
  flowType: FlowType;
  transcripts: Transcript[];
  results?: AnalysisResult | null;
  fixes?: FixSuggestions | null;
  scenarioResults?: { scenarios: Scenario[] } | null;
  enhancedFixes?: { fixes: EnhancedFix[] } | null;
  aggregatedScenarios?: AggregatedScenario[];
  analysisDate?: string;
  referenceScript?: string;
}

// ============= CSV/EXCEL EXPORT =============

const SEVERITY_WEIGHT: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

const FIX_TYPE_LABELS: Record<string, string> = {
  script: 'Script / Prompt',
  training: 'Training',
  process: 'Process',
  system: 'System',
};

const RCA_LABELS: Record<string, string> = {
  knowledge: 'Knowledge Gap',
  instruction: 'Instruction Gap',
  execution: 'Execution Failure',
  conversation: 'Conversation Design',
  model: 'Model Limitation',
};

const DIMENSIONS: Record<string, string> = {
  A: 'Conversation Control & Flow',
  B: 'Temporal Dynamics',
  C: 'Context Tracking',
  D: 'Language Quality',
  E: 'Knowledge & Accuracy',
  F: 'Process & Policy',
  G: 'Novel Issues',
};

function setColWidths(ws: XLSX.WorkSheet, widths: number[]): void {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

export function generateComprehensiveExcel(data: ExportData): void {
  const wb = XLSX.utils.book_new();
  const timestamp = new Date().toISOString().split('T')[0];

  // Sheet 1 — Summary (quick KPIs at a glance)
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data), '1. Summary');

  // Sheet 2 — Action Plan (ranked fixes — most important for ops)
  const hasFixes = (data.enhancedFixes?.fixes?.length ?? 0) > 0 ||
    ((data.fixes?.scriptFixes?.length ?? 0) + (data.fixes?.generalFixes?.length ?? 0)) > 0;
  if (hasFixes) {
    XLSX.utils.book_append_sheet(wb, buildActionPlanSheet(data), '2. Action Plan');
  }

  // Sheet 3 — Call Scorecard (per-call dimension breakdown)
  XLSX.utils.book_append_sheet(wb, buildCallScorecardSheet(data), '3. Call Scorecard');

  // Sheet 4 — All Issues (raw, with Fix # reference)
  if (data.flowType === 'open-ended' && data.scenarioResults?.scenarios?.length) {
    XLSX.utils.book_append_sheet(wb, buildIssuesSheet(data.scenarioResults.scenarios, data.enhancedFixes?.fixes ?? []), '4. All Issues');
  } else if (data.flowType === 'objective' && data.results?.issues?.length) {
    XLSX.utils.book_append_sheet(wb, buildObjectiveIssuesSheet(data.results), '4. All Issues');
  }

  // Sheet 5 — Patterns (aggregated groups)
  if (data.aggregatedScenarios?.length) {
    XLSX.utils.book_append_sheet(wb, buildPatternsSheet(data.aggregatedScenarios), '5. Patterns');
  }

  XLSX.writeFile(wb, `QA_Report_${timestamp}.xlsx`);
}

// ─── Sheet 1: Summary ─────────────────────────────────────────────────────────

function buildSummarySheet(data: ExportData): XLSX.WorkSheet {
  const totalCalls = data.transcripts.length;
  const date = data.analysisDate || new Date().toLocaleString();

  let totalIssues = 0;
  let callsWithIssues = 0;
  const sevCount: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };

  if (data.flowType === 'open-ended' && data.scenarioResults) {
    const scenarios = data.scenarioResults.scenarios;
    totalIssues = scenarios.length;
    callsWithIssues = new Set(scenarios.map(s => s.callId)).size;
    scenarios.forEach(s => { sevCount[s.severity] = (sevCount[s.severity] ?? 0) + 1; });
  } else if (data.flowType === 'objective' && data.results) {
    totalIssues = data.results.issues.length;
    callsWithIssues = data.results.callsWithIssues;
    data.results.issues.forEach(i => { sevCount[i.severity] = (sevCount[i.severity] ?? 0) + 1; });
  }

  const healthScore = totalCalls > 0 ? Math.round(((totalCalls - callsWithIssues) / totalCalls) * 100) : 0;
  const issueRate = totalCalls > 0 ? Math.round((callsWithIssues / totalCalls) * 100) : 0;

  // Top 5 recurring issues by title
  const topIssues: string[][] = [];
  if (data.aggregatedScenarios?.length) {
    [...data.aggregatedScenarios]
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5)
      .forEach((agg, i) => {
        topIssues.push([`  ${i + 1}.`, agg.title, `${agg.uniqueCalls} calls`, agg.severity]);
      });
  }

  const rows: (string | number)[][] = [
    ['AI Agent QA Report'],
    ['Analysis Date', date],
    ['Flow Type', data.flowType === 'open-ended' ? 'Open-Ended (Qualitative)' : 'Objective Checks'],
    [''],
    ['── HEADLINE NUMBERS ──', '', '', ''],
    ['Metric', 'Value', '', ''],
    ['Total Calls Analyzed', totalCalls],
    ['Calls with Issues', `${callsWithIssues} (${issueRate}%)`],
    ['Clean Calls', `${totalCalls - callsWithIssues} (${100 - issueRate}%)`],
    ['Total Issues Found', totalIssues],
    ['Issues per Call (avg)', totalCalls > 0 ? +(totalIssues / totalCalls).toFixed(1) : 0],
    ['Health Score', `${healthScore}%`],
    [''],
    ['── SEVERITY BREAKDOWN ──', '', '', ''],
    ['Severity', 'Count', '% of Issues', ''],
    ['Critical', sevCount.critical, totalIssues > 0 ? `${((sevCount.critical / totalIssues) * 100).toFixed(1)}%` : '0%'],
    ['High',     sevCount.high,     totalIssues > 0 ? `${((sevCount.high / totalIssues) * 100).toFixed(1)}%` : '0%'],
    ['Medium',   sevCount.medium,   totalIssues > 0 ? `${((sevCount.medium / totalIssues) * 100).toFixed(1)}%` : '0%'],
    ['Low',      sevCount.low,      totalIssues > 0 ? `${((sevCount.low / totalIssues) * 100).toFixed(1)}%` : '0%'],
  ];

  if (topIssues.length) {
    rows.push(['']);
    rows.push(['── TOP RECURRING ISSUES ──', '', '', '']);
    rows.push(['#', 'Issue Pattern', 'Calls Affected', 'Severity']);
    topIssues.forEach(r => rows.push(r));
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [32, 28, 18, 12]);
  return ws;
}

// ─── Sheet 2: Action Plan ─────────────────────────────────────────────────────

function buildActionPlanSheet(data: ExportData): XLSX.WorkSheet {
  const headers = [
    'Fix #',
    'Priority',
    'Fix Title',
    'Fix Type',
    'Root Cause',
    'What to Do',
    'Where to Implement',
    'Concrete Example',
    'Success Criteria',
    'How to Test',
    'Owner',
    'Status',
    'Due Date',
  ];

  const rows: (string | number)[][] = [];

  if (data.enhancedFixes?.fixes?.length) {
    // Sort by severity of linked scenarios: fixes covering more critical issues first
    const fixes = data.enhancedFixes.fixes;
    fixes.forEach((fix, idx) => {
      const priority = idx === 0 ? 'P0 — Critical' : idx < 3 ? 'P1 — High' : idx < 6 ? 'P2 — Medium' : 'P3 — Low';
      rows.push([
        `F${idx + 1}`,
        priority,
        fix.title,
        FIX_TYPE_LABELS[fix.fixType] ?? fix.fixType,
        RCA_LABELS[fix.rootCauseType] ?? fix.rootCauseType,
        fix.suggestedSolution,
        fix.whereToImplement,
        typeof fix.concreteExample === 'string' ? fix.concreteExample : JSON.stringify(fix.concreteExample),
        fix.successCriteria,
        fix.howToTest,
        '',        // Owner — ops fills in
        'Pending', // Status
        '',        // Due Date
      ]);
    });
  } else if (data.fixes) {
    const allFixes = [...(data.fixes.scriptFixes ?? []), ...(data.fixes.generalFixes ?? [])];
    allFixes.forEach((fix, idx) => {
      const priority = idx < 2 ? 'P0 — Critical' : idx < 5 ? 'P1 — High' : 'P2 — Medium';
      rows.push([
        `F${idx + 1}`,
        priority,
        fix.problem,
        'Script / Prompt',
        RCA_LABELS[fix.rootCauseType ?? ''] ?? fix.rootCauseType ?? 'N/A',
        fix.suggestion,
        fix.placementHint,
        fix.exampleResponse,
        '',
        '',
        '',
        'Pending',
        '',
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [7, 16, 36, 16, 20, 48, 32, 48, 36, 32, 18, 12, 12]);
  return ws;
}

// ─── Sheet 3: Call Scorecard ──────────────────────────────────────────────────

function buildCallScorecardSheet(data: ExportData): XLSX.WorkSheet {
  const dimKeys = Object.keys(DIMENSIONS);
  const headers = [
    'Call ID',
    'Total Issues',
    'Worst Severity',
    'Status',
    ...dimKeys.map(k => `${k}: ${DIMENSIONS[k]}`),
    'Top Root Cause',
    'Issue Titles (brief)',
  ];

  const rows = data.transcripts.map(transcript => {
    const scenarios = data.flowType === 'open-ended' && data.scenarioResults
      ? data.scenarioResults.scenarios.filter(s => s.callId === transcript.id)
      : [];
    const issues = data.flowType === 'objective' && data.results
      ? data.results.issues.filter(i => i.callId === transcript.id)
      : [];

    const allItems = scenarios.length ? scenarios : issues;
    const count = allItems.length;

    const worstSev = count === 0 ? 'Clean' : (() => {
      const w = Math.max(...allItems.map(x => SEVERITY_WEIGHT[('severity' in x ? x.severity : 'low')] ?? 1));
      return w >= 4 ? 'Critical' : w >= 3 ? 'High' : w >= 2 ? 'Medium' : 'Low';
    })();

    const status = count === 0 ? '✓ Pass'
      : worstSev === 'Critical' ? '🔴 Critical'
      : worstSev === 'High' ? '🟠 Needs Review'
      : '🟡 Minor Issues';

    // Per-dimension: issue count or blank
    const dimCounts = dimKeys.map(k => {
      const dimScenarios = scenarios.filter(s => s.dimension?.charAt(0).toUpperCase() === k);
      return dimScenarios.length > 0 ? dimScenarios.length : '';
    });

    // Top root cause
    const rcaFreq: Record<string, number> = {};
    scenarios.forEach(s => {
      if (s.rootCauseType) rcaFreq[s.rootCauseType] = (rcaFreq[s.rootCauseType] ?? 0) + 1;
    });
    const topRCA = Object.entries(rcaFreq).sort((a, b) => b[1] - a[1])[0];
    const topRCALabel = topRCA ? (RCA_LABELS[topRCA[0]] ?? topRCA[0]) : '';

    // Brief titles (first 3)
    const titles = scenarios.slice(0, 3).map(s => s.title).join(' | ');

    return [transcript.id, count, worstSev, status, ...dimCounts, topRCALabel, titles];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [20, 12, 14, 16, ...dimKeys.map(() => 14), 22, 60]);
  return ws;
}

// ─── Sheet 4a: All Issues (open-ended) ───────────────────────────────────────

function buildIssuesSheet(scenarios: Scenario[], fixes: EnhancedFix[]): XLSX.WorkSheet {
  // Build RCA → Fix # map so each issue row can reference its fix
  const rcaToFixNum: Record<string, string> = {};
  fixes.forEach((fix, idx) => {
    rcaToFixNum[fix.rootCauseType] = `F${idx + 1}`;
  });

  const headers = [
    '#',
    'Call ID',
    'Issue Title',
    'Audit Dimension',
    'Root Cause',
    'What Happened',
    'Impact on Customer',
    'Severity',
    'Confidence %',
    'Fix # (→ Action Plan)',
  ];

  const rows = scenarios.map((s, idx) => [
    idx + 1,
    s.callId,
    s.title,
    s.dimension ?? 'N/A',
    RCA_LABELS[s.rootCauseType ?? ''] ?? s.rootCauseType ?? 'N/A',
    s.whatHappened,
    s.impact,
    s.severity.charAt(0).toUpperCase() + s.severity.slice(1),
    s.confidence,
    s.rootCauseType ? (rcaToFixNum[s.rootCauseType] ?? '—') : '—',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [5, 20, 40, 28, 22, 52, 44, 10, 12, 20]);
  return ws;
}

// ─── Sheet 4b: All Issues (objective) ────────────────────────────────────────

function buildObjectiveIssuesSheet(results: AnalysisResult): XLSX.WorkSheet {
  const headers = [
    '#',
    'Call ID',
    'Issue Type',
    'Root Cause',
    'Evidence',
    'Explanation',
    'Suggested Fix',
    'Severity',
    'Confidence %',
    'Line Numbers',
  ];

  const rows = results.issues.map((issue, idx) => [
    idx + 1,
    issue.callId,
    issue.type,
    RCA_LABELS[issue.rootCauseType ?? ''] ?? issue.rootCauseType ?? 'N/A',
    issue.evidenceSnippet,
    issue.explanation,
    issue.suggestedFix ?? 'See Action Plan',
    issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1),
    Math.round(issue.confidence * 100),
    issue.lineNumbers.join('; '),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [5, 20, 24, 22, 36, 52, 40, 10, 12, 14]);
  return ws;
}

// ─── Sheet 5: Patterns ───────────────────────────────────────────────────────

function buildPatternsSheet(aggregated: AggregatedScenario[]): XLSX.WorkSheet {
  const headers = [
    '#',
    'Pattern',
    'Dimension',
    'Root Cause',
    'Description',
    'Severity',
    'Occurrences',
    'Calls Affected',
    'Avg Confidence %',
    'Affected Call IDs',
  ];

  const sorted = [...aggregated].sort((a, b) => {
    const sw = (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0);
    return sw !== 0 ? sw : b.occurrences - a.occurrences;
  });

  const rows = sorted.map((agg, idx) => [
    idx + 1,
    agg.title,
    agg.dimension ?? 'N/A',
    RCA_LABELS[agg.rootCauseType ?? ''] ?? agg.rootCauseType ?? 'N/A',
    agg.pattern,
    agg.severity.charAt(0).toUpperCase() + agg.severity.slice(1),
    agg.occurrences,
    agg.uniqueCalls,
    +agg.avgConfidence.toFixed(1),
    agg.affectedCallIds.join(', '),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [5, 40, 28, 22, 52, 10, 12, 14, 16, 40]);
  return ws;
}

// ============= PDF EXPORT =============

// Helper function to draw pie chart
function drawPieChart(
  doc: jsPDF,
  x: number,
  y: number,
  radius: number,
  data: { label: string; value: number; color: string }[]
): void {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let startAngle = -90; // Start from top

  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 360;
    const endAngle = startAngle + sliceAngle;

    // Draw slice
    doc.setFillColor(item.color);
    doc.circle(x, y, radius, 'F');

    // Draw arc (simplified as circle for each segment)
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // Create pie slice path
    doc.setFillColor(item.color);
    const segments = 20;
    const angleStep = (endAngle - startAngle) / segments;

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + i * angleStep;
      const rad = (angle * Math.PI) / 180;
      const px = x + radius * Math.cos(rad);
      const py = y + radius * Math.sin(rad);

      if (i === 0) {
        doc.moveTo(x, y);
        doc.lineTo(px, py);
      } else {
        doc.lineTo(px, py);
      }
    }
    doc.lineTo(x, y);

    startAngle = endAngle;
  });
}

// Helper function to draw bar chart
function drawBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  data: { label: string; value: number; color: string }[],
  maxValue?: number
): void {
  const max = maxValue || Math.max(...data.map((d) => d.value));
  const barWidth = width / data.length - 5;
  const labelHeight = 15;

  data.forEach((item, index) => {
    const barHeight = (item.value / max) * (height - labelHeight);
    const barX = x + index * (barWidth + 5);
    const barY = y + height - barHeight - labelHeight;

    // Draw bar
    doc.setFillColor(item.color);
    doc.rect(barX, barY, barWidth, barHeight, 'F');

    // Draw value on top
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(item.value.toString(), barX + barWidth / 2, barY - 2, { align: 'center' });

    // Draw label
    doc.setFontSize(7);
    doc.text(item.label.substring(0, 10), barX + barWidth / 2, y + height, {
      align: 'center',
      maxWidth: barWidth,
    });
  });

  doc.setTextColor(0, 0, 0); // Reset color
}

export function generateComprehensivePDF(data: ExportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPos = 20;

  // Cover Page
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('AI Agent Control Center', pageWidth / 2, yPos, { align: 'center' });

  yPos += 10;
  doc.setFontSize(18);
  doc.text('Analysis Report', pageWidth / 2, yPos, { align: 'center' });

  yPos += 20;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');

  const totalCalls = data.transcripts.length;
  let totalIssues = 0;
  let callsWithIssues = 0;

  if (data.flowType === 'open-ended' && data.scenarioResults) {
    totalIssues = data.scenarioResults.scenarios.length;
    callsWithIssues = new Set(data.scenarioResults.scenarios.map(s => s.callId)).size;
  } else if (data.flowType === 'objective' && data.results) {
    totalIssues = data.results.issues.length;
    callsWithIssues = data.results.callsWithIssues;
  }

  const healthScore = totalCalls > 0 ? Math.round(((totalCalls - callsWithIssues) / totalCalls) * 100) : 0;

  // Executive Summary Box
  doc.setFillColor(240, 240, 250);
  doc.rect(20, yPos, pageWidth - 40, 70, 'F');

  yPos += 10;
  doc.setFontSize(10);
  doc.text(`Analysis Date: ${data.analysisDate || new Date().toLocaleString()}`, 25, yPos);
  yPos += 8;
  doc.text(`Flow Type: ${data.flowType === 'open-ended' ? 'Open-Ended Analysis' : 'Objective Checks'}`, 25, yPos);
  yPos += 8;
  doc.text(`Total Calls Analyzed: ${totalCalls}`, 25, yPos);
  yPos += 8;
  doc.text(`Calls with Issues: ${callsWithIssues} (${Math.round((callsWithIssues / totalCalls) * 100)}%)`, 25, yPos);
  yPos += 8;
  doc.text(`Clean Calls: ${totalCalls - callsWithIssues} (${Math.round(((totalCalls - callsWithIssues) / totalCalls) * 100)}%)`, 25, yPos);
  yPos += 8;
  doc.text(`Total Issues/Scenarios: ${totalIssues}`, 25, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Overall Health Score: ${healthScore}%`, 25, yPos);
  doc.setFont('helvetica', 'normal');

  // Add charts page
  doc.addPage();
  addChartsPage(doc, data);

  // Add detailed data tables
  if (data.flowType === 'open-ended' && data.scenarioResults) {
    doc.addPage();
    addScenariosToPDF(doc, data.scenarioResults.scenarios);
  } else if (data.flowType === 'objective' && data.results) {
    doc.addPage();
    addIssuesToPDF(doc, data.results);
  }

  // Add fix recommendations
  if (data.enhancedFixes && data.enhancedFixes.fixes.length > 0) {
    doc.addPage();
    addFixesToPDF(doc, data.enhancedFixes.fixes);
  }

  // Save PDF
  const timestamp = new Date().toISOString().split('T')[0];
  doc.save(`AI_Agent_Analysis_Report_${timestamp}.pdf`);
}

function addChartsPage(doc: jsPDF, data: ExportData): void {
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Visual Analytics', 20, yPos);
  yPos += 15;

  if (data.flowType === 'open-ended' && data.scenarioResults) {
    const scenarios = data.scenarioResults.scenarios;

    // Severity Distribution Pie Chart
    doc.setFontSize(12);
    doc.text('Severity Distribution', 20, yPos);
    const severityData = calculateSeverityDistribution(scenarios);
    drawSimplePieChart(doc, 60, yPos + 10, severityData);
    yPos += 60;

    // RCA Category Distribution
    doc.setFontSize(12);
    doc.text('Root Cause Categories', 20, yPos);
    const rcaData = calculateRCADistribution(scenarios);
    drawSimplePieChart(doc, 60, yPos + 10, rcaData);
    yPos += 60;

    // Top Issues Bar Chart
    if (data.aggregatedScenarios && data.aggregatedScenarios.length > 0) {
      doc.setFontSize(12);
      doc.text('Top Issues by Occurrence', 20, yPos);
      const topIssues = data.aggregatedScenarios
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 5);
      drawHorizontalBars(doc, 20, yPos + 5, topIssues);
    }
  } else if (data.flowType === 'objective' && data.results) {
    // Issue Type Distribution
    doc.setFontSize(12);
    doc.text('Issue Type Distribution', 20, yPos);
    const issueTypeData = Object.entries(data.results.issuesByType).map(([type, count]) => ({
      label: type.replace('_', ' '),
      value: count,
      percentage: ((count / data.results!.issues.length) * 100).toFixed(1),
    }));
    drawSimplePieChart(doc, 60, yPos + 10, issueTypeData);
    yPos += 60;

    // Severity Distribution
    doc.setFontSize(12);
    doc.text('Severity Distribution', 20, yPos);
    const severityData = Object.entries(data.results.severityDistribution).map(([severity, count]) => ({
      label: severity,
      value: count,
      percentage: ((count / data.results!.issues.length) * 100).toFixed(1),
    }));
    drawSimplePieChart(doc, 60, yPos + 10, severityData);
  }
}

function calculateSeverityDistribution(scenarios: any[]): any[] {
  const dist: Record<string, number> = {};
  scenarios.forEach((s) => {
    dist[s.severity] = (dist[s.severity] || 0) + 1;
  });

  const colors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };

  return Object.entries(dist).map(([severity, count]) => ({
    label: severity,
    value: count,
    percentage: ((count / scenarios.length) * 100).toFixed(1),
    color: colors[severity] || '#6b7280',
  }));
}

function calculateRCADistribution(scenarios: any[]): any[] {
  const dist: Record<string, number> = {};
  scenarios.forEach((s) => {
    const rca = s.rootCauseType || 'Unknown';
    dist[rca] = (dist[rca] || 0) + 1;
  });

  const colors: Record<string, string> = {
    knowledge: '#eab308',
    instruction: '#06b6d4',
    execution: '#f97316',
    conversation: '#8b5cf6',
    model: '#10b981',
    Unknown: '#6b7280',
  };

  return Object.entries(dist).map(([rca, count]) => ({
    label: rca,
    value: count,
    percentage: ((count / scenarios.length) * 100).toFixed(1),
    color: colors[rca] || '#6b7280',
  }));
}

function drawSimplePieChart(doc: jsPDF, centerX: number, centerY: number, data: any[]): void {
  const radius = 25;
  const legendX = centerX + radius + 15;
  let legendY = centerY - radius;

  const total = data.reduce((sum, item) => sum + item.value, 0);
  let startAngle = 0;

  // Draw pie slices
  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 360;
    const endAngle = startAngle + sliceAngle;

    // Convert hex color to RGB
    const r = parseInt(item.color.slice(1, 3), 16);
    const g = parseInt(item.color.slice(3, 5), 16);
    const b = parseInt(item.color.slice(5, 7), 16);

    doc.setFillColor(r, g, b);

    // Draw arc as a series of triangles
    const segments = Math.max(2, Math.ceil(sliceAngle / 10));
    for (let i = 0; i < segments; i++) {
      const angle1 = startAngle + (i * sliceAngle) / segments;
      const angle2 = startAngle + ((i + 1) * sliceAngle) / segments;

      const x1 = centerX + radius * Math.cos((angle1 * Math.PI) / 180);
      const y1 = centerY + radius * Math.sin((angle1 * Math.PI) / 180);
      const x2 = centerX + radius * Math.cos((angle2 * Math.PI) / 180);
      const y2 = centerY + radius * Math.sin((angle2 * Math.PI) / 180);

      doc.triangle(centerX, centerY, x1, y1, x2, y2, 'F');
    }

    startAngle = endAngle;
  });

  // Draw legend
  data.forEach((item, index) => {
    const y = legendY + index * 8;

    // Color box
    const r = parseInt(item.color.slice(1, 3), 16);
    const g = parseInt(item.color.slice(3, 5), 16);
    const b = parseInt(item.color.slice(5, 7), 16);
    doc.setFillColor(r, g, b);
    doc.rect(legendX, y - 3, 4, 4, 'F');

    // Label
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`${item.label}: ${item.value} (${item.percentage}%)`, legendX + 6, y);
  });
}

function drawHorizontalBars(doc: jsPDF, x: number, y: number, data: any[]): void {
  const maxWidth = 120;
  const barHeight = 8;
  const spacing = 12;
  const maxValue = Math.max(...data.map((d) => d.occurrences));

  data.forEach((item, index) => {
    const barY = y + index * spacing;
    const barWidth = (item.occurrences / maxValue) * maxWidth;

    // Draw bar
    doc.setFillColor(100, 150, 230);
    doc.rect(x + 60, barY, barWidth, barHeight, 'F');

    // Draw label
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const label = item.title.substring(0, 25) + (item.title.length > 25 ? '...' : '');
    doc.text(label, x, barY + 5);

    // Draw value
    doc.text(item.occurrences.toString(), x + 62 + barWidth, barY + 5);
  });
}

function addScenariosToPDF(doc: jsPDF, scenarios: Scenario[]): void {
  const tableData = scenarios.slice(0, 20).map(s => [
    s.callId,
    s.title.substring(0, 30),
    s.severity,
    s.rootCauseType || 'N/A',
    `${s.confidence}%`,
  ]);

  autoTable(doc, {
    head: [['Call ID', 'Title', 'Severity', 'RCA Type', 'Confidence']],
    body: tableData,
    startY: 40,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202] },
    styles: { fontSize: 8 },
  });

  // Add summary text
  const finalY = (doc as any).lastAutoTable.finalY || 40;
  doc.setFontSize(10);
  doc.text(`Showing top 20 of ${scenarios.length} scenarios`, 20, finalY + 10);
}

function addIssuesToPDF(doc: jsPDF, results: AnalysisResult): void {
  const tableData = results.issues.slice(0, 20).map(issue => [
    issue.callId,
    issue.type,
    issue.severity,
    `${Math.round(issue.confidence * 100)}%`,
    issue.explanation.substring(0, 50) + '...',
  ]);

  autoTable(doc, {
    head: [['Call ID', 'Type', 'Severity', 'Confidence', 'Explanation']],
    body: tableData,
    startY: 40,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202] },
    styles: { fontSize: 8 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 40;
  doc.setFontSize(10);
  doc.text(`Showing top 20 of ${results.issues.length} issues`, 20, finalY + 10);
}

function addFixesToPDF(doc: jsPDF, fixes: EnhancedFix[]): void {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Fix Recommendations', 20, 20);

  const tableData = fixes.slice(0, 15).map((fix, idx) => {
    const priority = idx < 3 ? 'P0' : idx < 6 ? 'P1' : 'P2';
    return [
      priority,
      fix.title.substring(0, 40),
      fix.fixType,
      fix.rootCauseType,
    ];
  });

  autoTable(doc, {
    head: [['Priority', 'Fix Title', 'Type', 'RCA Category']],
    body: tableData,
    startY: 30,
    theme: 'grid',
    headStyles: { fillColor: [40, 167, 69] },
    styles: { fontSize: 9 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 30;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Showing top 15 of ${fixes.length} recommendations`, 20, finalY + 10);
}

// ============= NEW VISUAL PDF EXPORT (HTML to PDF) =============

export async function generateVisualPDF(data: ExportData): Promise<void> {
  try {
    console.log('[Visual PDF] Starting export...');

    // Wait a moment for any animations/rendering to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find the aggregate results container in the DOM
    const aggregateContainer = document.querySelector('[data-aggregate-results]') as HTMLElement;

    if (!aggregateContainer) {
      console.error('[Visual PDF] Aggregate results container not found in DOM');
      console.error('[Visual PDF] Make sure you are in the Overview/Aggregate view, not Detailed view');

      // Fallback to old PDF generation
      console.log('[Visual PDF] Falling back to chart-based PDF generation');
      return generateComprehensivePDF(data);
    }

    console.log('[Visual PDF] Found container, dimensions:', {
      width: aggregateContainer.offsetWidth,
      height: aggregateContainer.offsetHeight
    });

    // Check if container has content
    if (aggregateContainer.offsetHeight === 0 || aggregateContainer.offsetWidth === 0) {
      console.error('[Visual PDF] Container has no dimensions');
      return generateComprehensivePDF(data);
    }

    console.log('[Visual PDF] Capturing with html2canvas...');

    // Capture the rendered view with html2canvas
    const canvas = await html2canvas(aggregateContainer, {
      scale: 2, // Higher resolution
      backgroundColor: '#0f172a', // Match dark background
      logging: true,
      useCORS: true,
      allowTaint: true,
      windowWidth: aggregateContainer.scrollWidth,
      windowHeight: aggregateContainer.scrollHeight,
    });

    console.log('[Visual PDF] Canvas created:', { width: canvas.width, height: canvas.height });

    // Create PDF
    const imgData = canvas.toDataURL('image/png');

    // Determine page size based on canvas aspect ratio
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const pdfWidth = 595; // A4 width in points
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

    const pdf = new jsPDF({
      orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
      unit: 'pt',
      format: [pdfWidth, Math.min(pdfHeight, 842 * 5)], // Limit to 5 pages height
    });

    console.log('[Visual PDF] Adding cover page...');

    // Add cover page
    pdf.addPage([595, 842], 'portrait'); // A4 size
    pdf.setPage(1);

    const pageWidth = pdf.internal.pageSize.width;
    let yPos = 100;

    // Title
    pdf.setFontSize(32);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('AI Agent Control Center', pageWidth / 2, yPos, { align: 'center' });

    yPos += 25;
    pdf.setFontSize(20);
    pdf.text('Visual Analysis Report', pageWidth / 2, yPos, { align: 'center' });

    // Executive Summary Box
    yPos += 40;
    const boxWidth = 400;
    const boxX = (pageWidth - boxWidth) / 2;

    pdf.setFillColor(30, 41, 59); // slate-800
    pdf.roundedRect(boxX, yPos, boxWidth, 200, 8, 8, 'F');

    yPos += 25;
    pdf.setFontSize(14);
    pdf.setTextColor(148, 163, 184); // slate-400

    const totalCalls = data.transcripts.length;
    let totalIssues = 0;
    let callsWithIssues = 0;

    if (data.flowType === 'open-ended' && data.scenarioResults) {
      totalIssues = data.scenarioResults.scenarios.length;
      callsWithIssues = new Set(data.scenarioResults.scenarios.map(s => s.callId)).size;
    } else if (data.flowType === 'objective' && data.results) {
      totalIssues = data.results.issues.length;
      callsWithIssues = data.results.callsWithIssues;
    }

    const healthScore = totalCalls > 0 ? Math.round(((totalCalls - callsWithIssues) / totalCalls) * 100) : 0;

    pdf.text(`Date: ${data.analysisDate || new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 20;
    pdf.text(`Flow Type: ${data.flowType === 'open-ended' ? 'Open-Ended Analysis' : 'Objective Checks'}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 25;

    pdf.setFontSize(16);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Total Calls: ${totalCalls}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 20;
    pdf.text(`Calls with Issues: ${callsWithIssues}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 20;
    pdf.text(`Total Scenarios: ${totalIssues}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 30;

    pdf.setFontSize(24);
    pdf.setTextColor(16, 185, 129); // green-500
    pdf.text(`Health Score: ${healthScore}%`, pageWidth / 2, yPos, { align: 'center' });

    console.log('[Visual PDF] Adding captured image...');

    // Add captured image on next page - fit to page width
    pdf.addPage([pdfWidth, Math.min(pdfHeight + 40, 842 * 5)], 'portrait');
    pdf.addImage(imgData, 'PNG', 0, 20, pdfWidth, Math.min(pdfHeight, 842 * 5 - 40));

    // Save PDF
    const timestamp = new Date().toISOString().split('T')[0];
    console.log('[Visual PDF] Saving file...');
    pdf.save(`AI_Agent_Visual_Report_${timestamp}.pdf`);

    console.log('[Visual PDF] Export completed successfully');
  } catch (error) {
    console.error('[Visual PDF] Error generating visual PDF:', error);
    console.error('[Visual PDF] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Try fallback to old method
    console.log('[Visual PDF] Attempting fallback to chart-based PDF...');
    try {
      return generateComprehensivePDF(data);
    } catch (fallbackError) {
      console.error('[Visual PDF] Fallback also failed:', fallbackError);
      throw new Error(`PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure you are viewing the Overview/Aggregate results.`);
    }
  }
}
