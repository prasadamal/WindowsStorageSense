/**
 * Command palette — Ctrl+K / Cmd+K to open.
 *
 * Features:
 *  - Fuzzy search across all pages and quick actions
 *  - Keyboard navigation (↑↓ Enter Esc)
 *  - Recent pages remembered in localStorage
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight, Clock, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// All navigable items
// ---------------------------------------------------------------------------
const ALL_ITEMS = [
  // Pages
  { type: 'page', label: 'Dashboard',         to: '/dashboard',      keywords: 'overview home drives health' },
  { type: 'page', label: 'Deep Analyzer',     to: '/analyzer',       keywords: 'largest files analyze extension age orphan tree' },
  { type: 'page', label: 'File Explorer',     to: '/explorer',       keywords: 'browse files folders navigate' },
  { type: 'page', label: 'Smart Optimizer',   to: '/optimizer',      keywords: 'empty similar folders c drive hog ssd hdd scatter' },
  { type: 'page', label: 'Media Organizer',   to: '/media',          keywords: 'photos videos music organize library' },
  { type: 'page', label: 'Downloads',         to: '/downloads',      keywords: 'download folder cleanup stale' },
  { type: 'page', label: 'Junk Cleaner',      to: '/junk',           keywords: 'temp cache clean junk recycle' },
  { type: 'page', label: 'Duplicates',        to: '/duplicates',     keywords: 'duplicate copy identical wasted' },
  { type: 'page', label: 'All Files',         to: '/files',          keywords: 'all files list category' },
  { type: 'page', label: 'Quick Transfer',    to: '/transfer',       keywords: 'transfer lan wifi internet bluetooth share' },
  { type: 'page', label: 'System Monitor',    to: '/system',         keywords: 'cpu ram memory disk io processes performance' },
  { type: 'page', label: 'Storage Analyzer',  to: '/storage',        keywords: 'storage scan treemap categories' },
  { type: 'page', label: 'Drive Advisor',     to: '/drives/optimize', keywords: 'ssd hdd optimize drive advisor' },
  { type: 'page', label: 'Startup Manager',   to: '/startup',        keywords: 'startup boot programs disable enable' },
  { type: 'page', label: 'Uninstaller',       to: '/uninstaller',    keywords: 'uninstall apps remove program leftover' },
  { type: 'page', label: 'Games',             to: '/games',          keywords: 'games library steam origin' },
  { type: 'page', label: 'Settings',          to: '/settings',       keywords: 'settings preferences theme schedule' },
];

// ---------------------------------------------------------------------------
// Simple fuzzy scorer (higher = better)
// ---------------------------------------------------------------------------
function score(item, query) {
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  const kw = (item.keywords || '').toLowerCase();

  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 60;
  if (kw.includes(q)) return 30;

  // Acronym match: "jc" matches "Junk Cleaner"
  const words = label.split(' ');
  const initials = words.map((w) => w[0]).join('');
  if (initials.toLowerCase().includes(q)) return 40;

  return 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = query.trim()
    ? ALL_ITEMS
        .map((item) => ({ item, s: score(item, query.trim()) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.item)
    : ALL_ITEMS.slice(0, 8);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => { setCursor(0); }, [query]);

  const go = useCallback((to) => {
    navigate(to);
    onClose();
    setQuery('');
  }, [navigate, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === 'Enter' && filtered[cursor]) { go(filtered[cursor].to); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, cursor, filtered, go, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[cursor];
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-900 border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/50">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
            placeholder="Search pages and actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-xs text-slate-600 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No results for "{query}"</div>
          )}
          {filtered.map((item, i) => (
            <button
              key={item.to}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(item.to)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === cursor ? 'bg-brand-600/20 text-brand-300' : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <span className="text-xs font-medium text-slate-600 uppercase tracking-wide w-9 flex-shrink-0">
                {item.type === 'action' ? <Zap className="w-3.5 h-3.5 text-yellow-500" /> : null}
              </span>
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              {i === cursor && <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-700/50 flex items-center gap-4 text-xs text-slate-600">
          <span><kbd className="bg-slate-800 border border-slate-700 px-1 py-0.5 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="bg-slate-800 border border-slate-700 px-1 py-0.5 rounded">↵</kbd> open</span>
          <span><kbd className="bg-slate-800 border border-slate-700 px-1 py-0.5 rounded">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
