import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  FolderOpen, File, ChevronRight, ArrowLeft, Home, Search,
  Plus, Trash2, Copy, Scissors, Clipboard, RefreshCw,
  MoreHorizontal, Edit2, ExternalLink, Grid, List, X,
  Music, Film, Image, FileText, Archive, Code, Cpu,
} from 'lucide-react';
import api from '../api';
import { formatBytes, formatRelativeDate } from '../utils';

// ---------------------------------------------------------------------------
// Icon mapping (matches backend `icon` field)
// ---------------------------------------------------------------------------
const ICON_MAP = {
  folder:   <FolderOpen className="w-4 h-4 text-yellow-400" />,
  image:    <Image      className="w-4 h-4 text-pink-400" />,
  video:    <Film       className="w-4 h-4 text-purple-400" />,
  audio:    <Music      className="w-4 h-4 text-green-400" />,
  document: <FileText   className="w-4 h-4 text-blue-400" />,
  archive:  <Archive    className="w-4 h-4 text-orange-400" />,
  code:     <Code       className="w-4 h-4 text-cyan-400" />,
  exe:      <Cpu        className="w-4 h-4 text-red-400" />,
  file:     <File       className="w-4 h-4 text-slate-400" />,
};

const entryIcon = (entry) => ICON_MAP[entry.icon] ?? ICON_MAP.file;

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------
function ContextMenu({ x, y, onClose, items }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ top: y, left: x }}
    >
      {items.map((item, i) =>
        item === '---' ? (
          <div key={i} className="my-1 border-t border-slate-700" />
        ) : (
          <button
            key={i}
            onClick={() => { item.action(); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 text-left"
          >
            {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rename inline editor
// ---------------------------------------------------------------------------
function RenameInput({ value, onConfirm, onCancel }) {
  const [name, setName] = useState(value);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.select(); }, []);
  return (
    <input
      ref={inputRef}
      className="bg-slate-700 text-white text-sm rounded px-1 py-0.5 outline-none ring-1 ring-brand-500 w-full"
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onConfirm(name);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onConfirm(name)}
      autoFocus
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function FileExplorerPage() {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries]         = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [quickAccess, setQuickAccess] = useState([]);
  const [loading, setLoading]         = useState(false);

  const [selected, setSelected]       = useState(new Set());
  const [clipboard, setClipboard]     = useState({ paths: [], mode: null }); // mode: 'copy'|'cut'

  const [viewMode, setViewMode]       = useState('list'); // 'list' | 'grid'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = not searching

  const [renaming, setRenaming]       = useState(null); // path being renamed
  const [ctxMenu, setCtxMenu]         = useState(null); // { x, y, items }
  const [error, setError]             = useState('');

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------
  const navigate = useCallback(async (path) => {
    setLoading(true);
    setError('');
    setSelected(new Set());
    setSearchResults(null);
    setSearchQuery('');
    try {
      const res = await api.get('/explorer/list', { params: { path } });
      setCurrentPath(res.data.path);
      setEntries(res.data.entries || []);
      setBreadcrumbs(res.data.breadcrumbs || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Cannot open this location.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: fetch quick access and navigate to the first location
  useEffect(() => {
    api.get('/explorer/quick-access').then((res) => {
      const locs = res.data.locations || [];
      setQuickAccess(locs);
      if (locs.length > 0) navigate(locs[0].path);
    });
  }, [navigate]);

  // -------------------------------------------------------------------------
  // Selection helpers
  // -------------------------------------------------------------------------
  const toggleSelect = (path, e) => {
    if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path); else next.add(path);
        return next;
      });
    } else {
      setSelected(new Set([path]));
    }
  };

  const selectedEntries = entries.filter((e) => selected.has(e.path));

  // -------------------------------------------------------------------------
  // File operations
  // -------------------------------------------------------------------------
  const handleOpen = async (entry) => {
    if (entry.is_dir) {
      navigate(entry.path);
    } else {
      await api.post('/explorer/open', { path: entry.path });
    }
  };

  const handleDelete = async (paths) => {
    if (!paths.length) return;
    if (!window.confirm(`Send ${paths.length} item(s) to the Recycle Bin?`)) return;
    await api.post('/explorer/delete', { paths });
    setSelected(new Set());
    navigate(currentPath);
  };

  const handleCopy  = (paths) => setClipboard({ paths, mode: 'copy' });
  const handleCut   = (paths) => setClipboard({ paths, mode: 'cut'  });

  const handlePaste = async () => {
    if (!clipboard.paths.length || !currentPath) return;
    if (clipboard.mode === 'copy') {
      await api.post('/explorer/copy', { paths: clipboard.paths, destination: currentPath });
    } else {
      await api.post('/explorer/move', { paths: clipboard.paths, destination: currentPath });
      setClipboard({ paths: [], mode: null });
    }
    navigate(currentPath);
  };

  const handleNewFolder = async () => {
    const name = window.prompt('Folder name:');
    if (!name) return;
    try {
      await api.post('/explorer/folder', { parent_path: currentPath, name });
      navigate(currentPath);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create folder.');
    }
  };

  const handleRenameConfirm = async (newName) => {
    if (!renaming || !newName || newName === renaming) { setRenaming(null); return; }
    try {
      await api.post('/explorer/rename', { path: renaming, new_name: newName });
      setRenaming(null);
      navigate(currentPath);
    } catch (err) {
      setError(err.response?.data?.detail || 'Rename failed.');
      setRenaming(null);
    }
  };

  const handleOpenInExplorer = async (path) => {
    await api.post('/explorer/open-in-explorer', { path });
  };

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------
  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentPath) return;
    setLoading(true);
    try {
      const res = await api.get('/explorer/search', {
        params: { root_path: currentPath, query: searchQuery, limit: 300 },
      });
      setSearchResults(res.data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => { setSearchQuery(''); setSearchResults(null); };

  // -------------------------------------------------------------------------
  // Context menu builder
  // -------------------------------------------------------------------------
  const openCtxMenu = (e, entry) => {
    e.preventDefault();
    const isSelected = selected.has(entry.path);
    if (!isSelected) setSelected(new Set([entry.path]));
    const targets = isSelected && selected.size > 1
      ? Array.from(selected)
      : [entry.path];

    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Open',            icon: <ExternalLink className="w-3.5 h-3.5" />, action: () => handleOpen(entry) },
        { label: 'Open in Explorer', icon: <FolderOpen className="w-3.5 h-3.5" />, action: () => handleOpenInExplorer(entry.path) },
        '---',
        { label: 'Copy',   icon: <Copy     className="w-3.5 h-3.5" />, action: () => handleCopy(targets) },
        { label: 'Cut',    icon: <Scissors className="w-3.5 h-3.5" />, action: () => handleCut(targets) },
        '---',
        { label: 'Rename', icon: <Edit2    className="w-3.5 h-3.5" />, action: () => setRenaming(entry.path) },
        { label: 'Delete', icon: <Trash2   className="w-3.5 h-3.5 text-red-400" />, action: () => handleDelete(targets) },
      ],
    });
  };

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') { e.preventDefault(); if (selected.size) handleCopy(Array.from(selected)); }
        if (e.key === 'x') { e.preventDefault(); if (selected.size) handleCut(Array.from(selected)); }
        if (e.key === 'v') { e.preventDefault(); handlePaste(); }
        if (e.key === 'a') { e.preventDefault(); setSelected(new Set(entries.map((e) => e.path))); }
      }
      if (e.key === 'F2' && selected.size === 1) { e.preventDefault(); setRenaming(Array.from(selected)[0]); }
      if (e.key === 'Delete' && selected.size) { e.preventDefault(); handleDelete(Array.from(selected)); }
      if (e.key === 'Escape') { setSelected(new Set()); clearSearch(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, entries, clipboard, currentPath]);

  // -------------------------------------------------------------------------
  // Displayed entries (search results or normal listing)
  // -------------------------------------------------------------------------
  const displayEntries = searchResults !== null ? searchResults : entries;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-full">
      {/* Sidebar: Quick Access */}
      <aside className="w-44 flex-shrink-0 border-r border-slate-700/50 p-3 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-2 mb-2">
          Quick Access
        </p>
        {quickAccess.map((loc) => (
          <button
            key={loc.path}
            onClick={() => navigate(loc.path)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
              currentPath === loc.path
                ? 'bg-brand-600/20 text-brand-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
            }`}
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
            {loc.name}
          </button>
        ))}
      </aside>

      {/* Main pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/50 bg-surface-950 flex-shrink-0">
          {/* Back */}
          <button
            onClick={() => { const par = breadcrumbs.at(-2); if (par) navigate(par.path); }}
            disabled={breadcrumbs.length <= 1}
            className="p-1.5 rounded hover:bg-slate-700/50 disabled:opacity-30 text-slate-400"
            title="Go up"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.path}>
                {i > 0 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
                <button
                  onClick={() => navigate(crumb.path)}
                  className="text-sm text-slate-400 hover:text-white truncate flex-shrink-0 max-w-[120px]"
                  title={crumb.path}
                >
                  {i === 0 ? <Home className="w-3.5 h-3.5" /> : crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              className="bg-transparent text-sm text-slate-200 outline-none w-40 placeholder-slate-600"
              placeholder="Search here…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {searchQuery && (
              <button onClick={clearSearch} className="text-slate-500 hover:text-slate-300">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <button onClick={handleNewFolder} className="btn-ghost p-1.5" title="New folder">
            <Plus className="w-4 h-4" />
          </button>
          {clipboard.paths.length > 0 && (
            <button onClick={handlePaste} className="btn-ghost p-1.5" title={`Paste (${clipboard.mode})`}>
              <Clipboard className="w-4 h-4 text-brand-400" />
            </button>
          )}
          {selected.size > 0 && (
            <>
              <button onClick={() => handleCopy(Array.from(selected))} className="btn-ghost p-1.5" title="Copy">
                <Copy className="w-4 h-4" />
              </button>
              <button onClick={() => handleCut(Array.from(selected))} className="btn-ghost p-1.5" title="Cut">
                <Scissors className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(Array.from(selected))} className="btn-ghost p-1.5 text-red-400" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={() => navigate(currentPath)} className="btn-ghost p-1.5" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* View mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
              title="Grid view"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Status bar */}
        {(selected.size > 0 || searchResults !== null) && (
          <div className="flex items-center gap-3 px-4 py-1 bg-brand-600/10 border-b border-slate-700/50 text-xs text-slate-400 flex-shrink-0">
            {searchResults !== null && (
              <span>🔍 {searchResults.length} results for "{searchQuery}"</span>
            )}
            {selected.size > 0 && (
              <span>
                {selected.size} selected
                {selectedEntries.length > 0 &&
                  ` — ${formatBytes(selectedEntries.reduce((a, e) => a + e.size_bytes, 0))}`}
              </span>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 bg-red-900/30 border-b border-red-700/50 text-red-300 text-sm flex items-center justify-between flex-shrink-0">
            {error}
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Content */}
        <div
          className="flex-1 overflow-auto p-2"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(new Set()); }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-600">
              <FolderOpen className="w-10 h-10 mb-2" />
              <p>This folder is empty</p>
            </div>
          ) : viewMode === 'list' ? (
            <ListView
              entries={displayEntries}
              selected={selected}
              renaming={renaming}
              onOpen={handleOpen}
              onSelect={toggleSelect}
              onContextMenu={openCtxMenu}
              onRenameConfirm={handleRenameConfirm}
              onRenameCancel={() => setRenaming(null)}
            />
          ) : (
            <GridView
              entries={displayEntries}
              selected={selected}
              renaming={renaming}
              onOpen={handleOpen}
              onSelect={toggleSelect}
              onContextMenu={openCtxMenu}
              onRenameConfirm={handleRenameConfirm}
              onRenameCancel={() => setRenaming(null)}
            />
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------
function ListView({ entries, selected, renaming, onOpen, onSelect, onContextMenu, onRenameConfirm, onRenameCancel }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-slate-500 text-xs border-b border-slate-700/50">
          <th className="text-left py-1.5 px-2 font-medium">Name</th>
          <th className="text-right py-1.5 px-2 font-medium w-24">Size</th>
          <th className="text-right py-1.5 px-2 font-medium w-28">Modified</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr
            key={entry.path}
            className={`group rounded cursor-pointer select-none ${
              selected.has(entry.path)
                ? 'bg-brand-600/20 text-white'
                : 'hover:bg-slate-700/30 text-slate-300'
            }`}
            onClick={(e) => onSelect(entry.path, e)}
            onDoubleClick={() => onOpen(entry)}
            onContextMenu={(e) => onContextMenu(e, entry)}
          >
            <td className="py-1.5 px-2 flex items-center gap-2">
              {entryIcon(entry)}
              {renaming === entry.path ? (
                <RenameInput
                  value={entry.name}
                  onConfirm={onRenameConfirm}
                  onCancel={onRenameCancel}
                />
              ) : (
                <span className="truncate">{entry.name}</span>
              )}
            </td>
            <td className="py-1.5 px-2 text-right text-slate-500 text-xs">
              {entry.is_dir ? '—' : formatBytes(entry.size_bytes)}
            </td>
            <td className="py-1.5 px-2 text-right text-slate-500 text-xs">
              {formatRelativeDate(entry.modified)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Grid view
// ---------------------------------------------------------------------------
function GridView({ entries, selected, renaming, onOpen, onSelect, onContextMenu, onRenameConfirm, onRenameCancel }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 p-1">
      {entries.map((entry) => (
        <div
          key={entry.path}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer select-none text-center transition-colors ${
            selected.has(entry.path)
              ? 'bg-brand-600/25 ring-1 ring-brand-500'
              : 'hover:bg-slate-700/40'
          }`}
          onClick={(e) => onSelect(entry.path, e)}
          onDoubleClick={() => onOpen(entry)}
          onContextMenu={(e) => onContextMenu(e, entry)}
        >
          <span className="text-3xl">{entry.is_dir ? '📁' : _gridEmoji(entry.icon)}</span>
          {renaming === entry.path ? (
            <RenameInput
              value={entry.name}
              onConfirm={onRenameConfirm}
              onCancel={onRenameCancel}
            />
          ) : (
            <span className="text-xs text-slate-300 line-clamp-2 leading-tight w-full break-all">
              {entry.name}
            </span>
          )}
          {!entry.is_dir && (
            <span className="text-xs text-slate-600">{formatBytes(entry.size_bytes)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function _gridEmoji(icon) {
  const map = { image: '🖼️', video: '🎬', audio: '🎵', document: '📄', archive: '📦', code: '💻', exe: '⚙️' };
  return map[icon] ?? '📄';
}
