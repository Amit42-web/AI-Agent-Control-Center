'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FolderOpen,
  Trash2,
  Clock,
  Calendar,
  Sparkles,
  ArrowRight,
  Search,
  Filter,
  Target,
  Brain,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { SavedAnalysis, FlowType } from '@/types';

const STORAGE_KEY = 'voicebot-qa-storage-v1';

export function AnalysisManager() {
  const { createNewAnalysis, loadAnalysis } = useAppStore();
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewAnalysisModal, setShowNewAnalysisModal] = useState(false);
  const [newAnalysisName, setNewAnalysisName] = useState('');
  const [selectedFlowType, setSelectedFlowType] = useState<FlowType>('objective');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/analyses?storageKey=${STORAGE_KEY}`);
      if (response.ok) {
        const data = await response.json();
        setAnalyses(data);
      }
    } catch (error) {
      console.error('Error loading analyses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    if (!newAnalysisName.trim()) {
      alert('Please enter an analysis name');
      return;
    }
    createNewAnalysis(newAnalysisName.trim(), selectedFlowType);
    setShowNewAnalysisModal(false);
    setNewAnalysisName('');
    setSelectedFlowType('objective');
  };

  const handleLoadAnalysis = async (id: string) => {
    try {
      await loadAnalysis(id);
    } catch (error) {
      alert('Failed to load analysis');
    }
  };

  const handleDeleteAnalysis = async (id: string, name: string) => {
    if (!confirm(`Delete analysis "${name}"?`)) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/analyses?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAnalyses(analyses.filter((a) => a.id !== id));
      } else {
        alert('Failed to delete analysis');
      }
    } catch (error) {
      console.error('Error deleting analysis:', error);
      alert('Failed to delete analysis');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAnalyses = analyses.filter((analysis) =>
    analysis.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[var(--color-navy-900)] flex flex-col">
      {/* AI/ML themed animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Neural network nodes */}
        {[...Array(30)].map((_, i) => {
          const x = Math.random() * 100;
          const y = Math.random() * 100;
          return (
            <motion.div
              key={`node-${i}`}
              className="absolute w-2 h-2 bg-blue-400 rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                boxShadow: '0 0 10px rgba(96, 165, 250, 0.6)',
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
              }}
            />
          );
        })}

        {/* Connecting lines between nodes - neural network connections */}
        <svg className="absolute inset-0 w-full h-full">
          {[...Array(20)].map((_, i) => {
            const x1 = Math.random() * 100;
            const y1 = Math.random() * 100;
            const x2 = Math.random() * 100;
            const y2 = Math.random() * 100;
            return (
              <motion.line
                key={`line-${i}`}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke="rgba(96, 165, 250, 0.2)"
                strokeWidth="1"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: [0, 1, 0],
                  opacity: [0, 0.4, 0],
                }}
                transition={{
                  duration: 4 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 4,
                  ease: 'linear',
                }}
              />
            );
          })}
        </svg>

        {/* Data flow particles */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full"
            initial={{
              x: `${Math.random() * 100}%`,
              y: `${Math.random() * 100}%`,
            }}
            animate={{
              x: `${Math.random() * 100}%`,
              y: `${Math.random() * 100}%`,
            }}
            transition={{
              duration: 10 + Math.random() * 5,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              boxShadow: '0 0 8px rgba(34, 211, 238, 0.8)',
            }}
          />
        ))}

        {/* Circuit board lines */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`circuit-${i}`}
            className="absolute h-px bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-20"
            style={{
              width: '100%',
              top: `${10 + i * 12}%`,
            }}
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 8 + Math.random() * 4,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 0.5,
            }}
          />
        ))}

        {/* Pulsing gradient orbs - representing AI processing */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />

        {/* Shining stars illuminating */}
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              boxShadow: '0 0 4px 1px rgba(255, 255, 255, 0.8)',
            }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [0.5, 1.5, 0.5],
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-6xl flex-1">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-6xl font-bold text-white mb-2 tracking-tight">
            AI Agent Control Center
          </h1>
        </motion.div>

        {/* Search and Create Section */}
        <motion.div
          className="glass-card p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-slate-400)]" />
              <input
                type="text"
                placeholder="Search analyses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-white placeholder-[var(--color-slate-500)] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <motion.button
              className="btn-primary flex items-center gap-2 px-6 py-3"
              onClick={() => setShowNewAnalysisModal(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-5 h-5" />
              New Analysis
            </motion.button>
          </div>
        </motion.div>

        {/* Analyses Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-12 h-12 text-blue-400" />
            </motion.div>
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <motion.div
            className="glass-card p-12 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <FolderOpen className="w-16 h-16 text-[var(--color-slate-600)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery ? 'No analyses found' : 'No analyses yet'}
            </h3>
            <p className="text-[var(--color-slate-400)] mb-6">
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first analysis to get started'}
            </p>
            {!searchQuery && (
              <motion.button
                className="btn-primary inline-flex items-center gap-2"
                onClick={() => setShowNewAnalysisModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="w-5 h-5" />
                Create Analysis
              </motion.button>
            )}
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <AnimatePresence mode="popLayout">
              {filteredAnalyses.map((analysis, index) => (
                <motion.div
                  key={analysis.id}
                  className="glass-card p-6 hover:shadow-xl hover:shadow-blue-500/10 transition-all cursor-pointer group relative overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -4 }}
                  onClick={() => handleLoadAnalysis(analysis.id)}
                >
                  {/* Gradient overlay on hover */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"
                    layoutId={`gradient-${analysis.id}`}
                  />

                  <div className="relative z-10">
                    {/* Icon and Name */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center"
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                        >
                          <FolderOpen className="w-6 h-6 text-blue-400" />
                        </motion.div>
                        <div>
                          <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                            {analysis.name}
                          </h3>
                        </div>
                      </div>
                    </div>

                    {/* Analytics Stats */}
                    {analysis.stats && analysis.stats.totalCalls > 0 && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-[var(--color-navy-800)] rounded-lg p-3">
                          <div className="text-2xl font-bold text-blue-400">
                            {analysis.stats.totalCalls}
                          </div>
                          <div className="text-xs text-[var(--color-slate-400)] mt-1">
                            Total Calls
                          </div>
                        </div>
                        <div className="bg-[var(--color-navy-800)] rounded-lg p-3">
                          <div className="text-2xl font-bold text-cyan-400">
                            {analysis.stats.avgIssuesPerCall}
                          </div>
                          <div className="text-xs text-[var(--color-slate-400)] mt-1">
                            Avg Issues/Call
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-[var(--color-slate-400)]">
                        <Calendar className="w-4 h-4" />
                        <span>Created {formatDate(analysis.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--color-slate-400)]">
                        <Clock className="w-4 h-4" />
                        <span>Updated {formatDate(analysis.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-[var(--color-navy-700)]">
                      <motion.button
                        className="flex-1 btn-secondary flex items-center justify-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadAnalysis(analysis.id);
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <ArrowRight className="w-4 h-4" />
                        Open
                      </motion.button>
                      <motion.button
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAnalysis(analysis.id, analysis.name);
                        }}
                        disabled={deletingId === analysis.id}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2
                          className={`w-4 h-4 text-red-400 ${
                            deletingId === analysis.id ? 'animate-pulse' : ''
                          }`}
                        />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* New Analysis Modal */}
      <AnimatePresence>
        {showNewAnalysisModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowNewAnalysisModal(false)}
            />
            <motion.div
              className="glass-card max-w-2xl w-full p-6 relative z-10"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <h2 className="text-2xl font-bold text-white mb-2">
                Create New Analysis
              </h2>
              <p className="text-[var(--color-slate-400)] mb-6">
                Choose your analysis type and give it a descriptive name.
              </p>

              {/* Flow Type Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-white mb-3">
                  Analysis Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Objective Flow */}
                  <motion.button
                    type="button"
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedFlowType === 'objective'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[var(--color-navy-700)] bg-[var(--color-navy-800)] hover:border-blue-500/50'
                    }`}
                    onClick={() => setSelectedFlowType('objective')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        selectedFlowType === 'objective'
                          ? 'bg-blue-500/20'
                          : 'bg-[var(--color-navy-700)]'
                      }`}>
                        <Target className={`w-5 h-5 ${
                          selectedFlowType === 'objective'
                            ? 'text-blue-400'
                            : 'text-[var(--color-slate-400)]'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-semibold mb-1 ${
                          selectedFlowType === 'objective'
                            ? 'text-blue-400'
                            : 'text-white'
                        }`}>
                          Objective Analysis
                        </h3>
                        <p className="text-xs text-[var(--color-slate-400)] leading-relaxed">
                          Find specific issues and problems like flow deviations, repetitions, and language mismatches
                        </p>
                      </div>
                    </div>
                  </motion.button>

                  {/* Open-Ended Flow */}
                  <motion.button
                    type="button"
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedFlowType === 'open-ended'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-[var(--color-navy-700)] bg-[var(--color-navy-800)] hover:border-purple-500/50'
                    }`}
                    onClick={() => setSelectedFlowType('open-ended')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        selectedFlowType === 'open-ended'
                          ? 'bg-purple-500/20'
                          : 'bg-[var(--color-navy-700)]'
                      }`}>
                        <Brain className={`w-5 h-5 ${
                          selectedFlowType === 'open-ended'
                            ? 'text-purple-400'
                            : 'text-[var(--color-slate-400)]'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-semibold mb-1 ${
                          selectedFlowType === 'open-ended'
                            ? 'text-purple-400'
                            : 'text-white'
                        }`}>
                          Open-Ended Audit
                        </h3>
                        <p className="text-xs text-[var(--color-slate-400)] leading-relaxed">
                          Holistic evaluation with scenarios, root causes, and actionable implementation solutions
                        </p>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-white mb-2">
                  Analysis Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Q4 Customer Support Analysis"
                  value={newAnalysisName}
                  onChange={(e) => setNewAnalysisName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNew();
                    if (e.key === 'Escape') setShowNewAnalysisModal(false);
                  }}
                  className="w-full px-4 py-3 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-white placeholder-[var(--color-slate-500)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  className="flex-1 btn-primary"
                  onClick={handleCreateNew}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Create
                </motion.button>
                <motion.button
                  className="flex-1 btn-secondary"
                  onClick={() => {
                    setShowNewAnalysisModal(false);
                    setNewAnalysisName('');
                    setSelectedFlowType('objective');
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="relative z-10 mt-auto py-6 text-center">
        <p className="text-[var(--color-slate-400)] text-sm">
          Built by <span className="text-white font-semibold">Convin</span>
        </p>
      </footer>
    </div>
  );
}
