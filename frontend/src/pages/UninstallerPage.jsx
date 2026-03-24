import React, { useEffect, useState } from 'react';
import { RefreshCw, Trash2, Clock, Search } from 'lucide-react';
import api from '../api';
import { formatBytes, formatRelativeDate } from '../utils';

export default function UninstallerPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | 30 | 60 | 90
  const [uninstalling, setUninstalling] = useState(null);
  const [leftovers, setLeftovers] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const loadApps = async () => {
    setLoading(true);
    try {
      const res = await api.get('/apps');
      setApps(res.data.apps || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadApps();
  }, []);

  const filteredApps = apps.filter((app) => {
    if (search && !app.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter !== 'all' && app.last_used) {
      const days = Math.floor((Date.now() - new Date(app.last_used).getTime()) / 86400000);
      if (days < parseInt(filter, 10)) return false;
    }
    return true;
  });

  const handleUninstall = async (app) => {
    if (!window.confirm(`Uninstall "${app.name}"?`)) return;
    setUninstalling(app.name);
    try {
      await api.post('/apps/uninstall', {
        app_name: app.name,
        uninstall_cmd: app.uninstall_cmd,
      });
      // Scan for leftovers
      const res = await api.get(`/apps/leftovers?app_name=${encodeURIComponent(app.name)}&install_location=${encodeURIComponent(app.install_location || '')}`);
      setLeftovers(res.data);
    } catch {}
    setUninstalling(null);
    loadApps();
  };

  const handleDeleteLeftovers = async (paths) => {
    if (!window.confirm(`Delete ${paths.length} leftover item(s) from Recycle Bin?`)) return;
    await api.post('/apps/leftovers/delete', { paths });
    setLeftovers(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Smart Uninstaller</h1>
        <p className="text-slate-400 text-sm">Uninstall apps and clean up leftover files</p>
      </div>

      {/* Leftover cleanup modal */}
      {leftovers && (
        <div className="card border-yellow-500/30 bg-yellow-500/10">
          <h2 className="font-semibold text-white mb-2">Leftovers Found — "{leftovers.app_name}"</h2>
          <p className="text-sm text-slate-400 mb-3">
            {leftovers.leftover_files?.length} file/folder(s) · {formatBytes(leftovers.total_leftover_bytes)}
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
            {leftovers.leftover_files?.map((f) => (
              <div key={f.path} className="text-xs text-slate-300 truncate px-2">{f.path}</div>
            ))}
            {leftovers.leftover_registry_keys?.map((r) => (
              <div key={r.path} className="text-xs text-slate-400 truncate px-2">📋 {r.path}</div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleDeleteLeftovers(leftovers.leftover_files?.map((f) => f.path) || [])}
              className="btn-danger text-sm"
            >
              Delete Files to Recycle Bin
            </button>
            <button onClick={() => setLeftovers(null)} className="btn-secondary text-sm">Dismiss</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search apps…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-slate-200 text-sm flex-1 outline-none placeholder-slate-500"
          />
        </div>
        <div className="flex gap-2">
          {[['all', 'All'], ['30', 'Unused 30d'], ['60', 'Unused 60d'], ['90', 'Unused 90d']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors
                ${filter === v ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : filteredApps.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No apps found.</p>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {filteredApps.map((app) => (
              <div key={app.name} className="flex items-center gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{app.name}</p>
                  <p className="text-xs text-slate-500 truncate">{app.install_location || 'Unknown location'}</p>
                  {app.publisher && <p className="text-xs text-slate-600">{app.publisher}</p>}
                </div>
                <div className="text-right flex-shrink-0 min-w-20">
                  <p className="text-sm font-semibold text-slate-300">{formatBytes(app.real_size_bytes)}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {formatRelativeDate(app.last_used)}
                  </p>
                </div>
                <button
                  onClick={() => handleUninstall(app)}
                  disabled={uninstalling === app.name}
                  className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0"
                >
                  {uninstalling === app.name
                    ? <RefreshCw className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />}
                  Uninstall
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
