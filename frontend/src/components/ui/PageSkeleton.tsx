import { cn } from '../../lib/utils';

interface PageSkeletonProps {
  rows?: number;
  className?: string;
}

export default function PageSkeleton({ rows = 5, className }: PageSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-xl bg-slate-200/60 dark:bg-slate-700/40 animate-pulse" />
        <div className="h-10 w-32 rounded-xl bg-slate-200/60 dark:bg-slate-700/40 animate-pulse" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-64 rounded-xl bg-slate-200/60 dark:bg-slate-700/40 animate-pulse" />
        <div className="h-10 w-28 rounded-xl bg-slate-200/60 dark:bg-slate-700/40 animate-pulse" />
        <div className="h-10 w-28 rounded-xl bg-slate-200/60 dark:bg-slate-700/40 animate-pulse" />
      </div>

      {/* Card skeleton */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden">
        {/* Table header */}
        <div className="flex gap-4 px-6 py-4 border-b border-slate-100 dark:border-white/5">
          <div className="h-4 w-12 rounded bg-slate-200/60 dark:bg-slate-700/40 animate-pulse" />
          <div className="h-4 flex-1 rounded bg-slate-200/60 dark:bg-slate-700/40 animate-pulse" />
          <div className="h-4 w-24 rounded bg-slate-200/60 dark:bg-slate-700/40 animate-pulse" />
          <div className="h-4 w-20 rounded bg-slate-200/60 dark:bg-slate-700/40 animate-pulse" />
        </div>

        {/* Table rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-6 py-4 border-b border-slate-50 dark:border-white/5 last:border-0"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="h-4 w-12 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-4 flex-1 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-6 w-20 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-8 w-20 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
