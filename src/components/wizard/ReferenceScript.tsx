'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, RotateCcw, ChevronDown, ChevronUp, SkipForward, Save, Upload } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { defaultReferenceScript } from '@/data/demoData';
import { useSaveLoadTemplates } from '@/hooks/useSaveLoadTemplates';

export function ReferenceScript() {
  const {
    referenceScript,
    referenceEnabled,
    setReferenceScript,
    setReferenceEnabled,
  } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const { templates, saveTemplate, loadTemplate } = useSaveLoadTemplates('templates_reference_script');

  const resetToDefault = () => {
    setReferenceScript(defaultReferenceScript);
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    try {
      await saveTemplate(templateName.trim(), referenceScript);
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
      setReferenceScript(content);
    }
  };

  return (
    <motion.div
      className={`glass-card overflow-hidden transition-opacity ${
        !referenceEnabled ? 'opacity-60' : ''
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-[var(--color-navy-700)] cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Reference Script</h3>
            <p className="text-xs text-[var(--color-slate-400)]">
              {referenceEnabled ? 'Enabled' : 'Skipped'} - Optional
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Enable/Skip Toggle */}
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-[var(--color-slate-400)]">
              {referenceEnabled ? 'Enabled' : 'Skipped'}
            </span>
            <button
              className={`toggle-switch ${referenceEnabled ? 'active' : ''}`}
              onClick={() => setReferenceEnabled(!referenceEnabled)}
            />
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[var(--color-slate-400)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--color-slate-400)]" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <motion.div
          className="p-4 space-y-4"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
        >
          {!referenceEnabled ? (
            <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <SkipForward className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm text-amber-300">Reference Script Skipped</p>
                <p className="text-xs text-[var(--color-slate-400)]">
                  Flow Compliance check will be automatically disabled
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--color-slate-300)]">
                  Expected conversation flow / script
                </label>
                <button
                  onClick={resetToDefault}
                  className="btn-secondary flex items-center gap-2 text-sm py-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>

              {/* Save/Load Controls */}
              <div className="flex items-center gap-2">
                {/* Load Template Dropdown */}
                <div className="flex-1">
                  <select
                    className="w-full px-3 py-2 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="btn-primary flex items-center gap-2 text-sm py-2 whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>

              {/* Save Dialog */}
              {showSaveDialog && (
                <div className="glass-card-subtle p-3 space-y-2">
                  <label className="text-xs text-[var(--color-slate-300)]">
                    Template Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Customer Support Flow"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    />
                    <button
                      onClick={handleSave}
                      className="btn-primary text-sm py-2"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowSaveDialog(false);
                        setTemplateName('');
                      }}
                      className="btn-secondary text-sm py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <textarea
                className="textarea-field"
                value={referenceScript}
                onChange={(e) => setReferenceScript(e.target.value)}
                placeholder="Enter your expected call flow or script..."
                rows={10}
              />
              <p className="text-xs text-[var(--color-slate-400)]">
                This script defines the expected flow for Flow Compliance checking.
                Use markdown format with numbered steps.
              </p>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
