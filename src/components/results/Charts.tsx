'use client';

import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAppStore } from '@/store/useAppStore';
import { IssueType, Severity } from '@/types';

const issueTypeLabels: Record<IssueType, string> = {
  flow_deviation: 'Flow Deviation',
  repetition_loop: 'Repetition',
  language_mismatch: 'Language',
  mid_call_restart: 'Restart',
  quality_issue: 'Quality',
};

const severityColors: Record<Severity, string> = {
  critical: '#f43f5e',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
};

const issueColors: string[] = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#f43f5e'];

export function Charts() {
  const { results } = useAppStore();

  if (!results) return null;

  // Issue by type data
  const issuesByTypeData = Object.entries(results.issuesByType)
    .filter(([_, count]) => count > 0)
    .map(([type, count], index) => ({
      name: issueTypeLabels[type as IssueType],
      value: count,
      fill: issueColors[index % issueColors.length],
    }));

  // Severity distribution data
  const severityData = Object.entries(results.severityDistribution)
    .filter(([_, count]) => count > 0)
    .map(([severity, count]) => ({
      name: severity.charAt(0).toUpperCase() + severity.slice(1),
      value: count,
      fill: severityColors[severity as Severity],
    }));

  // Calls with issues pie data
  const callsData = [
    {
      name: 'With Issues',
      value: results.callsWithIssues,
      fill: '#f59e0b',
    },
    {
      name: 'Clean',
      value: results.totalCalls - results.callsWithIssues,
      fill: '#10b981',
    },
  ];

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 text-sm">
          <p className="text-white font-medium">{payload[0].name}</p>
          <p className="text-[var(--color-slate-400)]">{payload[0].value} issues</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Issues by Type */}
      <motion.div
        className="chart-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h3 className="text-white font-semibold mb-4">Issues by Type</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={issuesByTypeData} layout="vertical">
            <XAxis type="number" stroke="#94a3b8" fontSize={12} />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#94a3b8"
              fontSize={12}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {issuesByTypeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Severity Distribution */}
      <motion.div
        className="chart-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <h3 className="text-white font-semibold mb-4">Severity Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={severityData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {severityData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (
                <span className="text-[var(--color-slate-300)] text-sm">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Calls with Issues */}
      <motion.div
        className="chart-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <h3 className="text-white font-semibold mb-4">Calls Overview</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={callsData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {callsData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (
                <span className="text-[var(--color-slate-300)] text-sm">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Language Mismatch Rate */}
      <motion.div
        className="chart-container flex flex-col justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <h3 className="text-white font-semibold mb-4">Language Mismatch Rate</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl font-bold text-teal-400 mb-2">
              {results.languageMismatchRate.toFixed(1)}%
            </div>
            <p className="text-[var(--color-slate-400)]">
              of calls had language mismatch
            </p>
            <div className="mt-4 w-full bg-[var(--color-navy-700)] rounded-full h-3">
              <motion.div
                className="h-3 rounded-full bg-gradient-to-r from-teal-500 to-teal-400"
                initial={{ width: 0 }}
                animate={{ width: `${results.languageMismatchRate}%` }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
