/**
 * Utility: format bytes into human-readable string.
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format a date string or timestamp to a relative age ("2 months ago").
 */
export function formatRelativeDate(dateStr) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays < 1) return 'Today';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

/**
 * Get a colour class for a given percentage (used in progress bars).
 */
export function usageColour(pct) {
  if (pct > 90) return 'bg-red-500';
  if (pct > 70) return 'bg-yellow-500';
  return 'bg-brand-500';
}

/**
 * Category colour map.
 */
export const CATEGORY_COLORS = {
  Movies: '#6366f1',
  Documents: '#3b82f6',
  Images: '#ec4899',
  Music: '#8b5cf6',
  Downloads: '#f59e0b',
  Games: '#10b981',
  Applications: '#ef4444',
  Archives: '#f97316',
  Other: '#64748b',
};

export const CATEGORY_ICONS = {
  Movies: '🎬',
  Documents: '📄',
  Images: '🖼️',
  Music: '🎵',
  Downloads: '⬇️',
  Games: '🎮',
  Applications: '⚙️',
  Archives: '📦',
  Other: '📁',
};
