import React, { useState } from 'react';
import {
  FolderMinus, FolderSymlink, HardDrive, Layers, Shuffle,
  RefreshCw, Trash2, ArrowRight, CheckCircle, AlertCircle,
  ChevronDown, ChevronRight, Play, X, MoveRight, Zap,
} from 'lucide-react';
import api from '../api';
import { formatBytes } from '../utils';
import useStore from '../store';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'empty',    label: 'Empty Folders',    icon: <FolderMinus   className="w-4 h-4" /> },
  { id: 'similar',  label: 'Similar Folders',  icon: <FolderSymlink className="w-4 h-4" /> },
  { id: 'chogs',    label: 'C: Drive Hogs',    icon: <HardDrive     className="w-4 h-4" /> },
  { id: 'ssd',      label: 'SSD/HDD Advisor',  icon: <Layers        className="w-4 h-4" /> },
  { id: 'scatter',  label: 'Scattered Files',  icon: <Shuffle       className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Reusable empty state
// ---------------------------------------------------------------------------
function EmptyState({ icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
      <div className="mb-3">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root path configuration shared across tabs
// ---------------------------------------------------------------------------
function ScanPathConfig({ paths, onChange }) {
  const [input, setInput] = useState('');
  const add = () => {
    const p = input.trim();
    if (p && !paths.includes(p)) onChange([...paths, p]);
    setInput('');
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {paths.map((p) => (
        <span key={p} className="inline-flex items-center gap-1 bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full">
          {p}
          <button onClick={() => onChange(paths.filter((x) => x !== p))} className="hover:text-red-400"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-brand-500 w-48"
        placeholder="Add path…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <button onClick={add} className="text-xs text-brand-400 hover:text-brand-300">+ Add</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Empty Folders tab
// ---------------------------------------------------------------------------
function EmptyFoldersTab({ scanPaths }) {
  const [folders, setFolders]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [result, setResult]     = useState(null);

  const scan = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await api.post('/optimizer/empty-folders/scan', { root_paths: scanPaths });
      setFolders(res.data.folders || []);
    } finally { setLoading(false); }
  };

  const deleteSelected = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} empty folder(s)?`)) return;
    setDeleting(true);
    try {
      const res = await api.post('/optimizer/empty-folders/delete', { paths: Array.from(selected) });
      setResult(res.data);
      setFolders((prev) => prev.filter((f) => !selected.has(f.path)));
      setSelected(new Set());
    } finally { setDeleting(false); }
  };

  const toggleAll = () => {
    setSelected(selected.size === folders.length ? new Set() : new Set(folders.map((f) => f.path)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Find and remove empty directories to keep your file tree clean.</p>
        <button onClick={scan} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Scan
        </button>
      </div>

      {result && (
        <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/40 rounded-lg text-green-300 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Deleted {result.deleted} folder(s). {result.errors?.length > 0 && `${result.errors.length} error(s).`}
        </div>
      )}

      {folders.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <button onClick={toggleAll} className="text-xs text-brand-400 hover:text-brand-300">
              {selected.size === folders.length ? 'Deselect all' : 'Select all'}
            </button>
            {selected.size > 0 && (
              <button onClick={deleteSelected} disabled={deleting} className="btn-danger flex items-center gap-1 text-xs py-1 px-3">
                <Trash2 className="w-3.5 h-3.5" /> Delete {selected.size}
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {folders.map((f) => (
              <div
                key={f.path}
                onClick={() => setSelected((prev) => {
                  const n = new Set(prev);
                  n.has(f.path) ? n.delete(f.path) : n.add(f.path);
                  return n;
                })}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selected.has(f.path) ? 'bg-brand-600/20 border border-brand-600/40' : 'bg-slate-800/50 hover:bg-slate-700/40'
                }`}
              >
                <input type="checkbox" className="accent-brand-600" readOnly checked={selected.has(f.path)} />
                <FolderMinus className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="text-sm text-slate-300 truncate flex-1">{f.name}</span>
                <span className="text-xs text-slate-600 truncate max-w-[200px]">{f.parent}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && folders.length === 0 && (
        <EmptyState icon={<FolderMinus className="w-10 h-10" />} message="Scan to find empty folders" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Similar Folders tab
// ---------------------------------------------------------------------------
function SimilarFoldersTab({ scanPaths }) {
  const [groups, setGroups]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [merging, setMerging]   = useState(null);
  const [preview, setPreview]   = useState(null);
  const [mergeResult, setMergeResult] = useState(null);

  const scan = async () => {
    setLoading(true); setGroups([]); setPreview(null); setMergeResult(null);
    try {
      const res = await api.post('/optimizer/similar-folders/scan', { root_paths: scanPaths });
      setGroups(res.data.groups || []);
    } finally { setLoading(false); }
  };

  const previewMerge = async (src, dst) => {
    setMerging({ src, dst });
    try {
      const res = await api.post('/optimizer/merge-folders', { source: src, destination: dst, dry_run: true });
      setPreview(res.data);
    } catch (e) {
      setPreview({ error: e.response?.data?.detail || 'Preview failed' });
    }
  };

  const executeMerge = async () => {
    if (!merging) return;
    if (!window.confirm(`Move all files from "${merging.src}" into "${merging.dst}" and remove the source folder?`)) return;
    try {
      const res = await api.post('/optimizer/merge-folders', { source: merging.src, destination: merging.dst, dry_run: false });
      setMergeResult(res.data);
      setPreview(null);
    } catch (e) {
      setMergeResult({ error: e.response?.data?.detail || 'Merge failed' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Detect folders with similar names (e.g. Movies + Films) and merge them into one.
        </p>
        <button onClick={scan} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Scan
        </button>
      </div>

      {mergeResult && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
          mergeResult.error ? 'bg-red-900/20 border border-red-700/40 text-red-300' : 'bg-green-900/20 border border-green-700/40 text-green-300'
        }`}>
          {mergeResult.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {mergeResult.error || `Merged ${mergeResult.moved} files successfully.`}
        </div>
      )}

      {groups.length > 0 && groups.map((grp, gi) => {
        const isExpanded = expanded.has(gi);
        return (
          <div key={gi} className="card">
            <button
              className="flex items-center gap-3 w-full text-left"
              onClick={() => setExpanded((prev) => {
                const n = new Set(prev);
                n.has(gi) ? n.delete(gi) : n.add(gi);
                return n;
              })}
            >
              <FolderSymlink className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-sm font-medium text-white flex-1">
                {grp.folders.map((f) => f.name).join(' · ')}
              </span>
              <span className="text-xs text-slate-500">{grp.folders.length} similar folders</span>
              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-2">
                {grp.folders.map((f) => (
                  <div key={f.path} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2">
                    <HardDrive className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="text-sm text-slate-300 flex-1 truncate">{f.path}</span>
                    <span className="text-xs text-slate-500 flex-shrink-0">{formatBytes(f.size_bytes)}</span>
                  </div>
                ))}

                {grp.folders.length >= 2 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-500">Merge</span>
                    <select
                      className="bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none border border-slate-600"
                      id={`src-${gi}`}
                      defaultValue={grp.folders[0].path}
                    >
                      {grp.folders.map((f) => <option key={f.path} value={f.path}>{f.name} ({formatBytes(f.size_bytes)})</option>)}
                    </select>
                    <ArrowRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <select
                      className="bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none border border-slate-600"
                      id={`dst-${gi}`}
                      defaultValue={grp.folders[1].path}
                    >
                      {grp.folders.map((f) => <option key={f.path} value={f.path}>{f.name} ({formatBytes(f.size_bytes)})</option>)}
                    </select>
                    <button
                      onClick={() => {
                        const src = document.getElementById(`src-${gi}`)?.value;
                        const dst = document.getElementById(`dst-${gi}`)?.value;
                        if (src && dst && src !== dst) previewMerge(src, dst);
                      }}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      Preview Merge
                    </button>
                  </div>
                )}

                {preview && merging && merging.src === grp.folders[0]?.path && (
                  <div className="mt-2 bg-slate-900/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-slate-300">
                      {preview.moved} file(s) will be moved
                      {preview.error && <span className="text-red-400"> — Error: {preview.error}</span>}
                    </p>
                    {!preview.error && (
                      <button onClick={executeMerge} className="btn-primary text-xs py-1 px-3 flex items-center gap-1">
                        <MoveRight className="w-3.5 h-3.5" /> Execute Merge
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!loading && groups.length === 0 && (
        <EmptyState icon={<FolderSymlink className="w-10 h-10" />} message="Scan to detect similar folders" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. C: Drive Hogs tab
// ---------------------------------------------------------------------------
function CDriveHogsTab() {
  const [hogs, setHogs]       = useState([]);
  const [loading, setLoading] = useState(false);

  const scan = async () => {
    setLoading(true);
    try {
      const res = await api.get('/optimizer/c-drive-hogs');
      setHogs(res.data.hogs || []);
    } finally { setLoading(false); }
  };

  const totalSize = hogs.reduce((s, h) => s + h.size_bytes, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Find large data folders on your C: drive that can be moved to another drive to speed up your system.
        </p>
        <button onClick={scan} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Scan C: Drive
        </button>
      </div>

      {hogs.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="stat-label">Total reclaimable</p>
              <p className="stat-value text-yellow-400">{formatBytes(totalSize)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Folders found</p>
              <p className="stat-value">{hogs.length}</p>
            </div>
          </div>

          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {hogs.map((h) => (
              <div key={h.path} className="flex items-center gap-3 bg-slate-800/50 hover:bg-slate-700/40 rounded-lg px-3 py-2.5 transition-colors">
                <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium">{h.name}</p>
                  <p className="text-xs text-slate-500 truncate">{h.path}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-yellow-400">{formatBytes(h.size_bytes)}</p>
                  <p className="text-xs text-slate-600">moveable</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && hogs.length === 0 && (
        <EmptyState icon={<HardDrive className="w-10 h-10" />} message="Scan to identify large folders on C: drive" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. SSD/HDD Advisor tab
// ---------------------------------------------------------------------------
function SSDAdvisorTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  const scan = async () => {
    setLoading(true);
    try {
      const res = await api.get('/optimizer/drive-placement');
      setData(res.data);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Detect SSD and HDD drives and get recommendations for optimal file placement.
        </p>
        <button onClick={scan} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Analyse Drives
        </button>
      </div>

      {data && (
        <>
          {/* Drive list */}
          <div className="grid grid-cols-2 gap-3">
            {data.drives?.map((d) => (
              <div key={d.path} className="card flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  d.drive_type === 'SSD' ? 'bg-green-400' : d.drive_type === 'HDD' ? 'bg-blue-400' : 'bg-slate-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{d.path}</p>
                  <p className="text-xs text-slate-500">{d.drive_type} · {formatBytes(d.free_bytes)} free</p>
                </div>
                <span className={`badge text-xs ${
                  d.drive_type === 'SSD' ? 'badge-green' : d.drive_type === 'HDD' ? 'badge-blue' : 'badge-yellow'
                }`}>{d.drive_type}</span>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {data.recommendations?.map((rec, i) => (
            <div key={i} className={`card border ${
              rec.type === 'ok' ? 'border-green-600/30 bg-green-900/10' :
              rec.type === 'move_media_to_hdd' ? 'border-yellow-600/30 bg-yellow-900/10' :
              'border-slate-700/50'
            }`}>
              <div className="flex items-start gap-3">
                <Zap className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  rec.type === 'ok' ? 'text-green-400' : 'text-yellow-400'
                }`} />
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{rec.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{rec.description}</p>
                  {rec.files?.length > 0 && (
                    <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                      {rec.files.slice(0, 15).map((f) => (
                        <div key={f.path} className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="truncate flex-1">{f.name}</span>
                          <span className="text-slate-500 flex-shrink-0">{formatBytes(f.size_bytes)}</span>
                          <ArrowRight className="w-3 h-3 flex-shrink-0" />
                          <span className="text-slate-500 flex-shrink-0">{f.suggested_drive}</span>
                        </div>
                      ))}
                      {rec.files.length > 15 && (
                        <p className="text-xs text-slate-600">+ {rec.files.length - 15} more</p>
                      )}
                    </div>
                  )}
                </div>
                {rec.potential_savings > 0 && (
                  <span className="text-sm font-semibold text-yellow-400 flex-shrink-0">
                    {formatBytes(rec.potential_savings)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {!data && !loading && (
        <EmptyState icon={<Layers className="w-10 h-10" />} message="Analyse your drives to get placement recommendations" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Scattered Files tab
// ---------------------------------------------------------------------------
function ScatteredFilesTab({ scanPaths }) {
  const [files, setFiles]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [consolidating, setConsolidating] = useState(false);
  const [result, setResult]   = useState(null);

  const scan = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await api.post('/optimizer/scattered-files/scan', { root_paths: scanPaths });
      setFiles(res.data.files || []);
    } finally { setLoading(false); }
  };

  const consolidate = async () => {
    const selFiles = files.filter((f) => selected.has(f.path));
    if (!selFiles.length) return;

    // Group by suggested destination and consolidate each group
    const byDest = {};
    for (const f of selFiles) {
      if (!byDest[f.suggested_destination]) byDest[f.suggested_destination] = [];
      byDest[f.suggested_destination].push(f.path);
    }

    setConsolidating(true);
    try {
      for (const [dest, paths] of Object.entries(byDest)) {
        await api.post('/optimizer/scattered-files/consolidate', { paths, destination: dest });
      }
      setResult({ moved: selFiles.length });
      setFiles((prev) => prev.filter((f) => !selected.has(f.path)));
      setSelected(new Set());
    } finally { setConsolidating(false); }
  };

  const totalSize = files.filter((f) => selected.has(f.path)).reduce((s, f) => s + f.size_bytes, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Find media files scattered outside standard library folders and consolidate them.
        </p>
        <button onClick={scan} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Scan
        </button>
      </div>

      {result && (
        <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/40 rounded-lg text-green-300 text-sm">
          <CheckCircle className="w-4 h-4" /> Moved {result.moved} file(s) to their library folders.
        </div>
      )}

      {files.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelected(selected.size === files.length ? new Set() : new Set(files.map((f) => f.path)))}
              className="text-xs text-brand-400 hover:text-brand-300"
            >
              {selected.size === files.length ? 'Deselect all' : 'Select all'}
            </button>
            {selected.size > 0 && (
              <button onClick={consolidate} disabled={consolidating} className="btn-primary flex items-center gap-1 text-xs py-1 px-3">
                {consolidating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MoveRight className="w-3.5 h-3.5" />}
                Consolidate {selected.size} ({formatBytes(totalSize)})
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {files.map((f) => (
              <div
                key={f.path}
                onClick={() => setSelected((prev) => { const n = new Set(prev); n.has(f.path) ? n.delete(f.path) : n.add(f.path); return n; })}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selected.has(f.path) ? 'bg-brand-600/20 border border-brand-600/40' : 'bg-slate-800/50 hover:bg-slate-700/40'
                }`}
              >
                <input type="checkbox" className="accent-brand-600" readOnly checked={selected.has(f.path)} />
                <span className="text-lg flex-shrink-0">{
                  f.extension?.match(/mp3|flac|wav|ogg|m4a/) ? '🎵' :
                  f.extension?.match(/mp4|mkv|avi|mov/) ? '🎬' : '🖼️'
                }</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{f.name}</p>
                  <p className="text-xs text-slate-500 truncate">{f.path}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 text-xs text-slate-500">
                  <ArrowRight className="w-3 h-3" />
                  <span className="truncate max-w-[100px]">{f.suggested_destination}</span>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{formatBytes(f.size_bytes)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && files.length === 0 && (
        <EmptyState icon={<Shuffle className="w-10 h-10" />} message="Scan to find scattered media files" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SmartOptimizerPage() {
  const { drives } = useStore();
  const [activeTab, setActiveTab] = useState('empty');
  const [scanPaths, setScanPaths] = useState(() =>
    drives.map((d) => d.path || d.mount_point || '').filter(Boolean)
  );

  // Sync scan paths when drives load
  React.useEffect(() => {
    if (drives.length && !scanPaths.length) {
      setScanPaths(drives.map((d) => d.path || d.mount_point || '').filter(Boolean));
    }
  }, [drives]);

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Smart Optimizer</h1>
        <p className="text-slate-400 text-sm mt-1">
          Intelligent analysis and cleanup — empty folders, duplicate structures, drive placement, and more.
        </p>
      </div>

      {/* Scan paths */}
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Scan locations</p>
        <ScanPathConfig paths={scanPaths} onChange={setScanPaths} />
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
      <div className="card min-h-[300px]">
        {activeTab === 'empty'   && <EmptyFoldersTab  scanPaths={scanPaths} />}
        {activeTab === 'similar' && <SimilarFoldersTab scanPaths={scanPaths} />}
        {activeTab === 'chogs'   && <CDriveHogsTab />}
        {activeTab === 'ssd'     && <SSDAdvisorTab />}
        {activeTab === 'scatter' && <ScatteredFilesTab scanPaths={scanPaths} />}
      </div>
    </div>
  );
}
