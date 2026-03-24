import React, { useEffect } from 'react';
import { HardDrive, RefreshCw, AlertTriangle, Zap } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis
} from 'recharts';
import useStore from '../store';
import { formatBytes, usageColour, CATEGORY_COLORS, CATEGORY_ICONS } from '../utils';

function DriveCard({ drive }) {
  const pct = drive.percent_used;
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-slate-700 rounded-lg flex items-center justify-center">
          <HardDrive className="w-5 h-5 text-slate-300" />
        </div>
        <div>
          <div className="font-semibold text-white text-sm">{drive.label || drive.path}</div>
          <div className="text-xs text-slate-400">{drive.drive_type || 'Unknown'}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-sm font-medium text-white">{formatBytes(drive.free_bytes)} free</div>
          <div className="text-xs text-slate-400">of {formatBytes(drive.total_bytes)}</div>
        </div>
      </div>
      <div className="progress-bar">
        <div
          className={`progress-bar-fill ${usageColour(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-slate-400 mt-1">{pct.toFixed(1)}% used</div>
    </div>
  );
}

function HealthScore({ score }) {
  const colour = score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  const ring = score >= 80 ? 'stroke-green-500' : score >= 50 ? 'stroke-yellow-500' : 'stroke-red-500';
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="card flex flex-col items-center justify-center py-6">
      <p className="text-slate-400 text-sm mb-3">System Health</p>
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#334155" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            className={ring}
            strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${colour}`}>{score}</span>
        </div>
      </div>
      <p className={`text-sm font-medium mt-2 ${colour}`}>
        {score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Action Required'}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { dashboard, dashboardLoading, fetchDashboard, drives } = useStore();

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (dashboardLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading dashboard…
        </div>
      </div>
    );
  }

  if (!dashboard?.has_data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-white">No scan data yet</h2>
          <p className="text-slate-400 mt-1">Go to Storage and run your first scan.</p>
        </div>
      </div>
    );
  }

  const { drives: dbDrives, categories = [], top_files = [], health_score = 0, quick_wins = [], junk_bytes = 0 } = dashboard;

  const pieData = categories.map((c) => ({
    name: c.category,
    value: c.total_bytes,
    color: CATEGORY_COLORS[c.category] || '#64748b',
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm">Your storage at a glance</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Drives row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(dbDrives || drives).map((d) => <DriveCard key={d.path} drive={d} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Category breakdown */}
        <div className="lg:col-span-2 card">
          <h2 className="font-semibold text-white mb-4">Storage Breakdown</h2>
          {categories.length > 0 ? (
            <div className="flex gap-6">
              <div className="w-40 h-40 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={60}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatBytes(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {categories.slice(0, 8).map((c) => (
                  <div key={c.category} className="flex items-center gap-2">
                    <span>{CATEGORY_ICONS[c.category] || '📁'}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">{c.category}</span>
                        <span className="text-slate-400">{formatBytes(c.total_bytes)}</span>
                      </div>
                      <div className="progress-bar mt-1">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${Math.min(100, (c.total_bytes / categories[0].total_bytes) * 100)}%`,
                            backgroundColor: CATEGORY_COLORS[c.category] || '#64748b',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-slate-500">No data yet</p>
          )}
        </div>

        {/* Health score */}
        <HealthScore score={health_score} />
      </div>

      {/* Quick wins */}
      {quick_wins.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-400" />
            <h2 className="font-semibold text-white">Quick Wins</h2>
          </div>
          <div className="space-y-2">
            {quick_wins.map((w) => (
              <div key={w.action} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{w.title}</p>
                  <p className="text-xs text-slate-400">{w.description}</p>
                </div>
                <span className="text-sm font-medium text-slate-300">{formatBytes(w.bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 5 largest files */}
      {top_files.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-3">Largest Files</h2>
          <div className="space-y-2">
            {top_files.map((f) => (
              <div key={f.path} className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-700/50 last:border-0">
                <span className="text-slate-400 flex-shrink-0">{CATEGORY_ICONS[f.category] || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 truncate">{f.name}</p>
                  <p className="text-xs text-slate-500 truncate">{f.path}</p>
                </div>
                <span className="text-slate-300 font-medium flex-shrink-0">{formatBytes(f.size_bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
