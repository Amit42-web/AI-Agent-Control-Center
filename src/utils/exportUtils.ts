import { Scenario } from '@/types';
import { AggregatedScenario } from './aggregateScenarios';

// Convert scenarios to CSV format
export function exportScenariosToCSV(scenarios: Scenario[]): string {
  const headers = [
    'Call ID',
    'Title',
    'Audit Dimension',
    'Root Cause Type',
    'Context',
    'What Happened',
    'Impact',
    'Severity',
    'Confidence (%)',
    'Line Numbers',
    'Instruction Reference'
  ];

  const rows = scenarios.map(scenario => [
    scenario.callId,
    scenario.title,
    scenario.dimension || '',
    scenario.rootCauseType || '',
    scenario.context,
    scenario.whatHappened,
    scenario.impact,
    scenario.severity,
    scenario.confidence.toString(),
    scenario.lineNumbers.join('; '),
    scenario.instructionReference ? `${scenario.instructionReference.section || ''} - ${scenario.instructionReference.expectedBehavior || ''}` : ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
}

// Convert aggregated scenarios to CSV format
export function exportAggregatedScenariosToCSV(aggregated: AggregatedScenario[]): string {
  const headers = [
    'Title',
    'Audit Dimension',
    'Root Cause Type',
    'Pattern',
    'Severity',
    'Average Confidence (%)',
    'Occurrences',
    'Unique Calls',
    'Affected Call IDs'
  ];

  const rows = aggregated.map(agg => [
    agg.title,
    agg.dimension,
    agg.rootCauseType || '',
    agg.pattern,
    agg.severity,
    agg.avgConfidence.toFixed(1),
    agg.occurrences.toString(),
    agg.uniqueCalls.toString(),
    agg.affectedCallIds.join('; ')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
}

// Download CSV file
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Convert scenarios to Excel-compatible format (TSV for better Excel compatibility)
export function exportScenariosToExcel(scenarios: Scenario[]): string {
  const headers = [
    'Call ID',
    'Title',
    'Audit Dimension',
    'Root Cause Type',
    'Context',
    'What Happened',
    'Impact',
    'Severity',
    'Confidence (%)',
    'Line Numbers',
    'Instruction Reference'
  ];

  const rows = scenarios.map(scenario => [
    scenario.callId,
    scenario.title,
    scenario.dimension || '',
    scenario.rootCauseType || '',
    scenario.context,
    scenario.whatHappened,
    scenario.impact,
    scenario.severity,
    scenario.confidence.toString(),
    scenario.lineNumbers.join('; '),
    scenario.instructionReference ? `${scenario.instructionReference.section || ''} - ${scenario.instructionReference.expectedBehavior || ''}` : ''
  ]);

  const tsvContent = [
    headers.join('\t'),
    ...rows.map(row => row.map(cell => String(cell).replace(/\t/g, ' ')).join('\t'))
  ].join('\n');

  return tsvContent;
}

// Convert aggregated scenarios to Excel-compatible format (TSV)
export function exportAggregatedScenariosToExcel(aggregated: AggregatedScenario[]): string {
  const headers = [
    'Title',
    'Audit Dimension',
    'Root Cause Type',
    'Pattern',
    'Severity',
    'Average Confidence (%)',
    'Occurrences',
    'Unique Calls',
    'Affected Call IDs'
  ];

  const rows = aggregated.map(agg => [
    agg.title,
    agg.dimension,
    agg.rootCauseType || '',
    agg.pattern,
    agg.severity,
    agg.avgConfidence.toFixed(1),
    agg.occurrences.toString(),
    agg.uniqueCalls.toString(),
    agg.affectedCallIds.join('; ')
  ]);

  const tsvContent = [
    headers.join('\t'),
    ...rows.map(row => row.map(cell => String(cell).replace(/\t/g, ' ')).join('\t'))
  ].join('\n');

  return tsvContent;
}

// Download Excel file (TSV that opens in Excel)
export function downloadExcel(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Generate filename with timestamp
export function generateExportFilename(prefix: string, extension: 'csv' | 'xls'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix}_${timestamp}.${extension}`;
}
