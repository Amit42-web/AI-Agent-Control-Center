'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const OPENAI_MODELS = [
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (Recommended)', description: 'Fast and cost-effective' },
  { value: 'gpt-5.2', label: 'GPT-5.2', description: 'Most advanced model' },
  { value: 'gpt-5', label: 'GPT-5', description: 'Advanced capabilities' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini', description: 'Balanced performance' },
  { value: 'gpt-4.1', label: 'GPT-4.1', description: 'Previous generation flagship' },
  { value: 'gpt-5-nano', label: 'GPT-5 Nano', description: 'Ultra-fast responses' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', description: 'Lightweight model' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Legacy model' },
];

export function OpenAIConfig() {
  const { openaiConfig, setOpenAIConfig } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-[var(--color-navy-700)] cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Model Configuration</h3>
            <p className="text-xs text-[var(--color-slate-400)]">
              Select GPT model for analysis
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-[var(--color-slate-400)]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[var(--color-slate-400)]" />
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <motion.div
          className="p-4 space-y-4"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
        >
          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm text-[var(--color-slate-300)]">AI Model</label>
            <select
              className="input-field"
              value={openaiConfig.model}
              onChange={(e) => setOpenAIConfig({ model: e.target.value })}
            >
              {OPENAI_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label} - {model.description}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--color-slate-400)]">
              Selected: {openaiConfig.model}
            </p>
          </div>

          {/* Info */}
          <div className="glass-card-subtle p-3 text-xs text-[var(--color-slate-400)]">
            <p>
              Analysis will use the selected model for issue detection, analytics, and fix
              suggestions. The OpenAI API key is securely configured in the backend environment.
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
