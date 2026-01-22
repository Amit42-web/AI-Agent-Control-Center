'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { StepNavigator } from '@/components/ui/StepNavigator';
import { TranscriptInput } from '@/components/wizard/TranscriptInput';
import { ReferenceScript } from '@/components/wizard/ReferenceScript';
import { KnowledgeBase } from '@/components/wizard/KnowledgeBase';
import { ChecksConfig } from '@/components/wizard/ChecksConfig';
import { AuditPromptConfig } from '@/components/wizard/AuditPromptConfig';
import { OpenAIConfig } from '@/components/wizard/OpenAIConfig';
import { RunButton } from '@/components/wizard/RunButton';
import { KPICards } from '@/components/results/KPICards';
import { Charts } from '@/components/results/Charts';
import { IssueTable } from '@/components/results/IssueTable';
import { ScenarioTable } from '@/components/results/ScenarioTable';
import { CallViewer } from '@/components/results/CallViewer';
import { FixesPanel } from '@/components/fixes/FixesPanel';
import { EnhancedFixesList } from '@/components/fixes/EnhancedFixesList';
import { AnalysisManager } from '@/components/analyses/AnalysisManager';
import { AggregateResults } from '@/components/results/AggregateResults';
import { ArrowLeft, ArrowRight, Sparkles, List, LayoutGrid } from 'lucide-react';

function RunWizardPage() {
  const { flowType } = useAppStore();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -20 }}
    >
      <motion.div className="mb-8" variants={itemVariants}>
        <h2 className="text-2xl font-bold text-white mb-2">Run Analysis</h2>
        <p className="text-[var(--color-slate-400)]">
          {flowType === 'objective'
            ? 'Configure your transcript input, reference script, and checks to analyze voice bot calls.'
            : 'Configure your transcript input and comprehensive audit instructions for holistic evaluation.'}
        </p>
      </motion.div>

      <motion.div variants={itemVariants}><OpenAIConfig /></motion.div>
      <motion.div variants={itemVariants}><TranscriptInput /></motion.div>
      <motion.div variants={itemVariants}><ReferenceScript /></motion.div>
      <motion.div variants={itemVariants}><KnowledgeBase /></motion.div>
      {flowType === 'objective' ? (
        <motion.div variants={itemVariants}><ChecksConfig /></motion.div>
      ) : (
        <motion.div variants={itemVariants}><AuditPromptConfig /></motion.div>
      )}
      <motion.div variants={itemVariants}><RunButton /></motion.div>
    </motion.div>
  );
}

function RunningPage() {
  const { runProgress } = useAppStore();

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[60vh] relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* AI/ML themed floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Neural network nodes */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={`node-${i}`}
            className="absolute w-2 h-2 bg-blue-400 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              boxShadow: '0 0 10px rgba(96, 165, 250, 0.6)',
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}

        {/* Data packets flowing */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`packet-${i}`}
            className="absolute w-3 h-3 border-2 border-cyan-400 rounded"
            animate={{
              x: [0, Math.random() * 200 - 100],
              y: [0, Math.random() * 200 - 100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: 'linear',
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              boxShadow: '0 0 8px rgba(34, 211, 238, 0.6)',
            }}
          />
        ))}
      </div>

      <motion.div
        className="glass-card p-12 text-center max-w-md relative z-10"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 15 }}
      >
        {/* AI Brain / Neural Network Icon */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          {/* Center core */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 360],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>

          {/* Orbiting nodes */}
          {[0, 120, 240].map((angle, i) => (
            <motion.div
              key={`orbit-${i}`}
              className="absolute w-3 h-3 bg-cyan-400 rounded-full"
              style={{
                left: '50%',
                top: '50%',
                marginLeft: '-6px',
                marginTop: '-6px',
                boxShadow: '0 0 10px rgba(34, 211, 238, 0.8)',
              }}
              animate={{
                x: [
                  Math.cos((angle * Math.PI) / 180) * 35,
                  Math.cos(((angle + 360) * Math.PI) / 180) * 35,
                ],
                y: [
                  Math.sin((angle * Math.PI) / 180) * 35,
                  Math.sin(((angle + 360) * Math.PI) / 180) * 35,
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
        </div>

        <motion.h2
          className="text-2xl font-bold text-white mb-2"
          animate={{ opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          AI Processing...
        </motion.h2>
        <p className="text-[var(--color-slate-400)] mb-6">
          Analyzing transcripts with machine learning models
        </p>
        <div className="progress-bar mb-2">
          <motion.div
            className="progress-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${runProgress}%` }}
            transition={{ duration: 0.5 }}
            style={{
              background: 'linear-gradient(90deg, #3b82f6, #22d3ee, #3b82f6)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
        <motion.span
          className="text-sm text-[var(--color-slate-400)]"
          key={runProgress}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          {runProgress}%
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

function ResultsPage() {
  const { goToStep, generateFixes, isRunning, openaiConfig, setOpenAIConfig, flowType, resultsViewMode, setResultsViewMode } = useAppStore();

  const handleGenerateFixes = () => {
    generateFixes();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, x: -20 }}
    >
      <motion.div className="flex items-center justify-between" variants={itemVariants}>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Analysis Results</h2>
          <p className="text-[var(--color-slate-400)]">
            Review {flowType === 'objective' ? 'detected issues and analytics' : 'scenarios and insights'} from your voice bot calls.
          </p>
        </div>
        <div className="flex items-end gap-3">
          {/* View Mode Toggle */}
          <div className="flex flex-col">
            <label className="text-xs text-[var(--color-slate-400)] mb-1.5">View Mode</label>
            <div className="flex items-center gap-1 bg-[var(--color-navy-800)] p-1 rounded-lg border border-[var(--color-navy-700)]">
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  resultsViewMode === 'detailed'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-[var(--color-slate-400)] hover:text-white hover:bg-[var(--color-navy-700)]'
                }`}
                onClick={() => setResultsViewMode('detailed')}
              >
                <List className="w-4 h-4" />
                Detailed
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  resultsViewMode === 'overview'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-[var(--color-slate-400)] hover:text-white hover:bg-[var(--color-navy-700)]'
                }`}
                onClick={() => setResultsViewMode('overview')}
              >
                <LayoutGrid className="w-4 h-4" />
                Aggregated
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-[var(--color-slate-400)] mb-1.5">AI Model for Fixes</label>
            <select
              className="input-field text-sm py-2 px-3 min-w-[200px]"
              value={openaiConfig.model}
              onChange={(e) => setOpenAIConfig({ model: e.target.value })}
            >
              <option value="gpt-4.1-mini">GPT-4.1 Mini (Recommended)</option>
              <option value="gpt-5.2">GPT-5.2</option>
              <option value="gpt-5.1">GPT-5.1</option>
              <option value="gpt-5">GPT-5</option>
              <option value="gpt-5-mini">GPT-5 Mini</option>
              <option value="gpt-4.1">GPT-4.1</option>
              <option value="gpt-5-nano">GPT-5 Nano</option>
              <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
            </select>
          </div>
          <motion.button
            className="btn-secondary flex items-center gap-2"
            onClick={() => goToStep('input')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Input
          </motion.button>
          <motion.button
            className="btn-primary flex items-center gap-2"
            onClick={handleGenerateFixes}
            disabled={isRunning}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isRunning ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-4 h-4" />
                </motion.div>
                Generating Fixes...
              </>
            ) : (
              <>
                Next: Generate Fixes
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {flowType === 'objective' ? (
        // Objective Flow - show based on view mode
        <>
          {resultsViewMode === 'detailed' ? (
            <>
              <motion.div variants={itemVariants}><KPICards /></motion.div>
              <motion.div variants={itemVariants}><Charts /></motion.div>
              <motion.div variants={itemVariants}><IssueTable /></motion.div>
              <motion.div variants={itemVariants}><CallViewer /></motion.div>
            </>
          ) : (
            <>
              <motion.div variants={itemVariants}><AggregateResults /></motion.div>
              <motion.div variants={itemVariants}><CallViewer /></motion.div>
            </>
          )}
        </>
      ) : (
        // Open-ended Flow - show based on view mode
        <>
          {resultsViewMode === 'detailed' ? (
            <>
              <motion.div variants={itemVariants}><ScenarioTable /></motion.div>
              <motion.div variants={itemVariants}><CallViewer /></motion.div>
            </>
          ) : (
            <>
              <motion.div variants={itemVariants}><AggregateResults /></motion.div>
              <motion.div variants={itemVariants}><CallViewer /></motion.div>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}

function FixesPage() {
  const { goToStep, flowType } = useAppStore();

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', damping: 20 }}
    >
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.button
          className="btn-secondary flex items-center gap-2"
          onClick={() => goToStep('results')}
          whileHover={{ scale: 1.05, x: -5 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Results
        </motion.button>
        <motion.button
          className="btn-secondary flex items-center gap-2"
          onClick={() => goToStep('input')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Start New Run
        </motion.button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <FixesPanel />
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const { currentStep } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col">
      {currentStep !== 'analyses' && <Header />}

      <main className="flex-1 w-full">
        {currentStep !== 'running' && currentStep !== 'analyses' && (
          <div className="max-w-7xl mx-auto px-6 pt-8">
            <StepNavigator />
          </div>
        )}

        <div className={currentStep !== 'analyses' ? 'max-w-7xl mx-auto px-6 py-8' : ''}>
          <AnimatePresence mode="wait">
            {currentStep === 'analyses' && <AnalysisManager key="analyses" />}
            {currentStep === 'input' && <RunWizardPage key="input" />}
            {currentStep === 'running' && <RunningPage key="running" />}
            {currentStep === 'results' && <ResultsPage key="results" />}
            {currentStep === 'fixes' && <FixesPage key="fixes" />}
          </AnimatePresence>
        </div>
      </main>

      {currentStep !== 'analyses' && <Footer />}
    </div>
  );
}
