'use client';

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

// Predefined widths to avoid Math.random during render
const SKELETON_WIDTHS = [85, 95, 75, 90, 80, 88, 92, 78, 83, 87];

export function LoadingSkeleton({ className = '', lines = 1 }: LoadingSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4"
          style={{ width: `${SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}%` }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="skeleton h-6 w-1/3" />
      <div className="skeleton h-10 w-1/2" />
      <div className="skeleton h-4 w-2/3" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="chart-container">
      <div className="skeleton h-6 w-1/4 mb-4" />
      <div className="skeleton h-48 w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="skeleton h-12 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b border-[var(--color-navy-700)]">
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}
