'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { generateComprehensiveExcel, generateComprehensivePDF } from '@/utils/comprehensiveExport';
import { AggregatedScenario } from '@/utils/aggregateScenarios';

interface ComprehensiveExportProps {
  aggregatedScenarios?: AggregatedScenario[];
}

export function ComprehensiveExport({ aggregatedScenarios }: ComprehensiveExportProps) {
  const {
    flowType,
    transcripts,
    results,
    fixes,
    scenarioResults,
    enhancedFixes,
    referenceScript,
  } = useAppStore();

  const [isExporting, setIsExporting] = useState(false);

  const handleExcelExport = async () => {
    setIsExporting(true);
    try {
      generateComprehensiveExcel({
        flowType,
        transcripts,
        results,
        fixes,
        scenarioResults,
        enhancedFixes,
        aggregatedScenarios,
        analysisDate: new Date().toLocaleString(),
        referenceScript,
      });
    } catch (error) {
      console.error('Excel export failed:', error);
      alert('Failed to export Excel report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePDFExport = async () => {
    setIsExporting(true);
    try {
      generateComprehensivePDF({
        flowType,
        transcripts,
        results,
        fixes,
        scenarioResults,
        enhancedFixes,
        aggregatedScenarios,
        analysisDate: new Date().toLocaleString(),
        referenceScript,
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const hasData =
    (flowType === 'open-ended' && scenarioResults && scenarioResults.scenarios.length > 0) ||
    (flowType === 'objective' && results && results.issues.length > 0);

  if (!hasData) {
    return null;
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Comprehensive Reports
          </h3>
          <p className="text-sm text-[var(--color-slate-400)] mt-1">
            Download detailed analysis with all metrics, findings, and recommendations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Excel Export */}
        <button
          onClick={handleExcelExport}
          disabled={isExporting}
          className="btn-primary flex items-center justify-center gap-3 p-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet className="w-5 h-5" />
          <div className="text-left flex-1">
            <div className="font-semibold">Excel Report (.xlsx)</div>
            <div className="text-xs opacity-80">
              Multiple sheets: Summary, Calls, Issues, Patterns, Fixes, Metrics
            </div>
          </div>
        </button>

        {/* PDF Export */}
        <button
          onClick={handlePDFExport}
          disabled={isExporting}
          className="btn-secondary flex items-center justify-center gap-3 p-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileText className="w-5 h-5" />
          <div className="text-left flex-1">
            <div className="font-semibold">PDF Report (.pdf)</div>
            <div className="text-xs opacity-80">
              Visual report with charts, tables, and key insights
            </div>
          </div>
        </button>
      </div>

      {isExporting && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 text-blue-400">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Generating report...</span>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-xs text-blue-300">
          <strong>What's included:</strong> Executive summary, call-level analysis, detailed issues/scenarios,
          aggregated patterns, fix recommendations, and comprehensive metrics dashboard.
        </p>
      </div>
    </div>
  );
}
