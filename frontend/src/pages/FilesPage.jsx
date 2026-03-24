import React, { useEffect, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import api from '../api';
import { formatBytes, formatRelativeDate, CATEGORY_ICONS } from '../utils';

const CATEGORIES = ['All', 'Movies', 'Documents', 'Images', 'Music', 'Downloads', 'Applications', 'Archives', 'Other'];

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const loadFiles = async (cat) => {
    setLoading(true);
    try {
      let res;
      if (cat === 'All') {
        res = await api.get('/files/top?limit=200');
        setFiles(res.data.files || []);
      } else {
        res = await api.get(`/files/by-category/${cat}`);
        setFiles(res.data.files || []);
      }
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles(category);
  }, [category]);

  const toggleSelect = (path) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    const confirmed = window.confirm(`Send ${selected.size} file(s) to Recycle Bin?`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      await api.post('/files/delete', { paths: Array.from(selected) });
      setSelected(new Set());
      loadFiles(category);
    } catch {}
    setDeleting(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Files</h1>
          <p className="text-slate-400 text-sm">Browse and manage files by category</p>
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-danger flex items-center gap-2 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Delete {selected.size} selected
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { setCategory(cat); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${category === cat ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
          >
            {CATEGORY_ICONS[cat] && `${CATEGORY_ICONS[cat]} `}{cat}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : files.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No files found.</p>
        ) : (
          <div className="divide-y divide-slate-700/50 max-h-[60vh] overflow-y-auto">
            {files.map((f) => (
              <div
                key={f.path}
                className="flex items-center gap-3 py-2.5 group hover:bg-slate-700/20 px-2 rounded"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-brand-600"
                  checked={selected.has(f.path)}
                  onChange={() => toggleSelect(f.path)}
                />
                <span className="text-lg flex-shrink-0">{CATEGORY_ICONS[f.category] || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm truncate">{f.name}</p>
                  <p className="text-xs text-slate-500 truncate">{f.path}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-slate-300">{formatBytes(f.size_bytes)}</p>
                  <p className="text-xs text-slate-500">{formatRelativeDate(f.last_accessed)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
