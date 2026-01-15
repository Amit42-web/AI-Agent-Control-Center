'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ChevronDown, ChevronUp, RotateCcw, Save } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useSaveLoadTemplates } from '@/hooks/useSaveLoadTemplates';

export function KnowledgeBase() {
  const { knowledgeBase, knowledgeBaseEnabled, setKnowledgeBase, setKnowledgeBaseEnabled } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const { templates, saveTemplate, loadTemplate } = useSaveLoadTemplates('templates_knowledge_base');

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    try {
      await saveTemplate(templateName.trim(), knowledgeBase);
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
      setKnowledgeBase(content);
    }
  };

  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-[var(--color-navy-700)] cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Knowledge Base (Optional)</h3>
            <p className="text-xs text-[var(--color-slate-400)]">
              {knowledgeBaseEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`toggle-switch ${knowledgeBaseEnabled ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setKnowledgeBaseEnabled(!knowledgeBaseEnabled);
            }}
          />
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
          <div className="glass-card-subtle p-3 text-xs text-[var(--color-slate-400)]">
            <p>
              <strong className="text-[var(--color-slate-300)]">Optional:</strong> Add domain-specific
              knowledge, FAQs, policies, or guidelines that the bot should follow. This will be used
              alongside the reference script to check for compliance and suggest improvements.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-[var(--color-slate-300)]">
                Knowledge Base Content
              </label>
              <button
                onClick={() => setKnowledgeBase('')}
                className="flex items-center gap-1 text-xs text-[var(--color-slate-400)] hover:text-white transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
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
                  disabled={!knowledgeBaseEnabled}
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
                disabled={!knowledgeBaseEnabled}
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>

            {/* Save Dialog */}
            {showSaveDialog && knowledgeBaseEnabled && (
              <div className="glass-card-subtle p-3 space-y-2">
                <label className="text-xs text-[var(--color-slate-300)]">
                  Template Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Product FAQ"
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
              className={`textarea-field ${!knowledgeBaseEnabled ? 'opacity-50' : ''}`}
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              placeholder={`Example:

# Product Knowledge
- Product A costs $99/month
- Product B costs $199/month
- Free trial available for 14 days

# Company Policies
- Always verify customer identity before making account changes
- Offer alternatives before processing cancellations
- Escalate to supervisor for refunds over $500

# Common FAQs
Q: How do I reset my password?
A: Go to Settings > Security > Reset Password`}
              rows={12}
              disabled={!knowledgeBaseEnabled}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
