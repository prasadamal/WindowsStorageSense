import React, { useEffect, useState } from 'react';
import { Copy, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../api';
import { formatBytes } from '../utils';

function DupeGroup({ group, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(
    group.files.filter((f) => !f.is_original).map((f) => f.path)
  );

  const toggle = (path) => {
    setSelected((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  return (
    <div className="border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-700/20 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-200">{group.file_count} identical copies</p>
          <p className="text-xs text-slate-400 mt-0.5">{group.full_hash?.slice(0, 16)}…</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-medium text-white">{formatBytes(group.wasted_bytes)}</p>
          <p className="text-xs text-red-400">wasted</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/50 bg-slate-900/40">
          <div className="divide-y divide-slate-700/30">
            {group.files.map((f) => (
              <div key={f.path} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-brand-600"
                  checked={selected.includes(f.path)}
                  onChange={() => toggle(f.path)}
                  disabled={f.is_original}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{f.path?.split('\\').pop()}</p>
                  <p className="text-xs text-slate-500 truncate">{f.path}</p>
                </div>
                {f.is_original && <span className="badge badge-green flex-shrink-0">Original</span>}
                {!f.is_original && <span className="badge badge-yellow flex-shrink-0">Duplicate</span>}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-700/50">
            <button
              disabled={selected.length === 0}
              onClick={() => onDelete(selected, group)}
              className="btn-danger text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete {selected.length} duplicate(s)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DuplicatesPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [totalWasted, setTotalWasted] = useState(0);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/duplicates');
      const g = res.data.groups || [];
      setGroups(g);
      setTotalWasted(g.reduce((acc, g) => acc + (g.wasted_bytes || 0), 0));
    } catch {}
    setLoading(false);
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await api.post('/duplicates/scan');
      // Poll until results appear
      const poll = setInterval(async () => {
        const res = await api.get('/duplicates');
        if ((res.data.groups || []).length > 0) {
          clearInterval(poll);
          setScanning(false);
          loadGroups();
        }
      }, 3000);
      // Safety timeout
      setTimeout(() => { clearInterval(poll); setScanning(false); loadGroups(); }, 120000);
    } catch {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleDelete = async (paths, group) => {
    const confirmed = window.confirm(`Send ${paths.length} duplicate file(s) to Recycle Bin?`);
    if (!confirmed) return;
    await api.post('/files/delete', { paths });
    loadGroups();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Duplicate Finder</h1>
          <p className="text-slate-400 text-sm">Exact duplicates detected using MD5 hash comparison (never filename matching)</p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
          {scanning ? 'Scanning…' : 'Find Duplicates'}
        </button>
      </div>

      {totalWasted > 0 && (
        <div className="card bg-red-500/10 border-red-500/30">
          <div className="flex items-center gap-3">
            <Copy className="w-5 h-5 text-red-400" />
            <div>
              <p className="font-semibold text-white">{formatBytes(totalWasted)} recoverable</p>
              <p className="text-sm text-slate-400">{groups.length} duplicate group(s) found</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : groups.length === 0 ? (
        <div className="card text-center py-10">
          <Copy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No duplicates found yet. Run a scan to check.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <DupeGroup key={g.group_id || g.full_hash} group={g} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
