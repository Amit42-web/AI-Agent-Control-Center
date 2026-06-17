import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EnhancedFix, FixType, RootCauseType, Scenario } from '@/types';

interface FixesReportData {
  fixes: EnhancedFix[];
  scenarios?: Scenario[];
  analysisDate?: string;
}

const FIX_TYPE_LABELS: Record<FixType, string> = {
  script: 'Script / Prompt',
  training: 'Training',
  process: 'Process',
  system: 'System',
};

const RCA_LABELS: Record<RootCauseType, string> = {
  knowledge: 'Knowledge Gap',
  instruction: 'Instruction Gap',
  execution: 'Execution Failure',
  conversation: 'Conversation Design',
  model: 'Model Limitation',
};

const SEVERITY_WEIGHT: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

// ============= EXCEL EXPORT =============

export function generateFixesExcel(data: FixesReportData): void {
  const timestamp = new Date().toISOString().split('T')[0];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildFixPlanSheet(data), 'Fix Plan');
  XLSX.writeFile(wb, `Fix_Plan_${timestamp}.xlsx`);
}

function buildFixPlanSheet(data: FixesReportData): XLSX.WorkSheet {
  const { fixes, scenarios = [] } = data;

  // Count scenarios (incidents) per RCA type
  const rcaIncidentCount: Record<string, number> = {};
  scenarios.forEach(s => {
    if (!s.rootCauseType) return;
    rcaIncidentCount[s.rootCauseType] = (rcaIncidentCount[s.rootCauseType] ?? 0) + 1;
  });
  const totalIncidents = scenarios.length;

  // Score each fix: incident count × avg severity
  const scored = fixes.map(fix => {
    const incidents = rcaIncidentCount[fix.rootCauseType] ?? 0;
    const rcaScenarios = scenarios.filter(s => s.rootCauseType === fix.rootCauseType);
    const avgSev = rcaScenarios.length
      ? rcaScenarios.reduce((sum, s) => sum + (SEVERITY_WEIGHT[s.severity] ?? 1), 0) / rcaScenarios.length
      : 1;
    return { fix, incidents, score: incidents * avgSev };
  });

  scored.sort((a, b) => b.score - a.score);

  const headers = [
    '#',
    'Priority',
    'Fix Title',
    'Fix Type',
    'Root Cause',
    'Why This Happened',
    'What to Do',
    'Where to Implement',
    'Incidents',
  ];

  const rows = scored.map(({ fix, incidents }, rank) => {
    const priority = rank === 0 ? 'P0 — Critical'
      : rank < 3 ? 'P1 — High'
      : rank < 6 ? 'P2 — Medium'
      : 'P3 — Low';

    const incidentsDisplay = incidents > 0 && totalIncidents > 0
      ? `${incidents} (${Math.round((incidents / totalIncidents) * 100)}% of issues)`
      : '—';

    return [
      rank + 1,
      priority,
      fix.title,
      FIX_TYPE_LABELS[fix.fixType] ?? fix.fixType,
      RCA_LABELS[fix.rootCauseType] ?? fix.rootCauseType,
      fix.rootCause,
      fix.suggestedSolution,
      fix.whereToImplement,
      incidentsDisplay,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 36 },
    { wch: 16 },
    { wch: 22 },
    { wch: 52 },
    { wch: 52 },
    { wch: 36 },
    { wch: 16 },
  ];
  return ws;
}

// ============= PDF EXPORT =============

const fixTypeLabels: Record<FixType, string> = {
  script: 'Script/Prompt',
  training: 'Training',
  process: 'Process',
  system: 'System',
};

const rootCauseLabels: Record<RootCauseType, string> = {
  knowledge: 'Knowledge Gap',
  instruction: 'Instruction Gap',
  execution: 'Execution Failure',
  conversation: 'Conversation Design',
  model: 'Model Limitation',
};

export function generateFixesPDF(data: FixesReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Fixes & Recommendations', pageWidth / 2, yPos, { align: 'center' });

  yPos += 15;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('AI Agent Control Center', pageWidth / 2, yPos, { align: 'center' });

  yPos += 30;
  doc.setFontSize(12);

  const fixesByType: Record<string, number> = {};
  const fixesByRCA: Record<string, number> = {};

  data.fixes.forEach((fix) => {
    fixesByType[fix.fixType] = (fixesByType[fix.fixType] || 0) + 1;
    fixesByRCA[fix.rootCauseType] = (fixesByRCA[fix.rootCauseType] || 0) + 1;
  });

  doc.setFillColor(240, 240, 250);
  doc.rect(20, yPos, pageWidth - 40, 80, 'F');

  yPos += 10;
  doc.setFontSize(10);
  doc.text(`Report Date: ${data.analysisDate || new Date().toLocaleString()}`, 25, yPos);
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Total Fixes: ${data.fixes.length}`, 25, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  yPos += 12;

  doc.text('By Fix Type:', 25, yPos);
  yPos += 6;
  Object.entries(fixesByType).forEach(([type, count]) => {
    doc.text(`  • ${fixTypeLabels[type as FixType]}: ${count}`, 30, yPos);
    yPos += 5;
  });

  yPos += 5;
  doc.text('By Root Cause:', 25, yPos);
  yPos += 6;
  Object.entries(fixesByRCA).forEach(([rca, count]) => {
    doc.text(`  • ${rootCauseLabels[rca as RootCauseType]}: ${count}`, 30, yPos);
    yPos += 5;
  });

  doc.addPage();
  addDetailedFixesToPDF(doc, data.fixes);

  doc.addPage();
  addImplementationPlanToPDF(doc, data.fixes);

  const timestamp = new Date().toISOString().split('T')[0];
  doc.save(`Fixes_Report_${timestamp}.pdf`);
}

function addDetailedFixesToPDF(doc: jsPDF, fixes: EnhancedFix[]): void {
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Detailed Fixes', 20, 20);

  const tableData = fixes.map((fix, idx) => [
    idx + 1,
    fix.title,
    fixTypeLabels[fix.fixType],
    rootCauseLabels[fix.rootCauseType],
    fix.suggestedSolution.substring(0, 100) + (fix.suggestedSolution.length > 100 ? '...' : ''),
  ]);

  autoTable(doc, {
    head: [['#', 'Title', 'Type', 'Root Cause', 'Solution']],
    body: tableData,
    startY: 30,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
      4: { cellWidth: 70 },
    },
  });
}

function addImplementationPlanToPDF(doc: jsPDF, fixes: EnhancedFix[]): void {
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Implementation Plan', 20, 20);

  const priorityOrder: Record<RootCauseType, number> = {
    knowledge: 1,
    instruction: 2,
    execution: 3,
    conversation: 4,
    model: 5,
  };

  const sortedFixes = [...fixes].sort(
    (a, b) => priorityOrder[a.rootCauseType] - priorityOrder[b.rootCauseType]
  );

  const tableData = sortedFixes.map((fix, index) => {
    const priority = index < 5 ? 'P0' : index < 10 ? 'P1' : 'P2';
    return [
      priority,
      fix.title,
      fixTypeLabels[fix.fixType],
      fix.whereToImplement.substring(0, 50) + (fix.whereToImplement.length > 50 ? '...' : ''),
      fix.successCriteria.substring(0, 50) + (fix.successCriteria.length > 50 ? '...' : ''),
    ];
  });

  autoTable(doc, {
    head: [['Priority', 'Fix', 'Type', 'Where', 'Success Criteria']],
    body: tableData,
    startY: 30,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 45 },
      2: { cellWidth: 30 },
      3: { cellWidth: 50 },
      4: { cellWidth: 50 },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 30;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('Priority: P0 = Critical (Top 5), P1 = High (6-10), P2 = Medium (11+)', 20, finalY + 10);
}
