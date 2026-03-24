import React, { useEffect, useState } from 'react';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../api';
import { formatBytes } from '../utils';

export default function JunkCleaner() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState(null);

  const loadJunk = async () => {
    setLoading(true);
    try {
      const res = await api.get('/junk/scan');
      const cats = (res.data.categories || []).filter((c) => c.exists && c.size_bytes > 0);
      setCategories(cats);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadJunk();
  }, []);

  const toggleAll = () => {
    if (selected.size === categories.length) setSelected(new Set());
    else setSelected(new Set(categories.map((c) => c.id)));
  };

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalSelected = categories
    .filter((c) => selected.has(c.id))
    .reduce((acc, c) => acc + c.size_bytes, 0);

  const handleClean = async () => {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `This will send ${formatBytes(totalSelected)} of junk files to the Recycle Bin. Continue?`
    );
    if (!confirmed) return;
    setCleaning(true);
    try {
      const sessionRes = await api.get('/scan/latest');
      const sessionId = sessionRes.data.session_id || 0;
      const res = await api.post('/junk/delete', {
        category_ids: Array.from(selected),
        session_id: sessionId,
      });
      setResult(res.data);
      setSelected(new Set());
      loadJunk();
    } catch {}
    setCleaning(false);
  };

  const totalJunk = categories.reduce((acc, c) => acc + c.size_bytes, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Junk Cleaner</h1>
          <p className="text-slate-400 text-sm">Select categories to clean — nothing is deleted without your confirmation</p>
        </div>
        <button onClick={loadJunk} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Rescan
        </button>
      </div>

      {totalJunk > 0 && (
        <div className="card bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="font-semibold text-white">{formatBytes(totalJunk)} of junk detected</p>
              <p className="text-sm text-slate-400">Across {categories.length} categories</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="card bg-green-500/10 border-green-500/30">
          <p className="text-green-300 font-medium">
            Cleaned {formatBytes(result.deleted_bytes || 0)}
            {result.errors?.length > 0 && ` (${result.errors.length} errors)`}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={toggleAll} className="text-sm text-brand-400 hover:text-brand-300">
              {selected.size === categories.length ? 'Deselect All' : 'Select All'}
            </button>
            {selected.size > 0 && (
              <span className="text-sm text-slate-400">
                {formatBytes(totalSelected)} selected
              </span>
            )}
          </div>

          <div className="space-y-3">
            {categories.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                  ${selected.has(c.id) ? 'border-brand-500 bg-brand-600/10' : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'}`}
                onClick={() => toggle(c.id)}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-brand-600"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{c.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.paths?.join(', ')}</p>
                </div>
                <span className="text-sm font-semibold text-slate-300 flex-shrink-0">
                  {formatBytes(c.size_bytes)}
                </span>
              </div>
            ))}

            {categories.length === 0 && (
              <p className="text-slate-500 text-center py-6">No junk found — your system is clean! 🎉</p>
            )}
          </div>

          {selected.size > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-sm text-slate-400">
                {selected.size} categor{selected.size > 1 ? 'ies' : 'y'} · {formatBytes(totalSelected)}
              </span>
              <button
                onClick={handleClean}
                disabled={cleaning}
                className="btn-danger flex items-center gap-2 text-sm"
              >
                {cleaning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Clean Selected
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
