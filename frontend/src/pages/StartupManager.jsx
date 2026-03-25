import React, { useEffect, useState } from 'react';
import { Rocket, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../api';

const IMPACT_BADGE = {
  High: 'badge-red',
  Medium: 'badge-yellow',
  Low: 'badge-green',
};

export default function StartupManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/startup');
      setItems(res.data.items || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleToggle = async (item) => {
    const newEnabled = !item.enabled;
    setItems((prev) =>
      prev.map((i) => (i.name === item.name && i.source_path === item.source_path ? { ...i, enabled: newEnabled } : i))
    );
    try {
      await api.post('/startup/toggle', {
        name: item.name,
        source_path: item.source_path || '',
        enabled: newEnabled,
      });
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((i) => (i.name === item.name && i.source_path === item.source_path ? { ...i, enabled: item.enabled } : i))
      );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Startup Manager</h1>
          <p className="text-slate-400 text-sm">Manage apps and services that launch at Windows startup</p>
        </div>
        <button onClick={loadItems} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No startup items found.</p>
        ) : (
          <div className="divide-y divide-slate-700/50">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-2 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>Name</span>
              <span>Source</span>
              <span>Impact</span>
              <span>Enabled</span>
            </div>
            {items.map((item) => (
              <div key={`${item.name}-${item.source_path}`} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-3 px-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 truncate">{item.command}</p>
                </div>
                <span className={`badge ${item.source === 'registry' ? 'badge-blue' : 'badge-green'} flex-shrink-0`}>
                  {item.source?.replace('_', ' ')}
                </span>
                <span className={`badge ${IMPACT_BADGE[item.impact] || 'badge-blue'} flex-shrink-0`}>
                  {item.impact}
                </span>
                <button
                  onClick={() => handleToggle(item)}
                  className="flex-shrink-0"
                  title={item.enabled ? 'Click to disable' : 'Click to enable'}
                >
                  {item.enabled
                    ? <ToggleRight className="w-8 h-8 text-brand-400" />
                    : <ToggleLeft className="w-8 h-8 text-slate-600" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
