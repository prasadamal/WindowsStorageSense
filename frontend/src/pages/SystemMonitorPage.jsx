import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Cpu, MemoryStick, HardDrive, Wifi, RefreshCw, Activity,
  ArrowDown, ArrowUp, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import api from '../api';
import { formatBytes } from '../utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MAX_HISTORY = 60;

function pctColor(pct) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#3b82f6';
}

function RadialGauge({ pct, color, label, sub }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, pct) / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white">{Math.round(pct)}%</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-white mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs shadow-xl">
      <p className="text-slate-400">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#94a3b8' }} className="font-medium">
          {typeof p.value === 'number' && p.value > 1024
            ? formatBytes(p.value)
            : `${p.value}%`}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini live chart
// ---------------------------------------------------------------------------
function SparkChart({ data, dataKey, color, formatter }) {
  return (
    <div className="h-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis domain={[0, 100]} hide />
          <Tooltip content={<MiniTooltip />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#grad-${dataKey})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SystemMonitorPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [cpuHistory, setCpuHistory] = useState([]);
  const [ramHistory, setRamHistory] = useState([]);
  const [diskReadHistory, setDiskReadHistory] = useState([]);
  const [diskWriteHistory, setDiskWriteHistory] = useState([]);
  const [netRecvHistory, setNetRecvHistory] = useState([]);
  const [netSentHistory, setNetSentHistory] = useState([]);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef(null);

  const addHistory = useCallback((setter, value) => {
    setter((prev) => {
      const next = [...prev, value];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/system/stats');
      const d = res.data;
      setSnapshot(d);
      const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      addHistory(setCpuHistory,       { t, cpu: d.cpu?.overall ?? 0 });
      addHistory(setRamHistory,       { t, ram: d.ram?.percent ?? 0 });
      addHistory(setDiskReadHistory,  { t, read: d.disk_io?.total_read_bps ?? 0 });
      addHistory(setDiskWriteHistory, { t, write: d.disk_io?.total_write_bps ?? 0 });
      addHistory(setNetRecvHistory,   { t, recv: d.network?.recv_bps ?? 0 });
      addHistory(setNetSentHistory,   { t, sent: d.network?.sent_bps ?? 0 });
      setTick((n) => n + 1);
    } catch {}
  }, [addHistory]);

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 2000);
    return () => clearInterval(intervalRef.current);
  }, [fetchStats]);

  const cpu = snapshot?.cpu;
  const ram = snapshot?.ram;
  const disk = snapshot?.disk_io;
  const net = snapshot?.network;
  const procs = snapshot?.processes || [];

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Monitor</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time CPU, RAM, disk I/O, and network — updated every 2 seconds</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
      </div>

      {/* Radial gauges row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card flex flex-col items-center py-4">
          <RadialGauge pct={cpu?.overall ?? 0} color={pctColor(cpu?.overall ?? 0)} label="CPU" sub={cpu ? `${cpu.core_count} cores` : ''} />
          <p className="text-xs text-slate-500 mt-2">{cpu?.freq_mhz ? `${cpu.freq_mhz} MHz` : ''}</p>
        </div>
        <div className="card flex flex-col items-center py-4">
          <RadialGauge pct={ram?.percent ?? 0} color={pctColor(ram?.percent ?? 0)} label="RAM" sub={ram ? formatBytes(ram.used) : ''} />
          <p className="text-xs text-slate-500 mt-2">{ram ? formatBytes(ram.total) + ' total' : ''}</p>
        </div>
        <div className="card flex flex-col items-center py-4">
          <div className="flex flex-col items-center gap-2">
            <HardDrive className="w-8 h-8 text-brand-400" />
            <p className="text-xl font-bold text-white">{disk ? formatBytes(disk.total_read_bps) + '/s' : '—'}</p>
            <p className="text-sm text-slate-400">Disk Read</p>
            <p className="text-xs text-slate-500">{disk ? formatBytes(disk.total_write_bps) + '/s write' : ''}</p>
          </div>
        </div>
        <div className="card flex flex-col items-center py-4">
          <div className="flex flex-col items-center gap-2">
            <Wifi className="w-8 h-8 text-purple-400" />
            <div className="text-center">
              <p className="flex items-center gap-1 text-sm text-green-400 font-semibold">
                <ArrowDown className="w-3.5 h-3.5" />{net ? formatBytes(net.recv_bps) + '/s' : '—'}
              </p>
              <p className="flex items-center gap-1 text-sm text-blue-400 font-semibold mt-1">
                <ArrowUp className="w-3.5 h-3.5" />{net ? formatBytes(net.sent_bps) + '/s' : '—'}
              </p>
            </div>
            <p className="text-sm text-slate-400">Network</p>
          </div>
        </div>
      </div>

      {/* Live charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-white">CPU Usage</span>
            <span className="ml-auto text-xs text-slate-500">{cpu?.overall ?? 0}%</span>
          </div>
          <SparkChart data={cpuHistory} dataKey="cpu" color="#3b82f6" />
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <MemoryStick className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">RAM Usage</span>
            <span className="ml-auto text-xs text-slate-500">{ram?.percent ?? 0}%</span>
          </div>
          <SparkChart data={ramHistory} dataKey="ram" color="#f59e0b" />
        </div>

        {/* Per-core bar */}
        {cpu?.per_core && cpu.per_core.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-white">Per-Core CPU</span>
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cpu.per_core.map((v, i) => ({ core: `C${i}`, pct: v }))} margin={{ top: 2, right: 4, left: 0, bottom: 2 }}>
                  <XAxis dataKey="core" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip content={<MiniTooltip />} />
                  <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                    {cpu.per_core.map((v, i) => <Cell key={i} fill={pctColor(v)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Network */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Network I/O</span>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={netRecvHistory.map((d, i) => ({ ...d, sent: netSentHistory[i]?.sent ?? 0 }))}
                margin={{ top: 2, right: 2, left: 0, bottom: 2 }}
              >
                <defs>
                  <linearGradient id="grad-recv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-sent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide />
                <YAxis hide />
                <Tooltip content={<MiniTooltip />} />
                <Area type="monotone" dataKey="recv" stroke="#10b981" fill="url(#grad-recv)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="sent" stroke="#3b82f6" fill="url(#grad-sent)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs mt-1">
            <span className="flex items-center gap-1 text-green-400"><ArrowDown className="w-3 h-3" />Download</span>
            <span className="flex items-center gap-1 text-blue-400"><ArrowUp className="w-3 h-3" />Upload</span>
          </div>
        </div>
      </div>

      {/* Top processes */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-white">Top Processes</h2>
          </div>
          <span className="text-xs text-slate-500">by CPU usage</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left pb-2 font-medium">PID</th>
                <th className="text-left pb-2 font-medium">Process</th>
                <th className="text-right pb-2 font-medium">CPU %</th>
                <th className="text-right pb-2 font-medium">Memory</th>
                <th className="text-left pb-2 font-medium pl-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {procs.map((p) => (
                <tr key={p.pid} className="hover:bg-slate-700/20 transition-colors">
                  <td className="py-2 text-slate-600 font-mono text-xs">{p.pid}</td>
                  <td className="py-2 text-slate-200 max-w-[160px] truncate">{p.name}</td>
                  <td className="py-2 text-right">
                    <span className={`font-semibold ${p.cpu_percent > 50 ? 'text-red-400' : p.cpu_percent > 20 ? 'text-yellow-400' : 'text-slate-300'}`}>
                      {p.cpu_percent}%
                    </span>
                  </td>
                  <td className="py-2 text-right text-slate-400">{formatBytes(p.memory_bytes)}</td>
                  <td className="py-2 pl-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === 'running' ? 'bg-green-500/15 text-green-400' : 'bg-slate-700/50 text-slate-500'
                    }`}>{p.status}</span>
                  </td>
                </tr>
              ))}
              {procs.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-slate-600 text-xs">Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RAM details */}
      {ram && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total RAM', value: formatBytes(ram.total), color: 'text-white' },
            { label: 'Used RAM', value: formatBytes(ram.used), color: ram.percent > 90 ? 'text-red-400' : ram.percent > 70 ? 'text-yellow-400' : 'text-green-400' },
            { label: 'Available', value: formatBytes(ram.available), color: 'text-green-400' },
            { label: 'Swap Used', value: formatBytes(ram.swap_used) + ' / ' + formatBytes(ram.swap_total), color: 'text-slate-400' },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <p className="stat-label">{s.label}</p>
              <p className={`text-lg font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
