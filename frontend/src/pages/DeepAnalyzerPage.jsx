import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Treemap,
} from 'recharts';
import {
  Search, RefreshCw, Trash2, FileWarning, Clock,
  BarChart2, PieChart as PieIcon, Layers, FolderTree,
  Play, ChevronRight, X, CheckCircle, AlertCircle,
} from 'lucide-react';
import api from '../api';
import { formatBytes, formatRelativeDate, CATEGORY_COLORS } from '../utils';
import useStore from '../store';

// ---------------------------------------------------------------------------
// Custom Tooltip for recharts
// ---------------------------------------------------------------------------
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#94a3b8' }} className="font-medium">
          {formatBytes(p.value)}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Treemap content renderer
// ---------------------------------------------------------------------------
const TREEMAP_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
  '#f59e0b', '#ef4444', '#14b8a6', '#f97316', '#a855f7',
];

function TreemapContent({ x, y, width, height, name, size, depth, index }) {
  if (width < 40 || height < 25) return null;
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        fill={TREEMAP_COLORS[index % TREEMAP_COLORS.length]}
        fillOpacity={0.85 - depth * 0.1}
        stroke="#0f172a"
        strokeWidth={2}
      />
      {width > 60 && height > 30 && (
        <>
          <text x={x + 8} y={y + 16} fill="#fff" fontSize={11} fontWeight={600}
            style={{ pointerEvents: 'none' }}>
            {name?.length > 14 ? name.slice(0, 14) + '…' : name}
          </text>
          {height > 42 && (
            <text x={x + 8} y={y + 30} fill="rgba(255,255,255,0.6)" fontSize={10}
              style={{ pointerEvents: 'none' }}>
              {formatBytes(size)}
            </text>
          )}
        </>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'largest',   label: 'Largest Files',  icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'ext',       label: 'By Extension',   icon: <PieIcon   className="w-4 h-4" /> },
  { id: 'age',       label: 'File Age',       icon: <Clock     className="w-4 h-4" /> },
  { id: 'orphans',   label: 'Orphaned Files', icon: <FileWarning className="w-4 h-4" /> },
  { id: 'tree',      label: 'Folder Tree',    icon: <FolderTree className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Orphaned files panel
// ---------------------------------------------------------------------------
function OrphansPanel({ files, onDeleted }) {
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(null);

  const toggleAll = () =>
    setSelected(selected.size === files.length ? new Set() : new Set(files.map((f) => f.path)));

  const deleteSelected = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Send ${selected.size} file(s) to Recycle Bin?`)) return;
    setDeleting(true);
    try {
      await api.post('/files/delete', { paths: Array.from(selected) });
      setDone(selected.size);
      onDeleted(Array.from(selected));
      setSelected(new Set());
    } finally { setDeleting(false); }
  };

  const totalSelected = files.filter((f) => selected.has(f.path)).reduce((s, f) => s + f.size_bytes, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={toggleAll} className="text-xs text-brand-400 hover:text-brand-300">
          {selected.size === files.length ? 'Deselect all' : `Select all (${files.length})`}
        </button>
        {selected.size > 0 && (
          <button onClick={deleteSelected} disabled={deleting} className="btn-danger flex items-center gap-1 text-xs py-1 px-3">
            {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete {selected.size} ({formatBytes(totalSelected)})
          </button>
        )}
      </div>

      {done && (
        <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700/40 rounded-lg text-green-300 text-xs">
          <CheckCircle className="w-4 h-4" /> Sent {done} file(s) to Recycle Bin.
        </div>
      )}

      <div className="space-y-1 max-h-[45vh] overflow-y-auto">
        {files.map((f) => (
          <div
            key={f.path}
            onClick={() => setSelected((prev) => { const n = new Set(prev); n.has(f.path) ? n.delete(f.path) : n.add(f.path); return n; })}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selected.has(f.path) ? 'bg-brand-600/15 border border-brand-600/30' : 'bg-slate-800/40 hover:bg-slate-700/40'
            }`}
          >
            <input type="checkbox" className="accent-brand-600" readOnly checked={selected.has(f.path)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate">{f.name}</p>
              <p className="text-xs text-slate-500 truncate">{f.path}</p>
            </div>
            <span className="badge badge-yellow text-xs flex-shrink-0">{f.reason}</span>
            <span className="text-sm text-slate-400 flex-shrink-0">{formatBytes(f.size_bytes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DeepAnalyzerPage() {
  const { drives } = useStore();
  const [scanPaths, setScanPaths] = useState([]);
  const [inputPath, setInputPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('largest');

  const [largestFiles, setLargestFiles]   = useState([]);
  const [extStats, setExtStats]           = useState([]);
  const [ageDist, setAgeDist]             = useState([]);
  const [orphans, setOrphans]             = useState([]);
  const [treePath, setTreePath]           = useState('');
  const [treeData, setTreeData]           = useState(null);
  const [treeLoading, setTreeLoading]     = useState(false);

  useEffect(() => {
    if (drives.length && !scanPaths.length) {
      const p = (drives[0]?.path || drives[0]?.mount_point || '');
      setScanPaths(p ? [p] : []);
      setTreePath(p);
    }
  }, [drives]);

  const addPath = () => {
    const p = inputPath.trim();
    if (p && !scanPaths.includes(p)) setScanPaths((prev) => [...prev, p]);
    setInputPath('');
  };

  const runAnalysis = async () => {
    if (!scanPaths.length) return;
    setLoading(true);
    try {
      const res = await api.post('/analyzer/run', { root_paths: scanPaths }, { params: { top_files: 100 } });
      setLargestFiles(res.data.largest_files || []);
      setExtStats(res.data.extension_stats || []);
      setAgeDist(res.data.age_distribution || []);
      setOrphans(res.data.orphaned_files || []);
    } finally { setLoading(false); }
  };

  const loadTree = async () => {
    if (!treePath) return;
    setTreeLoading(true);
    try {
      const res = await api.get('/analyzer/folder-tree', { params: { root_path: treePath, depth: 3 } });
      setTreeData(res.data);
    } finally { setTreeLoading(false); }
  };

  const totalScanned = largestFiles.length > 0
    ? `${largestFiles.length} largest files · ${formatBytes(largestFiles.reduce((s, f) => s + f.size_bytes, 0))}`
    : '';

  // Top 20 extensions for chart
  const topExt = extStats.slice(0, 20).map((e) => ({
    name: e.extension,
    size: e.size_bytes,
    count: e.count,
  }));

  // Pie data: category breakdown of largest files
  const catMap = {};
  for (const f of largestFiles) {
    catMap[f.category] = (catMap[f.category] || 0) + f.size_bytes;
  }
  const pieData = Object.entries(catMap).map(([name, value]) => ({
    name, value, color: CATEGORY_COLORS[name] || '#64748b',
  }));

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Deep File Analyzer</h1>
        <p className="text-slate-400 text-sm mt-1">
          Comprehensive breakdown of your storage — largest files, extension stats, file age, orphaned files, and folder tree.
        </p>
      </div>

      {/* Scan config */}
      <div className="card">
        <div className="flex items-center gap-3 flex-wrap">
          {scanPaths.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full">
              {p}
              <button onClick={() => setScanPaths((prev) => prev.filter((x) => x !== p))} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-brand-500 w-48"
            placeholder="Add path…"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPath()}
          />
          <button onClick={addPath} className="text-xs text-brand-400 hover:text-brand-300">+ Add</button>
          <button
            onClick={runAnalysis}
            disabled={loading || !scanPaths.length}
            className="ml-auto btn-primary flex items-center gap-2 text-sm"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Analyzing…' : 'Run Analysis'}
          </button>
        </div>
        {totalScanned && <p className="text-xs text-slate-500 mt-2">{totalScanned}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              activeTab === t.id
                ? 'bg-brand-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card min-h-[350px]">

        {/* Largest files */}
        {activeTab === 'largest' && (
          <div className="space-y-4">
            {largestFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                <BarChart2 className="w-10 h-10 mb-2" />
                <p className="text-sm">Run analysis to see largest files</p>
              </div>
            ) : (
              <>
                {/* Bar chart: top 15 */}
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={largestFiles.slice(0, 15)} layout="vertical" margin={{ left: 0, right: 40 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={160}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickFormatter={(v) => v.length > 22 ? v.slice(0, 22) + '…' : v}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="size_bytes" radius={[0, 4, 4, 0]}>
                        {largestFiles.slice(0, 15).map((_, i) => (
                          <Cell key={i} fill={TREEMAP_COLORS[i % TREEMAP_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Category pie */}
                {pieData.length > 0 && (
                  <div className="flex items-center gap-6">
                    <div className="w-40 h-40 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={60}>
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => formatBytes(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-1.5">
                      {pieData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 text-sm">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-slate-400 text-xs">{d.name}</span>
                          <span className="text-slate-300 text-xs ml-auto">{formatBytes(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File list */}
                <div className="divide-y divide-slate-700/40 max-h-[40vh] overflow-y-auto">
                  {largestFiles.map((f) => (
                    <div key={f.path} className="flex items-center gap-3 py-2 hover:bg-slate-700/20 px-2 rounded">
                      <span className="text-lg flex-shrink-0">
                        {f.category === 'Videos' ? '🎬' : f.category === 'Music' ? '🎵' :
                         f.category === 'Images' ? '🖼️' : f.category === 'Documents' ? '📄' :
                         f.category === 'Archives' ? '📦' : '📁'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{f.name}</p>
                        <p className="text-xs text-slate-500 truncate">{f.path}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-200">{formatBytes(f.size_bytes)}</p>
                        <p className="text-xs text-slate-500">{formatRelativeDate(f.modified)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Extension stats */}
        {activeTab === 'ext' && (
          <div className="space-y-4">
            {extStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                <PieIcon className="w-10 h-10 mb-2" />
                <p className="text-sm">Run analysis to see extension breakdown</p>
              </div>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topExt} layout="vertical" margin={{ left: 0, right: 60 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={80}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="size" radius={[0, 4, 4, 0]}>
                        {topExt.map((_, i) => <Cell key={i} fill={TREEMAP_COLORS[i % TREEMAP_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {extStats.map((e) => (
                    <div key={e.extension} className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-1.5">
                      <span className="text-xs font-mono text-slate-300">{e.extension}</span>
                      <div className="text-right text-xs">
                        <span className="text-slate-300">{formatBytes(e.size_bytes)}</span>
                        <span className="text-slate-600 ml-1">({e.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Age distribution */}
        {activeTab === 'age' && (
          <div className="space-y-4">
            {ageDist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                <Clock className="w-10 h-10 mb-2" />
                <p className="text-sm">Run analysis to see file age distribution</p>
              </div>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageDist} margin={{ left: 0, right: 20, bottom: 20 }}>
                      <XAxis dataKey="age" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-15} textAnchor="end" />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="size_bytes" radius={[4, 4, 0, 0]}>
                        {ageDist.map((_, i) => <Cell key={i} fill={TREEMAP_COLORS[i % TREEMAP_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {ageDist.map((b) => (
                    <div key={b.age} className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500">{b.age}</p>
                      <p className="text-sm font-semibold text-white mt-1">{formatBytes(b.size_bytes)}</p>
                      <p className="text-xs text-slate-600">{b.count} files</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Orphaned files */}
        {activeTab === 'orphans' && (
          orphans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <FileWarning className="w-10 h-10 mb-2" />
              <p className="text-sm">Run analysis to detect orphaned files</p>
            </div>
          ) : (
            <OrphansPanel
              files={orphans}
              onDeleted={(paths) => setOrphans((prev) => prev.filter((f) => !paths.includes(f.path)))}
            />
          )
        )}

        {/* Folder tree */}
        {activeTab === 'tree' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Enter folder path to visualize, e.g. C:\Users\You\Documents"
                value={treePath}
                onChange={(e) => setTreePath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadTree()}
              />
              <button onClick={loadTree} disabled={treeLoading} className="btn-primary flex items-center gap-2 text-sm">
                {treeLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Visualize
              </button>
            </div>

            {treeData && (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={treeData.children || [treeData]}
                    dataKey="size"
                    nameKey="name"
                    content={<TreemapContent />}
                  />
                </ResponsiveContainer>
              </div>
            )}

            {!treeData && !treeLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                <FolderTree className="w-10 h-10 mb-2" />
                <p className="text-sm">Enter a folder path and click Visualize</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
