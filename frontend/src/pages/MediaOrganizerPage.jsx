import React, { useEffect, useState } from 'react';
import {
  Music, Film, Image, RefreshCw, Play, CheckCircle,
  FolderOpen, ChevronRight, AlertCircle, X,
} from 'lucide-react';
import api from '../api';
import { formatBytes } from '../utils';
import useStore from '../store';

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------
const CATEGORIES = [
  { id: 'Music',    label: 'Music',    icon: <Music  className="w-5 h-5" />, color: 'text-green-400',  bg: 'bg-green-400/10'  },
  { id: 'Videos',   label: 'Videos',   icon: <Film   className="w-5 h-5" />, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { id: 'Pictures', label: 'Pictures', icon: <Image  className="w-5 h-5" />, color: 'text-pink-400',   bg: 'bg-pink-400/10'   },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MediaOrganizerPage() {
  const { drives } = useStore();

  const [scanPaths, setScanPaths]     = useState([]);
  const [customPath, setCustomPath]   = useState('');
  const [selCats, setSelCats]         = useState(['Music', 'Videos', 'Pictures']);

  const [preview, setPreview]         = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [organizeResult, setOrganizeResult] = useState(null);
  const [organizing, setOrganizing]   = useState(false);

  const [libraryStats, setLibraryStats] = useState(null);
  const [error, setError]             = useState('');

  // Pre-populate scan paths from detected drives
  useEffect(() => {
    if (drives.length > 0 && scanPaths.length === 0) {
      setScanPaths(drives.map((d) => d.path || d.mount_point || d.drive_path || '').filter(Boolean));
    }
  }, [drives]);

  // Load library stats on mount
  useEffect(() => {
    api.get('/media/library-stats').then((res) => setLibraryStats(res.data)).catch(() => {});
  }, [organizeResult]);

  // -------------------------------------------------------------------------
  const toggleCat = (cat) =>
    setSelCats((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);

  const addCustomPath = () => {
    const p = customPath.trim();
    if (p && !scanPaths.includes(p)) setScanPaths((prev) => [...prev, p]);
    setCustomPath('');
  };

  const removePath = (p) => setScanPaths((prev) => prev.filter((x) => x !== p));

  // -------------------------------------------------------------------------
  const handlePreview = async () => {
    if (!scanPaths.length || !selCats.length) return;
    setPreviewLoading(true);
    setError('');
    setOrganizeResult(null);
    try {
      const res = await api.post('/media/preview', { scan_paths: scanPaths, categories: selCats });
      setPreview(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Preview failed.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOrganize = async () => {
    if (!preview) return;
    if (!window.confirm(
      `This will move ${preview.total_files} files into your Windows library folders.\n\nContinue?`
    )) return;
    setOrganizing(true);
    setError('');
    try {
      const res = await api.post('/media/organize', {
        scan_paths: scanPaths,
        categories: selCats,
        dry_run: false,
      });
      setOrganizeResult(res.data);
      setPreview(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Organization failed.');
    } finally {
      setOrganizing(false);
    }
  };

  // -------------------------------------------------------------------------
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Media Organizer</h1>
        <p className="text-slate-400 text-sm mt-1">
          Automatically sort your music, videos, and photos into the standard Windows library folders.
        </p>
      </div>

      {/* Library Stats */}
      {libraryStats && (
        <div className="grid grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => {
            const stat = libraryStats[cat.id];
            return (
              <div key={cat.id} className={`card p-4 flex items-center gap-4 ${cat.bg} border border-slate-700/50`}>
                <span className={cat.color}>{cat.icon}</span>
                <div>
                  <p className="text-xs text-slate-400">{cat.label} library</p>
                  {stat?.exists ? (
                    <>
                      <p className="text-white font-semibold">{formatBytes(stat.size_bytes)}</p>
                      <p className="text-xs text-slate-500">{stat.count} files</p>
                    </>
                  ) : (
                    <p className="text-slate-500 text-sm">Empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Configuration */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Configuration</h2>

        {/* Categories */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Categories to organize</p>
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => toggleCat(cat.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selCats.includes(cat.id)
                    ? 'bg-brand-600/20 border-brand-500 text-brand-300'
                    : 'border-slate-700 text-slate-500 hover:text-white'
                }`}
              >
                <span className={cat.color}>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scan paths */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Scan locations</p>
          <div className="space-y-1">
            {scanPaths.map((p) => (
              <div key={p} className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-1.5">
                <span className="text-sm text-slate-300 truncate flex-1">{p}</span>
                <button onClick={() => removePath(p)} className="ml-2 text-slate-500 hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Add a custom path, e.g. D:\\"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomPath()}
            />
            <button onClick={addCustomPath} className="btn-ghost px-3 py-1.5 text-sm">Add</button>
          </div>
        </div>

        <button
          onClick={handlePreview}
          disabled={previewLoading || !scanPaths.length || !selCats.length}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {previewLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Preview
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Organize result */}
      {organizeResult && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <h2 className="font-semibold">Organization Complete!</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(organizeResult.results).map(([cat, info]) => (
              <div key={cat} className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-sm font-medium text-white">{cat}</p>
                <p className="text-xs text-green-400 mt-1">✓ {info.moved} moved</p>
                {info.skipped > 0 && <p className="text-xs text-slate-500">⏭ {info.skipped} skipped</p>}
                {info.errors.length > 0 && <p className="text-xs text-red-400">✗ {info.errors.length} errors</p>}
                <p className="text-xs text-slate-500 mt-1 truncate">{info.destination}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview results */}
      {preview && !organizeResult && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">Preview</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {preview.total_files} files · {formatBytes(preview.total_bytes)} will be organized
              </p>
            </div>
            <button
              onClick={handleOrganize}
              disabled={organizing || preview.total_files === 0}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {organizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
              Organize Now
            </button>
          </div>

          {preview.total_files === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">
              No media files found in the selected locations that need organizing.
            </p>
          )}

          {Object.entries(preview.categories).map(([cat, info]) => {
            const catConfig = CATEGORIES.find((c) => c.id === cat);
            return info.count === 0 ? null : (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={catConfig?.color}>{catConfig?.icon}</span>
                  <span className="text-sm font-medium text-slate-200">{cat}</span>
                  <span className="text-xs text-slate-500">
                    {info.count} files · {formatBytes(info.total_bytes)}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span className="text-xs text-slate-500 truncate">{info.destination}</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {info.preview.slice(0, 20).map((item) => (
                    <div key={item.path} className="flex items-center justify-between py-0.5 px-2 rounded text-xs text-slate-400 hover:bg-slate-700/30">
                      <span className="truncate flex-1">{item.name}</span>
                      <span className="text-slate-600 ml-2">{formatBytes(item.size_bytes)}</span>
                    </div>
                  ))}
                  {info.count > 20 && (
                    <p className="text-xs text-slate-600 px-2 py-1">
                      + {info.count - 20} more files…
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
