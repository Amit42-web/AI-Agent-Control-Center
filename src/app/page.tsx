'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { TranscriptInput } from '@/components/wizard/TranscriptInput';
import { ReferenceScript } from '@/components/wizard/ReferenceScript';
import { KnowledgeBase } from '@/components/wizard/KnowledgeBase';
import { ChecksConfig } from '@/components/wizard/ChecksConfig';
import { OpenAIConfig } from '@/components/wizard/OpenAIConfig';
import { RunButton } from '@/components/wizard/RunButton';
import { KPICards } from '@/components/results/KPICards';
import { Charts } from '@/components/results/Charts';
import { IssueTable } from '@/components/results/IssueTable';
import { CallViewer } from '@/components/results/CallViewer';
import { FixesPanel } from '@/components/fixes/FixesPanel';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';

function RunWizardPage() {

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Run Analysis</h2>
        <p className="text-[var(--color-slate-400)]">
          Configure your transcript input, reference script, and checks to analyze voice bot calls.
        </p>
      </div>

      <OpenAIConfig />
      <TranscriptInput />
      <ReferenceScript />
      <KnowledgeBase />
      <ChecksConfig />
      <RunButton />
    </motion.div>
  );
}

function RunningPage() {
  const { runProgress } = useAppStore();

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[60vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="glass-card p-12 text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6 animate-pulse">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Analyzing Calls...</h2>
        <p className="text-[var(--color-slate-400)] mb-6">
          Running all enabled checks on your transcripts
        </p>
        <div className="progress-bar mb-2">
          <motion.div
            className="progress-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${runProgress}%` }}
          />
        </div>
        <span className="text-sm text-[var(--color-slate-400)]">{runProgress}%</span>
      </div>
    </motion.div>
  );
}

function ResultsPage() {
  const { goToStep, generateFixes, isRunning } = useAppStore();

  const handleGenerateFixes = () => {
    generateFixes();
  };

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Analysis Results</h2>
          <p className="text-[var(--color-slate-400)]">
            Review detected issues and analytics from your voice bot calls.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => goToStep('input')}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Input
          </button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleGenerateFixes}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Sparkles className="w-4 h-4 animate-pulse" />
                Generating Fixes...
              </>
            ) : (
              <>
                Next: Generate Fixes
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      <KPICards />
      <Charts />
      <IssueTable />
      <CallViewer />
    </motion.div>
  );
}

function FixesPage() {
  const { goToStep } = useAppStore();

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Fix Suggestions</h2>
          <p className="text-[var(--color-slate-400)]">
            Actionable fixes based on the detected issues in your calls.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => goToStep('results')}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Results
          </button>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => goToStep('input')}
          >
            Start New Run
          </button>
        </div>
      </div>

      <FixesPanel />
    </motion.div>
  );
}

export default function Home() {
  const { currentStep } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <AnimatePresence mode="wait">
          {currentStep === 'input' && <RunWizardPage key="input" />}
          {currentStep === 'running' && <RunningPage key="running" />}
          {currentStep === 'results' && <ResultsPage key="results" />}
          {currentStep === 'fixes' && <FixesPage key="fixes" />}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
