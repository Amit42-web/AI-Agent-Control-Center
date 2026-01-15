'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle,
  Lock,
  Save,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { CheckType } from '@/types';
import { useSaveLoadTemplates } from '@/hooks/useSaveLoadTemplates';

const checkIcons: Record<CheckType, string> = {
  flow_compliance: '📋',
  repetition: '🔄',
  language_alignment: '🌐',
  restart_reset: '🔃',
  general_quality: '✨',
};

// Helper component for individual check save/load
function CheckInstructionsSaveLoad({
  checkId,
  instructions,
  onLoad,
}: {
  checkId: CheckType;
  instructions: string;
  onLoad: (content: string) => void;
}) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const { templates, saveTemplate, loadTemplate } = useSaveLoadTemplates(
    `templates_check_${checkId}`
  );

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    try {
      await saveTemplate(templateName.trim(), instructions);
      setTemplateName('');
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please try again.');
    }
  };

  const handleLoad = (templateId: string) => {
    if (!templateId) return;
    const content = loadTemplate(templateId);
    if (content) {
      onLoad(content);
    }
  };

  return (
    <div className="space-y-2">
      {/* Save/Load Controls */}
      <div className="flex items-center gap-2">
        {/* Load Template Dropdown */}
        <div className="flex-1">
          <select
            className="w-full px-2 py-1.5 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            onChange={(e) => handleLoad(e.target.value)}
            value=""
          >
            <option value="">Load saved template...</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {/* Save Button */}
        <button
          onClick={() => setShowSaveDialog(!showSaveDialog)}
          className="btn-primary flex items-center gap-1 text-xs py-1.5 px-3 whitespace-nowrap"
        >
          <Save className="w-3 h-3" />
          Save
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="glass-card-subtle p-2 space-y-2">
          <label className="text-xs text-[var(--color-slate-300)]">
            Template Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-2 py-1.5 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., Strict Flow Check"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button onClick={handleSave} className="btn-primary text-xs py-1.5 px-3">
              Save
            </button>
            <button
              onClick={() => {
                setShowSaveDialog(false);
                setTemplateName('');
              }}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChecksConfig() {
  const {
    checks,
    referenceEnabled,
    toggleCheck,
    updateCheckInstructions,
    resetCheckInstructions,
  } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedCheck, setExpandedCheck] = useState<CheckType | null>(null);

  const enabledCount = checks.filter((c) => c.enabled).length;

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-[var(--color-navy-700)] cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
            <Settings className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Checks Configuration</h3>
            <p className="text-xs text-[var(--color-slate-400)]">
              {enabledCount} of {checks.length} checks enabled
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
          className="p-4 space-y-3"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
        >
          {checks.map((check) => {
            const isLocked = check.requiresReference && !referenceEnabled;
            const isCheckExpanded = expandedCheck === check.id;

            return (
              <motion.div
                key={check.id}
                className={`glass-card-subtle overflow-hidden ${
                  isLocked ? 'opacity-50' : ''
                }`}
                layout
              >
                {/* Check Header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xl">{checkIcons[check.id]}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-white text-sm">
                          {check.name}
                        </h4>
                        {isLocked && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 rounded text-xs text-amber-400">
                            <Lock className="w-3 h-3" />
                            <span>Requires Reference</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-slate-400)] mt-0.5">
                        {check.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Expand/Collapse Instructions */}
                    <button
                      className="p-2 hover:bg-[var(--color-navy-700)] rounded-lg transition-colors"
                      onClick={() =>
                        setExpandedCheck(isCheckExpanded ? null : check.id)
                      }
                      disabled={isLocked}
                    >
                      {isCheckExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[var(--color-slate-400)]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--color-slate-400)]" />
                      )}
                    </button>

                    {/* Toggle */}
                    <button
                      className={`toggle-switch ${
                        check.enabled && !isLocked ? 'active' : ''
                      }`}
                      onClick={() => !isLocked && toggleCheck(check.id)}
                      disabled={isLocked}
                    />
                  </div>
                </div>

                {/* Expanded Instructions */}
                <AnimatePresence>
                  {isCheckExpanded && !isLocked && (
                    <motion.div
                      className="px-4 pb-4 space-y-3"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-[var(--color-slate-300)]">
                          Check Instructions
                        </label>
                        <button
                          onClick={() => resetCheckInstructions(check.id)}
                          className="flex items-center gap-1 text-xs text-[var(--color-slate-400)] hover:text-white transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset to Default
                        </button>
                      </div>

                      {/* Save/Load Controls */}
                      <CheckInstructionsSaveLoad
                        checkId={check.id}
                        instructions={check.instructions}
                        onLoad={(content) =>
                          updateCheckInstructions(check.id, content)
                        }
                      />

                      <textarea
                        className="textarea-field text-sm"
                        value={check.instructions}
                        onChange={(e) =>
                          updateCheckInstructions(check.id, e.target.value)
                        }
                        rows={3}
                      />
                      {check.instructions !== check.defaultInstructions && (
                        <div className="flex items-center gap-2 text-xs text-amber-400">
                          <AlertCircle className="w-3 h-3" />
                          <span>Custom instructions (modified from default)</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
