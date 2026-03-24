import React, { useEffect, useState } from 'react';
import { Shield, RefreshCw, HardDrive, ArrowRight } from 'lucide-react';
import api from '../api';
import { formatBytes } from '../utils';

function RecommendationCard({ rec }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{rec.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{rec.reason}</p>
        <div className="flex items-center gap-2 mt-2 text-xs">
          <span className={`badge ${rec.current_type === 'SSD' ? 'badge-blue' : 'badge-yellow'}`}>
            {rec.current_type}: {rec.current_drive}
          </span>
          <ArrowRight className="w-3 h-3 text-slate-500" />
          <span className={`badge ${rec.suggested_type === 'SSD' ? 'badge-blue' : 'badge-yellow'}`}>
            {rec.suggested_type}: {rec.suggested_drive}
          </span>
        </div>
      </div>
      <span className="text-sm font-semibold text-slate-300 flex-shrink-0">{formatBytes(rec.size_bytes)}</span>
    </div>
  );
}

export default function DriveOptimizer() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/drives/optimize');
      setData(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const recs = data?.recommendations;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Drive Optimization Advisor</h1>
          <p className="text-slate-400 text-sm">Recommendations for optimal SSD / HDD placement</p>
        </div>
        <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && recs && !recs.applicable && (
        <div className="card text-center py-10">
          <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">{recs.reason || 'Drive optimization not applicable.'}</p>
          <p className="text-slate-500 text-sm mt-1">This feature requires both an SSD and HDD.</p>
        </div>
      )}

      {!loading && recs?.applicable && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Move to SSD */}
          <div className="card">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-brand-400" />
              Move to SSD
            </h2>
            <p className="text-xs text-slate-500 mb-3">Items on HDD that would benefit from SSD speed</p>
            {recs.move_to_ssd?.length > 0 ? (
              <div className="space-y-2">
                {recs.move_to_ssd.map((r, i) => <RecommendationCard key={i} rec={r} />)}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No items to move to SSD.</p>
            )}
          </div>

          {/* Move to HDD */}
          <div className="card">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-yellow-400" />
              Move to HDD
            </h2>
            <p className="text-xs text-slate-500 mb-3">Items on SSD wasting premium storage space</p>
            {recs.move_to_hdd?.length > 0 ? (
              <div className="space-y-2">
                {recs.move_to_hdd.map((r, i) => <RecommendationCard key={i} rec={r} />)}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No items to move to HDD.</p>
            )}
          </div>
        </div>
      )}

      {/* Drive list */}
      {data?.drives && (
        <div className="card">
          <h2 className="font-semibold text-white mb-3">Detected Drives</h2>
          <div className="divide-y divide-slate-700/50">
            {data.drives.map((d) => (
              <div key={d.path} className="flex items-center gap-3 py-3">
                <HardDrive className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{d.label || d.path}</p>
                  <p className="text-xs text-slate-400">{formatBytes(d.total_bytes)} · {d.drive_type}</p>
                </div>
                <span className={`badge ${d.drive_type === 'SSD' ? 'badge-blue' : d.drive_type === 'HDD' ? 'badge-yellow' : 'badge-green'}`}>
                  {d.drive_type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
