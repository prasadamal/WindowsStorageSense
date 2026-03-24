import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Trash2, FolderOpen } from 'lucide-react';
import api from '../api';
import { formatBytes, formatRelativeDate, CATEGORY_ICONS } from '../utils';

export default function DownloadsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('All');
  const [organizing, setOrganizing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/downloads');
      setData(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOrganize = async () => {
    if (!window.confirm('Auto-organize Downloads folder into subfolders by file type?')) return;
    setOrganizing(true);
    try {
      await api.post('/downloads/organize');
      loadData();
    } catch {}
    setOrganizing(false);
  };

  const handleDeleteStale = async () => {
    if (!window.confirm('Send all stale files (90+ days old) to Recycle Bin?')) return;
    await api.post('/downloads/delete-stale');
    loadData();
  };

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const categories = data.grouped ? ['All', ...Object.keys(data.grouped)] : ['All'];
  const displayFiles = category === 'All'
    ? (data.files || [])
    : (data.grouped?.[category] || []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Downloads Manager</h1>
          <p className="text-slate-400 text-sm">{data.path}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={handleOrganize} disabled={organizing} className="btn-secondary flex items-center gap-2 text-sm">
            <FolderOpen className="w-4 h-4" /> {organizing ? 'Organizing…' : 'Auto-Organize'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Size', value: formatBytes(data.total_bytes) },
          { label: 'Total Files', value: (data.files?.length || 0).toLocaleString() },
          { label: 'Stale Files', value: (data.stale_count || 0).toLocaleString() },
          { label: 'Recoverable', value: formatBytes(data.stale_bytes) },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="text-xl font-bold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {data.stale_bytes > 0 && (
        <div className="card bg-yellow-500/10 border-yellow-500/30 flex items-center justify-between gap-4">
          <p className="text-sm text-yellow-300">
            {formatBytes(data.stale_bytes)} in files not accessed for 90+ days
          </p>
          <button onClick={handleDeleteStale} className="btn-danger text-sm flex items-center gap-2 flex-shrink-0">
            <Trash2 className="w-4 h-4" /> Delete Stale
          </button>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${category === cat ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
          >
            {CATEGORY_ICONS[cat] ? `${CATEGORY_ICONS[cat]} ` : ''}{cat}
            {cat !== 'All' && data.grouped?.[cat] && (
              <span className="ml-1 text-xs opacity-70">({data.grouped[cat].length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : displayFiles.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No files found.</p>
        ) : (
          <div className="divide-y divide-slate-700/50 max-h-[60vh] overflow-y-auto">
            {displayFiles.map((f) => (
              <div key={f.path} className="flex items-center gap-3 py-2.5">
                <span className="text-lg flex-shrink-0">{CATEGORY_ICONS[f.category] || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{f.name}</p>
                  <p className="text-xs text-slate-500">{formatRelativeDate(f.last_modified)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-slate-300">{formatBytes(f.size_bytes)}</p>
                  {f.is_stale && <span className="badge badge-yellow text-xs">Stale</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
