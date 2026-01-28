'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, RotateCcw, Edit3, Eye, EyeOff, Save, BookOpen, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { defaultAuditPrompt } from '@/data/defaultAuditPrompt';

interface SavedTemplate {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
}

export function AuditPromptConfig() {
  const { auditPrompt, setAuditPrompt } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);

  // Load saved templates from localStorage
  const loadTemplates = () => {
    try {
      const saved = localStorage.getItem('auditPromptTemplates');
      console.log('Loading templates from localStorage, raw data:', saved);

      if (saved) {
        const templates = JSON.parse(saved);
        console.log('✅ Successfully loaded templates:', templates);
        console.log('Template count:', Array.isArray(templates) ? templates.length : 0);
        setSavedTemplates(Array.isArray(templates) ? templates : []);
      } else {
        console.log('📭 No templates found in localStorage');
        setSavedTemplates([]);
      }
    } catch (e) {
      console.error('❌ Failed to load templates:', e);
      setSavedTemplates([]);
    }
  };

  useEffect(() => {
    loadTemplates();

    // Listen for storage changes (when templates are saved/deleted)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auditPromptTemplates') {
        console.log('Storage change detected for auditPromptTemplates');
        loadTemplates();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleReset = () => {
    if (confirm('Reset to default comprehensive audit prompt?')) {
      setAuditPrompt(defaultAuditPrompt);
    }
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    const newTemplate: SavedTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      prompt: auditPrompt,
      createdAt: new Date().toISOString()
    };

    const updated = [...savedTemplates, newTemplate];
    setSavedTemplates(updated);
    localStorage.setItem('auditPromptTemplates', JSON.stringify(updated));
    console.log('✅ Template saved successfully:', newTemplate.name);
    console.log('Total templates after save:', updated.length);
    setTemplateName('');
    setShowSaveModal(false);
    // Reload templates to ensure UI is in sync
    loadTemplates();
    alert(`Template "${newTemplate.name}" saved successfully!`);
  };

  const handleLoadTemplate = (template: SavedTemplate) => {
    if (confirm(`Load template "${template.name}"? Your current prompt will be replaced.`)) {
      setAuditPrompt(template.prompt);
      setShowLoadModal(false);
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    const template = savedTemplates.find(t => t.id === templateId);
    if (template && confirm(`Delete template "${template.name}"?`)) {
      const updated = savedTemplates.filter(t => t.id !== templateId);
      setSavedTemplates(updated);
      localStorage.setItem('auditPromptTemplates', JSON.stringify(updated));
    }
  };

  const handleRefreshTemplates = () => {
    const saved = localStorage.getItem('auditPromptTemplates');
    if (saved) {
      try {
        const templates = JSON.parse(saved);
        setSavedTemplates(templates);
        alert(`Refreshed! Found ${templates.length} template(s).`);
      } catch (e) {
        console.error('Failed to refresh templates:', e);
        alert('Failed to load templates. Check console for details.');
      }
    } else {
      setSavedTemplates([]);
      alert('No templates found in storage.');
    }
  };

  const isCustomized = auditPrompt !== defaultAuditPrompt;

  return (
    <motion.div
      className="glass-card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              Audit Instructions
            </h3>
            <p className="text-sm text-[var(--color-slate-400)]">
              Comprehensive evaluation criteria for open-ended analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCustomized && (
            <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Customized
            </span>
          )}
          <motion.button
            className="p-2 rounded-lg hover:bg-[var(--color-navy-700)] transition-colors"
            onClick={() => setShowFullPrompt(!showFullPrompt)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={showFullPrompt ? 'Hide full prompt' : 'Show full prompt'}
          >
            {showFullPrompt ? (
              <EyeOff className="w-4 h-4 text-[var(--color-slate-400)]" />
            ) : (
              <Eye className="w-4 h-4 text-[var(--color-slate-400)]" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Prompt Summary */}
      {!showFullPrompt && (
        <div className="bg-[var(--color-navy-800)] rounded-lg p-4 mb-4">
          <p className="text-sm text-[var(--color-slate-300)] mb-3">
            <span className="font-semibold text-purple-400">Primary Audit Dimensions (A-G):</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[var(--color-slate-400)]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
              <span><strong>A.</strong> Conversation Control & Flow</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
              <span><strong>B.</strong> Temporal Dynamics & Turn-Taking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
              <span><strong>C.</strong> Context Tracking & Intent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
              <span><strong>D.</strong> Language Quality & Human-Likeness</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
              <span><strong>E.</strong> Knowledge & Accuracy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-pink-400"></div>
              <span><strong>F.</strong> Process & Policy Adherence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
              <span><strong>G.</strong> Novel & Emerging Issues ✨</span>
            </div>
          </div>
          <p className="text-xs text-[var(--color-slate-500)] mt-3 italic">
            ✨ Category G enables adaptive discovery of new issue types not covered by A-F
          </p>
        </div>
      )}

      {/* Full Prompt Display/Edit */}
      <AnimatePresence>
        {showFullPrompt && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            {isEditing ? (
              <textarea
                value={auditPrompt}
                onChange={(e) => setAuditPrompt(e.target.value)}
                className="w-full h-96 px-4 py-3 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-sm text-[var(--color-slate-200)] font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                placeholder="Enter your custom audit instructions..."
              />
            ) : (
              <div className="bg-[var(--color-navy-800)] rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-xs text-[var(--color-slate-300)] whitespace-pre-wrap font-mono leading-relaxed">
                  {auditPrompt}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <motion.button
            className="btn-secondary text-sm flex items-center gap-2"
            onClick={() => {
              if (!isEditing) {
                // When enabling editing, automatically show the prompt
                setShowFullPrompt(true);
              }
              setIsEditing(!isEditing);
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Edit3 className="w-4 h-4" />
            {isEditing ? 'Done Editing' : 'Customize Prompt'}
          </motion.button>

          <motion.button
            className="btn-secondary text-sm flex items-center gap-2"
            onClick={() => setShowSaveModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Save className="w-4 h-4" />
            Save as Template
          </motion.button>

          <motion.button
            className={`btn-secondary text-sm flex items-center gap-2 ${
              savedTemplates.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={() => {
              console.log('Load Template button clicked. Current templates:', savedTemplates);
              console.log('savedTemplates.length:', savedTemplates.length);
              if (savedTemplates.length > 0) {
                loadTemplates(); // Refresh templates before opening modal
                setShowLoadModal(true);
              } else {
                console.warn('Button clicked but no templates found. Forcing reload...');
                loadTemplates();
              }
            }}
            whileHover={savedTemplates.length > 0 ? { scale: 1.02 } : {}}
            whileTap={savedTemplates.length > 0 ? { scale: 0.98 } : {}}
            disabled={savedTemplates.length === 0}
          >
            <BookOpen className="w-4 h-4" />
            Load Template {savedTemplates.length > 0 && `(${savedTemplates.length})`}
          </motion.button>

          <motion.button
            className="btn-secondary text-sm flex items-center gap-2"
            onClick={() => {
              console.log('Refreshing templates...');
              loadTemplates();
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title="Refresh template list"
          >
            <RefreshCw className="w-4 h-4" />
          </motion.button>

          {isCustomized && (
            <motion.button
              className="btn-secondary text-sm flex items-center gap-2"
              onClick={handleReset}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Default
            </motion.button>
          )}
        </div>

        <div className="text-xs text-[var(--color-slate-400)]">
          {auditPrompt.length} characters
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <p className="text-xs text-[var(--color-slate-300)] leading-relaxed">
          <span className="font-semibold text-purple-400">💡 Tip:</span>{' '}
          The default prompt covers comprehensive quality dimensions. You can customize it to:
          add domain-specific criteria, emphasize certain aspects, or save as a template for reuse.
        </p>
      </div>

      {/* Save Template Modal */}
      {showSaveModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSaveModal(false)}
          />
          <motion.div
            className="glass-card max-w-md w-full p-6 relative z-10"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            <h2 className="text-2xl font-bold text-white mb-4">
              Save Audit Prompt Template
            </h2>
            <p className="text-[var(--color-slate-400)] mb-6">
              Save your current audit prompt as a template for future use.
            </p>
            <input
              type="text"
              placeholder="e.g., 8-Pillar Quality Audit"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTemplate();
                if (e.key === 'Escape') setShowSaveModal(false);
              }}
              className="w-full px-4 py-3 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-white placeholder-[var(--color-slate-500)] focus:outline-none focus:ring-2 focus:ring-purple-500 mb-6"
              autoFocus
            />
            <div className="flex items-center gap-3">
              <motion.button
                className="flex-1 btn-primary flex items-center justify-center gap-2"
                onClick={handleSaveTemplate}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Save className="w-4 h-4" />
                Save Template
              </motion.button>
              <motion.button
                className="flex-1 btn-secondary"
                onClick={() => setShowSaveModal(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Load Template Modal */}
      {showLoadModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowLoadModal(false)}
          />
          <motion.div
            className="glass-card max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col relative z-10"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            <div className="p-6 border-b border-[var(--color-navy-700)]">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Load Audit Prompt Template
                  </h2>
                  <p className="text-[var(--color-slate-400)]">
                    Select a saved template to load. Your current prompt will be replaced.
                  </p>
                </div>
                <motion.button
                  className="btn-secondary text-sm flex items-center gap-2 flex-shrink-0"
                  onClick={handleRefreshTemplates}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  title="Refresh template list"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </motion.button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {savedTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-[var(--color-slate-600)] mx-auto mb-4" />
                  <p className="text-[var(--color-slate-400)] mb-2">No saved templates found</p>
                  <p className="text-xs text-[var(--color-slate-500)]">
                    Save your current audit prompt as a template to see it here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedTemplates.map(template => (
                    <div
                      key={template.id}
                      className="glass-card p-4 hover:bg-[var(--color-navy-700)] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-white font-semibold mb-1">
                            {template.name}
                          </h3>
                          <p className="text-xs text-[var(--color-slate-400)]">
                            Saved on {new Date(template.createdAt).toLocaleString()}
                          </p>
                          <p className="text-xs text-[var(--color-slate-500)] mt-1">
                            {template.prompt.length} characters
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.button
                            className="btn-primary text-sm px-3 py-1.5"
                            onClick={() => handleLoadTemplate(template)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Load
                          </motion.button>
                          <motion.button
                            className="btn-secondary text-sm px-3 py-1.5 text-red-400"
                            onClick={() => handleDeleteTemplate(template.id)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Delete
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-[var(--color-navy-700)]">
              <motion.button
                className="btn-secondary w-full"
                onClick={() => setShowLoadModal(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
