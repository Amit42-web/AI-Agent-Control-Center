'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { Check, FileText, BarChart3, Wrench, FolderOpen, Save } from 'lucide-react';

const steps = [
  { id: 'input', label: 'Configure', icon: FileText },
  { id: 'results', label: 'Results', icon: BarChart3 },
  { id: 'fixes', label: 'Fixes', icon: Wrench },
] as const;

export function StepNavigator() {
  const { currentStep, goToStep, results, fixes, saveAnalysis, currentAnalysisName } = useAppStore();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState(currentAnalysisName || '');
  const [isSaving, setIsSaving] = useState(false);

  const getStepStatus = (stepId: typeof steps[number]['id']) => {
    if (stepId === 'input') return 'accessible';
    if (stepId === 'results') return results ? 'accessible' : 'locked';
    if (stepId === 'fixes') return fixes ? 'accessible' : 'locked';
    return 'locked';
  };

  const handleStepClick = (stepId: typeof steps[number]['id']) => {
    const status = getStepStatus(stepId);
    if (status === 'accessible' && currentStep !== 'running') {
      goToStep(stepId);
    }
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      alert('Please enter a name for this analysis');
      return;
    }

    setIsSaving(true);
    try {
      await saveAnalysis(saveName.trim());
      setShowSaveModal(false);
      alert(`Analysis "${saveName.trim()}" saved successfully!`);
    } catch (error) {
      alert('Failed to save analysis');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <motion.button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={() => goToStep('analyses')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FolderOpen className="w-4 h-4" />
            Back to Analyses
          </motion.button>

          <motion.button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={() => {
              setSaveName(currentAnalysisName || '');
              setShowSaveModal(true);
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Save className="w-4 h-4" />
            Save Analysis
          </motion.button>
        </div>

        <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const status = getStepStatus(step.id);
          const isActive = currentStep === step.id;
          const isAccessible = status === 'accessible';
          const isCompleted =
            (step.id === 'input' && results) ||
            (step.id === 'results' && fixes);

          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => handleStepClick(step.id)}
                disabled={!isAccessible || currentStep === 'running'}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-500/20 text-blue-400'
                    : isAccessible
                    ? 'hover:bg-[var(--color-navy-700)] text-[var(--color-slate-300)] cursor-pointer'
                    : 'text-[var(--color-slate-600)] cursor-not-allowed'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted
                      ? 'bg-green-500/20 text-green-400'
                      : isActive
                      ? 'bg-blue-500/20 text-blue-400'
                      : isAccessible
                      ? 'bg-[var(--color-navy-700)] text-[var(--color-slate-400)]'
                      : 'bg-[var(--color-navy-800)] text-[var(--color-slate-600)]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xs opacity-70">
                    {step.id === 'input' && 'Setup analysis'}
                    {step.id === 'results' && 'View insights'}
                    {step.id === 'fixes' && 'Get solutions'}
                  </p>
                </div>
              </button>

              {index < steps.length - 1 && (
                <div className={`flex-1 h-px mx-4 ${
                  getStepStatus(steps[index + 1].id) === 'accessible'
                    ? 'bg-blue-500/30'
                    : 'bg-[var(--color-navy-700)]'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>

    {/* Save Modal */}
    {showSaveModal && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => !isSaving && setShowSaveModal(false)}
        />
        <motion.div
          className="glass-card max-w-md w-full p-6 relative z-10"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          <h2 className="text-2xl font-bold text-white mb-4">
            Save Analysis
          </h2>
          <p className="text-[var(--color-slate-400)] mb-6">
            {currentAnalysisName
              ? 'Update the name or keep the current one.'
              : 'Give your analysis a name to save it.'}
          </p>
          <input
            type="text"
            placeholder="e.g., Q4 Customer Support Analysis"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSaving) handleSave();
              if (e.key === 'Escape' && !isSaving) setShowSaveModal(false);
            }}
            disabled={isSaving}
            className="w-full px-4 py-3 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-white placeholder-[var(--color-slate-500)] focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6 disabled:opacity-50"
            autoFocus
          />
          <div className="flex items-center gap-3">
            <motion.button
              className="flex-1 btn-primary flex items-center justify-center gap-2"
              onClick={handleSave}
              disabled={isSaving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSaving ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Save className="w-4 h-4" />
                  </motion.div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </motion.button>
            <motion.button
              className="flex-1 btn-secondary"
              onClick={() => setShowSaveModal(false)}
              disabled={isSaving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Cancel
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </>
  );
}
