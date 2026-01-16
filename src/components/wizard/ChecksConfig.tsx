'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle,
  Lock,
  Save,
  Star,
  Edit2,
  Check,
  X,
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
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [currentTemplateName, setCurrentTemplateName] = useState<string | null>(null);
  const { templates, saveTemplate, loadTemplate, setDefaultTemplate, getDefaultTemplate, isLoading } = useSaveLoadTemplates(
    `templates_check_${checkId}`
  );

  // Auto-load default template on mount (only once)
  const hasAutoLoaded = useRef(false);
  useEffect(() => {
    if (!isLoading && templates.length > 0 && !hasAutoLoaded.current) {
      const defaultTemplate = getDefaultTemplate();
      if (defaultTemplate) {
        onLoad(defaultTemplate.content);
        setCurrentTemplateName(defaultTemplate.name);
        hasAutoLoaded.current = true;
      }
    }
  }, [isLoading, templates, getDefaultTemplate, onLoad]);

  // Close template menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showTemplateMenu && !target.closest('.template-menu-container')) {
        setShowTemplateMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTemplateMenu]);

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
    const template = templates.find(t => t.id === templateId);
    const content = loadTemplate(templateId);
    if (content && template) {
      onLoad(content);
      setCurrentTemplateName(template.name);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      await setDefaultTemplate(templateId);
    } catch (error) {
      console.error('Error setting default template:', error);
      alert('Failed to set default template. Please try again.');
    }
  };

  return (
    <div className="space-y-2">
      {/* Save/Load Controls */}
      <div className="flex items-center gap-2">
        {/* Load Template Dropdown */}
        <div className="flex-1 relative template-menu-container">
          <button
            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
            className="w-full px-2 py-1.5 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-left flex items-center justify-between"
          >
            <span className={currentTemplateName ? 'text-white' : 'text-[var(--color-slate-400)]'}>
              {currentTemplateName || 'Load saved template...'}
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Custom Template Menu */}
          {showTemplateMenu && templates.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-[var(--color-navy-700)] cursor-pointer group"
                >
                  <span
                    className="flex-1 text-xs text-white"
                    onClick={() => {
                      handleLoad(template.id);
                      setShowTemplateMenu(false);
                    }}
                  >
                    {template.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetDefault(template.id);
                    }}
                    className="ml-2 p-1 hover:bg-[var(--color-navy-600)] rounded"
                    title={template.isDefault ? "Default template" : "Set as default"}
                  >
                    <Star
                      className={`w-3 h-3 ${
                        template.isDefault
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-400 group-hover:text-yellow-400'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
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
    updateCheckName,
    resetCheckInstructions,
  } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedCheck, setExpandedCheck] = useState<CheckType | null>(null);
  const [editingCheckId, setEditingCheckId] = useState<CheckType | null>(null);
  const [editedName, setEditedName] = useState('');

  const enabledCount = checks.filter((c) => c.enabled).length;

  const startEditingName = (checkId: CheckType, currentName: string) => {
    setEditingCheckId(checkId);
    setEditedName(currentName);
  };

  const saveEditedName = (checkId: CheckType) => {
    if (editedName.trim()) {
      updateCheckName(checkId, editedName.trim());
    }
    setEditingCheckId(null);
    setEditedName('');
  };

  const cancelEditingName = () => {
    setEditingCheckId(null);
    setEditedName('');
  };

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
                <div className="flex items-center justify-between p-4 group">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xl">{checkIcons[check.id]}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {editingCheckId === check.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editedName}
                              onChange={(e) => setEditedName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditedName(check.id);
                                if (e.key === 'Escape') cancelEditingName();
                              }}
                              className="flex-1 px-2 py-1 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={() => saveEditedName(check.id)}
                              className="p-1 hover:bg-[var(--color-navy-700)] rounded"
                            >
                              <Check className="w-4 h-4 text-green-400" />
                            </button>
                            <button
                              onClick={cancelEditingName}
                              className="p-1 hover:bg-[var(--color-navy-700)] rounded"
                            >
                              <X className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-medium text-white text-sm">
                              {check.name}
                            </h4>
                            <button
                              onClick={() => startEditingName(check.id, check.name)}
                              className="p-1 hover:bg-[var(--color-navy-700)] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Edit check name"
                            >
                              <Edit2 className="w-3 h-3 text-[var(--color-slate-400)]" />
                            </button>
                          </>
                        )}
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
