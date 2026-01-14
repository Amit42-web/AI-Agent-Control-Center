'use client';

import { motion } from 'framer-motion';
import { Phone, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { IssueType } from '@/types';

const issueTypeLabels: Record<IssueType, string> = {
  flow_deviation: 'Flow Deviation',
  repetition_loop: 'Repetition Loop',
  language_mismatch: 'Language Mismatch',
  mid_call_restart: 'Mid-Call Restart',
  quality_issue: 'Quality Issue',
};

export function KPICards() {
  const { results } = useAppStore();

  if (!results) return null;

  // Find most common issue type
  const mostCommonType = Object.entries(results.issuesByType).reduce(
    (max, [type, count]) =>
      count > max.count ? { type: type as IssueType, count } : max,
    { type: 'flow_deviation' as IssueType, count: 0 }
  );

  // Calculate high severity rate
  const totalIssues = results.issues.length;
  const highSeverityCount =
    results.severityDistribution.high + results.severityDistribution.critical;
  const highSeverityRate =
    totalIssues > 0 ? (highSeverityCount / totalIssues) * 100 : 0;

  const cards = [
    {
      title: 'Total Calls Analyzed',
      value: results.totalCalls,
      icon: Phone,
      color: 'blue',
      suffix: '',
    },
    {
      title: 'Calls with Issues',
      value: results.callsWithIssues,
      icon: AlertTriangle,
      color: 'amber',
      suffix: ` (${((results.callsWithIssues / results.totalCalls) * 100).toFixed(0)}%)`,
    },
    {
      title: 'Most Common Issue',
      value: mostCommonType.count,
      label: issueTypeLabels[mostCommonType.type],
      icon: TrendingUp,
      color: 'purple',
      suffix: ' occurrences',
    },
    {
      title: 'High Severity Rate',
      value: highSeverityRate,
      icon: Zap,
      color: 'rose',
      suffix: '%',
      decimals: 1,
    },
  ];

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    blue: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
    },
    amber: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    },
    purple: {
      bg: 'bg-purple-500/20',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
    },
    rose: {
      bg: 'bg-rose-500/20',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const colors = colorClasses[card.color];
        return (
          <motion.div
            key={card.title}
            className={`glass-card p-5 hover-lift border ${colors.border}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}
              >
                <card.icon className={`w-5 h-5 ${colors.text}`} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[var(--color-slate-400)]">{card.title}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">
                  <AnimatedNumber
                    value={card.value}
                    decimals={card.decimals || 0}
                  />
                </span>
                {card.suffix && (
                  <span className="text-sm text-[var(--color-slate-400)]">
                    {card.suffix}
                  </span>
                )}
              </div>
              {card.label && (
                <p className={`text-xs ${colors.text}`}>{card.label}</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
