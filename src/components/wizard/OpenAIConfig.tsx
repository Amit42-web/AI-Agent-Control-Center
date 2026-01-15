'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)', description: 'Fast and cost-effective' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'More capable, higher cost' },
  { value: 'o1', label: 'O1', description: 'Advanced reasoning model' },
  { value: 'o1-mini', label: 'O1 Mini', description: 'Fast reasoning model' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Previous generation' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fastest, lowest cost' },
];

export function OpenAIConfig() {
  const { openaiConfig, setOpenAIConfig } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  // Check for environment variable API key
  const envApiKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_OPENAI_API_KEY || '' : '';
  const isConfigured = (openaiConfig.apiKey.trim().length > 0) || (envApiKey.length > 0);

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
            <Key className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">OpenAI Configuration</h3>
            <p className="text-xs text-[var(--color-slate-400)]">
              {isConfigured ? (
                <span className="text-green-400">✓ Configured</span>
              ) : (
                <span className="text-amber-400">⚠ API key required</span>
              )}
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
          {envApiKey ? (
            <div className="glass-card-subtle p-3 flex items-start gap-3 border border-green-500/20">
              <AlertCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-green-400 font-medium mb-1">API Key Configured</p>
                <p className="text-[var(--color-slate-400)]">
                  Using API key from environment variable (NEXT_PUBLIC_OPENAI_API_KEY)
                </p>
              </div>
            </div>
          ) : !isConfigured && (
            <div className="glass-card-subtle p-3 flex items-start gap-3 border border-amber-500/20">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-amber-400 font-medium mb-1">API Key Required</p>
                <p className="text-[var(--color-slate-400)]">
                  Please enter your OpenAI API key below or set NEXT_PUBLIC_OPENAI_API_KEY environment variable. Get your API key
                  from{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    OpenAI Dashboard
                  </a>
                  .
                </p>
              </div>
            </div>
          )}

          {/* API Key Input - Only show if not configured via environment */}
          {!envApiKey && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--color-slate-300)]">OpenAI API Key</label>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-xs text-[var(--color-slate-400)] hover:text-white transition-colors"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="input-field font-mono text-sm"
                value={openaiConfig.apiKey}
                onChange={(e) => setOpenAIConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
          )}

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm text-[var(--color-slate-300)]">Model</label>
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
            <p className="mb-2">
              <strong className="text-[var(--color-slate-300)]">Note:</strong> Your API key is
              stored locally in your browser and never sent to our servers. All OpenAI API calls are
              made directly from your browser.
            </p>
            <p>
              Analysis will use the selected model for issue detection, analytics, and fix
              suggestions.
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
