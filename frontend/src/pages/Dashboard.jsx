import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardDrive, RefreshCw, AlertTriangle, Zap, Cpu, MemoryStick,
  ArrowRight, Trash2, CheckCircle, Sparkles, Activity,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis,
} from 'recharts';
import useStore from '../store';
import { formatBytes, usageColour, CATEGORY_COLORS, CATEGORY_ICONS } from '../utils';
import { useToast } from '../components/Toast';
import { SkeletonCard, SkeletonList } from '../components/Skeleton';
import api from '../api';

// ---------------------------------------------------------------------------
// Drive card
// ---------------------------------------------------------------------------
function DriveCard({ drive }) {
  const pct = drive.percent_used;
  const typeColor = drive.drive_type === 'SSD' ? 'text-green-400' : drive.drive_type === 'HDD' ? 'text-blue-400' : 'text-slate-400';
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-slate-700/60 rounded-lg flex items-center justify-center">
          <HardDrive className={`w-5 h-5 ${typeColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{drive.label || drive.path}</div>
          <div className={`text-xs ${typeColor}`}>{drive.drive_type || 'Unknown'}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-semibold text-white">{formatBytes(drive.free_bytes)} free</div>
          <div className="text-xs text-slate-500">of {formatBytes(drive.total_bytes)}</div>
        </div>
      </div>
      <div className="progress-bar">
        <div className={`progress-bar-fill ${usageColour(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-slate-500 mt-1">{pct.toFixed(1)}% used</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Health score ring
// ---------------------------------------------------------------------------
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
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            className={ring}
            strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${colour}`}>{score}</span>
        </div>
      </div>
      <p className={`text-sm font-semibold mt-2 ${colour}`}>
        {score >= 80 ? '✓ Healthy' : score >= 50 ? '⚠ Needs Attention' : '✗ Action Required'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini system stats widget
// ---------------------------------------------------------------------------
function SystemWidget({ system }) {
  if (!system) return null;
  const cpu = system.cpu?.overall ?? 0;
  const ram = system.ram?.percent ?? 0;
  const cpuCol = cpu > 90 ? 'text-red-400' : cpu > 70 ? 'text-yellow-400' : 'text-green-400';
  const ramCol = ram > 90 ? 'text-red-400' : ram > 70 ? 'text-yellow-400' : 'text-blue-400';
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-white">System</h2>
        <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-xs text-slate-500">CPU</span>
          </div>
          <p className={`text-xl font-bold ${cpuCol}`}>{cpu.toFixed(1)}%</p>
          <p className="text-xs text-slate-600">{system.cpu?.core_count ?? '?'} cores</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <MemoryStick className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs text-slate-500">RAM</span>
          </div>
          <p className={`text-xl font-bold ${ramCol}`}>{ram.toFixed(1)}%</p>
          <p className="text-xs text-slate-600">{formatBytes(system.ram?.used ?? 0)} used</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One-click cleanup panel
// ---------------------------------------------------------------------------
function OneClickCleanup({ drives }) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    if (!window.confirm('Run automatic cleanup? This will remove junk files and empty folders and send them to the Recycle Bin.')) return;
    setRunning(true);
    try {
      const res = await api.post('/cleanup/one-click', {
        delete_empty_folders: true,
        root_paths: drives.map((d) => d.path).filter(Boolean),
      });
      setResult(res.data);
      const totalDeleted = (res.data.steps || []).reduce((s, st) => s + (st.deleted || 0), 0);
      toast.success(`One-click cleanup complete — ${totalDeleted} items removed`);
    } catch (err) {
      toast.error('Cleanup failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card border-brand-600/20 bg-brand-600/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">One-Click Cleanup</p>
            <p className="text-xs text-slate-400">Remove junk files and empty folders automatically</p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {running ? 'Cleaning…' : 'Clean Now'}
        </button>
      </div>

      {result && (
        <div className="mt-4 space-y-1.5">
          {(result.steps || []).map((step) => (
            <div key={step.step} className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              {step.step}: {step.deleted} removed
              {step.errors?.length > 0 && <span className="text-red-400">({step.errors.length} errors)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const { dashboard, dashboardLoading, fetchDashboard, drives } = useStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = async () => {
    await fetchDashboard();
    toast.info('Dashboard refreshed');
  };

  if (dashboardLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="h-7 w-32 bg-slate-700 rounded animate-pulse" />
            <div className="h-3.5 w-48 bg-slate-800 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="card"><SkeletonList rows={6} /></div>
      </div>
    );
  }

  if (!dashboard?.has_data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white">No scan data yet</h2>
          <p className="text-slate-400 mt-1 mb-4">Run a scan to see your storage breakdown.</p>
          <button onClick={() => navigate('/storage')} className="btn-primary flex items-center gap-2 mx-auto">
            <HardDrive className="w-4 h-4" /> Start Scan
          </button>
        </div>
      </div>
    );
  }

  const { drives: dbDrives, categories = [], top_files = [], health_score = 0, quick_wins = [], junk_bytes = 0, system } = dashboard;
  const displayDrives = dbDrives?.length ? dbDrives : drives;

  const pieData = categories.map((c) => ({
    name: c.category,
    value: c.total_bytes,
    color: CATEGORY_COLORS[c.category] || '#64748b',
  }));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm">Your storage at a glance</p>
        </div>
        <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* One-click cleanup */}
      <OneClickCleanup drives={displayDrives} />

      {/* Drives row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayDrives.map((d) => <DriveCard key={d.path} drive={d} />)}
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
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatBytes(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {categories.slice(0, 8).map((c) => (
                  <div key={c.category} className="flex items-center gap-2">
                    <span className="text-base">{CATEGORY_ICONS[c.category] || '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300 truncate">{c.category}</span>
                        <span className="text-slate-400 flex-shrink-0 ml-2">{formatBytes(c.total_bytes)}</span>
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
            <p className="text-slate-500 text-sm">No data yet</p>
          )}
        </div>

        <div className="space-y-4">
          <HealthScore score={health_score} />
          <SystemWidget system={system} />
        </div>
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
              <div
                key={w.action}
                onClick={() => navigate(`/${w.action}`)}
                className="flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/40 rounded-lg cursor-pointer transition-colors group"
              >
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{w.title}</p>
                  <p className="text-xs text-slate-400">{w.description}</p>
                </div>
                <span className="text-sm font-medium text-yellow-400 flex-shrink-0">{formatBytes(w.bytes)}</span>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 5 largest files */}
      {top_files.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Largest Files</h2>
            <button
              onClick={() => navigate('/analyzer')}
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-700/40">
            {top_files.map((f) => (
              <div key={f.path} className="flex items-center gap-3 text-sm py-2.5">
                <span className="text-base flex-shrink-0">{CATEGORY_ICONS[f.category] || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 truncate font-medium">{f.name}</p>
                  <p className="text-xs text-slate-500 truncate">{f.path}</p>
                </div>
                <span className="text-slate-300 font-semibold flex-shrink-0">{formatBytes(f.size_bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
