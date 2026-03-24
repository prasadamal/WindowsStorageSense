/**
 * Loading skeleton shimmer components.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />
 *   <SkeletonCard />
 *   <SkeletonList rows={5} />
 */

import React from 'react';

export function Skeleton({ className = '' }) {
  return (
    <div
      className={`bg-slate-700/50 rounded animate-pulse ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-2.5 w-16" />
        </div>
        <Skeleton className="h-3.5 w-16" />
      </div>
      <Skeleton className="h-1.5 w-full" />
      <Skeleton className="h-2.5 w-12" />
    </div>
  );
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="w-5 h-5 rounded" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5" style={{ width: `${60 + (i % 3) * 15}%` }} />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}
