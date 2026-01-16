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
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { SavedAnalysis } from '@/types';

const STORAGE_KEY = 'voicebot-qa-storage-v1';

export function AnalysisManager() {
  const { createNewAnalysis, loadAnalysis } = useAppStore();
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewAnalysisModal, setShowNewAnalysisModal] = useState(false);
  const [newAnalysisName, setNewAnalysisName] = useState('');
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
    createNewAnalysis(newAnalysisName.trim());
    setShowNewAnalysisModal(false);
    setNewAnalysisName('');
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
    <div className="min-h-screen relative overflow-hidden bg-[var(--color-navy-900)]">
      {/* Space-themed animated background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Stars */}
        {[...Array(100)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}

        {/* Comets */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={`comet-${i}`}
            className="absolute"
            initial={{
              x: -100,
              y: Math.random() * 100,
            }}
            animate={{
              x: ['0%', '120%'],
              y: [
                `${Math.random() * 100}%`,
                `${Math.random() * 100}%`,
              ],
            }}
            transition={{
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              delay: i * 8,
              ease: 'linear',
            }}
          >
            <div className="relative">
              <div className="w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_10px_2px_rgba(96,165,250,0.8)]" />
              <motion.div
                className="absolute top-0 left-0 w-32 h-px bg-gradient-to-r from-blue-400 to-transparent"
                style={{ transformOrigin: 'left center' }}
              />
            </div>
          </motion.div>
        ))}

        {/* Planets/Nebula effects */}
        <motion.div
          className="absolute top-20 left-10 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/3 right-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
            x: [0, -30, 0],
            y: [0, 20, 0],
          }}
          transition={{ duration: 25, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-20 left-1/3 w-72 h-72 bg-pink-500/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.15, 0.35, 0.15],
            x: [0, 20, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 30, repeat: Infinity }}
        />

        {/* Meteor shower */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`meteor-${i}`}
            className="absolute w-px h-20 bg-gradient-to-b from-white to-transparent opacity-70"
            initial={{
              x: `${Math.random() * 100}%`,
              y: -100,
              rotate: 45,
            }}
            animate={{
              x: `${Math.random() * 100}%`,
              y: '120vh',
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 4 + Math.random() * 10,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-6xl font-bold text-white mb-2 tracking-tight">
            AI Agent Control Line
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
              className="glass-card max-w-md w-full p-6 relative z-10"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <h2 className="text-2xl font-bold text-white mb-4">
                Create New Analysis
              </h2>
              <p className="text-[var(--color-slate-400)] mb-6">
                Give your analysis a descriptive name to easily identify it later.
              </p>
              <input
                type="text"
                placeholder="e.g., Q4 Customer Support Analysis"
                value={newAnalysisName}
                onChange={(e) => setNewAnalysisName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNew();
                  if (e.key === 'Escape') setShowNewAnalysisModal(false);
                }}
                className="w-full px-4 py-3 bg-[var(--color-navy-800)] border border-[var(--color-navy-700)] rounded-lg text-white placeholder-[var(--color-slate-500)] focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
                autoFocus
              />
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
                  onClick={() => setShowNewAnalysisModal(false)}
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
    </div>
  );
}
