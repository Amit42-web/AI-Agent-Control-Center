'use client';

import { motion } from 'framer-motion';
import { RotateCcw, Zap } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export function Header() {
  const { currentStep, resetAllToDefaults } = useAppStore();

  const steps = [
    { id: 'input', label: 'Input', number: 1 },
    { id: 'running', label: 'Running', number: 2 },
    { id: 'results', label: 'Results', number: 3 },
    { id: 'fixes', label: 'Fixes', number: 4 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <header className="border-b border-[var(--color-navy-700)] bg-[var(--color-navy-800)]/50 backdrop-blur-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AI Agent Control Center</h1>
              <p className="text-xs text-[var(--color-slate-400)]">Voice Bot Testing & Analytics</p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <motion.div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    index === currentStepIndex
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : index < currentStepIndex
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-[var(--color-navy-700)] text-[var(--color-slate-400)]'
                  }`}
                  initial={false}
                  animate={{
                    scale: index === currentStepIndex ? 1.05 : 1,
                  }}
                >
                  <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                    {index < currentStepIndex ? '✓' : step.number}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </motion.div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${
                      index < currentStepIndex ? 'bg-green-500/50' : 'bg-[var(--color-navy-600)]'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Reset Button */}
          <button
            onClick={resetAllToDefaults}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All
          </button>
        </div>
      </div>
    </header>
  );
}
