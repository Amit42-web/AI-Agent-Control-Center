import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EnhancedFix, FixType, RootCauseType } from '@/types';

interface FixesReportData {
  fixes: EnhancedFix[];
  analysisDate?: string;
  referenceScript?: string;
}

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

// ============= EXCEL EXPORT =============

export function generateFixesExcel(data: FixesReportData): void {
  const workbook = XLSX.utils.book_new();
  const timestamp = new Date().toISOString().split('T')[0];

  // Sheet 1: Executive Summary
  const summarySheet = generateFixesSummary(data);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Sheet 2: All Fixes Detailed
  const fixesSheet = generateDetailedFixes(data.fixes);
  XLSX.utils.book_append_sheet(workbook, fixesSheet, 'Detailed Fixes');

  // Sheet 3: Fixes by Root Cause
  const rcaSheet = generateFixesByRCA(data.fixes);
  XLSX.utils.book_append_sheet(workbook, rcaSheet, 'By Root Cause');

  // Sheet 4: Fixes by Type
  const typeSheet = generateFixesByType(data.fixes);
  XLSX.utils.book_append_sheet(workbook, typeSheet, 'By Fix Type');

  // Sheet 5: Implementation Plan
  const planSheet = generateImplementationPlan(data.fixes);
  XLSX.utils.book_append_sheet(workbook, planSheet, 'Implementation Plan');

  // Download
  XLSX.writeFile(workbook, `Fixes_Report_${timestamp}.xlsx`);
}

function generateFixesSummary(data: FixesReportData): XLSX.WorkSheet {
  const fixesByType: Record<string, number> = {};
  const fixesByRCA: Record<string, number> = {};

  data.fixes.forEach((fix) => {
    fixesByType[fix.fixType] = (fixesByType[fix.fixType] || 0) + 1;
    fixesByRCA[fix.rootCauseType] = (fixesByRCA[fix.rootCauseType] || 0) + 1;
  });

  const summaryData = [
    ['AI Agent Control Center - Fixes Report'],
    [''],
    ['Report Date', data.analysisDate || new Date().toLocaleString()],
    ['Total Fixes', data.fixes.length],
    [''],
    ['Fixes by Type'],
    ['Type', 'Count'],
    ...Object.entries(fixesByType).map(([type, count]) => [fixTypeLabels[type as FixType], count]),
    [''],
    ['Fixes by Root Cause'],
    ['Root Cause', 'Count'],
    ...Object.entries(fixesByRCA).map(([rca, count]) => [rootCauseLabels[rca as RootCauseType], count]),
  ];

  return XLSX.utils.aoa_to_sheet(summaryData);
}

function generateDetailedFixes(fixes: EnhancedFix[]): XLSX.WorkSheet {
  const headers = [
    '#',
    'Title',
    'Fix Type',
    'Root Cause Category',
    'Root Cause (Why)',
    'Suggested Solution (What)',
    'Where to Implement',
    'What to Implement',
    'Concrete Example',
    'Success Criteria',
    'How to Test',
    'Exact Content (Before)',
    'Exact Content (After)',
  ];

  const rows = fixes.map((fix, index) => [
    index + 1,
    fix.title,
    fixTypeLabels[fix.fixType],
    rootCauseLabels[fix.rootCauseType],
    fix.rootCause,
    fix.suggestedSolution,
    fix.whereToImplement,
    fix.whatToImplement,
    fix.concreteExample,
    fix.successCriteria,
    fix.howToTest,
    fix.promptFix?.beforeText || 'N/A',
    fix.promptFix?.exactContent || 'N/A',
  ]);

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

function generateFixesByRCA(fixes: EnhancedFix[]): XLSX.WorkSheet {
  const grouped = fixes.reduce((acc, fix) => {
    if (!acc[fix.rootCauseType]) acc[fix.rootCauseType] = [];
    acc[fix.rootCauseType].push(fix);
    return acc;
  }, {} as Record<string, EnhancedFix[]>);

  const data: any[][] = [['Root Cause Analysis - Fixes Grouped by Category'], ['']];

  Object.entries(grouped).forEach(([rca, rcaFixes]) => {
    data.push([rootCauseLabels[rca as RootCauseType], `${rcaFixes.length} fixes`]);
    data.push(['#', 'Title', 'Fix Type', 'Suggested Solution']);
    rcaFixes.forEach((fix, idx) => {
      data.push([idx + 1, fix.title, fixTypeLabels[fix.fixType], fix.suggestedSolution]);
    });
    data.push(['']);
  });

  return XLSX.utils.aoa_to_sheet(data);
}

function generateFixesByType(fixes: EnhancedFix[]): XLSX.WorkSheet {
  const grouped = fixes.reduce((acc, fix) => {
    if (!acc[fix.fixType]) acc[fix.fixType] = [];
    acc[fix.fixType].push(fix);
    return acc;
  }, {} as Record<string, EnhancedFix[]>);

  const data: any[][] = [['Fixes Grouped by Implementation Type'], ['']];

  Object.entries(grouped).forEach(([type, typeFixes]) => {
    data.push([fixTypeLabels[type as FixType], `${typeFixes.length} fixes`]);
    data.push(['#', 'Title', 'Root Cause', 'Where to Implement', 'What to Implement']);
    typeFixes.forEach((fix, idx) => {
      data.push([
        idx + 1,
        fix.title,
        rootCauseLabels[fix.rootCauseType],
        fix.whereToImplement,
        fix.whatToImplement,
      ]);
    });
    data.push(['']);
  });

  return XLSX.utils.aoa_to_sheet(data);
}

function generateImplementationPlan(fixes: EnhancedFix[]): XLSX.WorkSheet {
  const headers = [
    'Priority',
    'Fix Title',
    'Type',
    'Where',
    'Action Required',
    'Success Criteria',
    'Testing Method',
    'Status',
  ];

  // Sort by root cause priority: knowledge > instruction > execution > conversation > model
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

  const rows = sortedFixes.map((fix, index) => {
    const priority = index < 5 ? 'P0 (Critical)' : index < 10 ? 'P1 (High)' : 'P2 (Medium)';
    return [
      priority,
      fix.title,
      fixTypeLabels[fix.fixType],
      fix.whereToImplement,
      fix.whatToImplement,
      fix.successCriteria,
      fix.howToTest,
      'Pending',
    ];
  });

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

// ============= PDF EXPORT =============

export function generateFixesPDF(data: FixesReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;

  // Cover Page
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Fixes & Recommendations', pageWidth / 2, yPos, { align: 'center' });

  yPos += 15;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('AI Agent Control Center', pageWidth / 2, yPos, { align: 'center' });

  yPos += 30;
  doc.setFontSize(12);

  // Summary Box
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

  // Detailed Fixes Pages
  doc.addPage();
  addDetailedFixesToPDF(doc, data.fixes);

  // Implementation Plan
  doc.addPage();
  addImplementationPlanToPDF(doc, data.fixes);

  // Save
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

  // Sort by priority
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
