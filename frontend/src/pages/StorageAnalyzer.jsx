import React, { useEffect, useState } from 'react';
import { HardDrive, RefreshCw, Loader2 } from 'lucide-react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../api';
import useStore from '../store';
import { formatBytes, CATEGORY_COLORS, CATEGORY_ICONS } from '../utils';

const COLORS = ['#6366f1', '#3b82f6', '#ec4899', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#f97316', '#64748b'];

function ScanPanel({ drives, onScanStart, scanning }) {
  const [selected, setSelected] = useState(drives.map((d) => d.path));

  useEffect(() => {
    setSelected(drives.map((d) => d.path));
  }, [drives]);

  const toggle = (p) => setSelected((prev) =>
    prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
  );

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-3">Select Drives to Analyze</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {drives.map((d) => (
          <button
            key={d.path}
            onClick={() => toggle(d.path)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors
              ${selected.includes(d.path) ? 'border-brand-500 bg-brand-600/20 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            {d.label || d.path}
            <span className="text-xs text-slate-400">({formatBytes(d.total_bytes)})</span>
          </button>
        ))}
      </div>
      <button
        disabled={scanning || selected.length === 0}
        onClick={() => onScanStart(selected)}
        className="btn-primary flex items-center gap-2 disabled:opacity-50"
      >
        {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {scanning ? 'Scanning…' : 'Scan Now'}
      </button>
    </div>
  );
}

export default function StorageAnalyzer() {
  const { drives, startScan, pollScanStatus } = useStore();
  const [scanning, setScanning] = useState(false);
  const [categories, setCategories] = useState([]);
  const [topFiles, setTopFiles] = useState([]);
  const [filesFound, setFilesFound] = useState(0);

  const loadData = async () => {
    try {
      const [catRes, filesRes] = await Promise.all([
        api.get('/files/categories'),
        api.get('/files/top?limit=50'),
      ]);
      setCategories(catRes.data.categories || []);
      setTopFiles(filesRes.data.files || []);
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleScanStart = async (drivePaths) => {
    setScanning(true);
    setFilesFound(0);
    try {
      const sid = await startScan(drivePaths);
      const poll = setInterval(async () => {
        const s = await pollScanStatus(sid);
        if (s) setFilesFound(s.files_found || 0);
        if (s?.status === 'complete') {
          clearInterval(poll);
          setScanning(false);
          loadData();
        }
      }, 1500);
    } catch {
      setScanning(false);
    }
  };

  const treemapData = categories.map((c, i) => ({
    name: `${CATEGORY_ICONS[c.category] || ''} ${c.category}`,
    size: c.total_bytes,
    fill: CATEGORY_COLORS[c.category] || COLORS[i % COLORS.length],
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Disk Space Analyzer</h1>
        <p className="text-slate-400 text-sm">Visual breakdown of storage consumption across all drives.</p>
      </div>

      <ScanPanel drives={drives} onScanStart={handleScanStart} scanning={scanning} />

      {scanning && (
        <div className="card text-center py-6">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin mx-auto mb-2" />
          <p className="text-slate-300 font-medium">Scanning…</p>
          <p className="text-slate-400 text-sm mt-1">{filesFound.toLocaleString()} files found so far</p>
        </div>
      )}

      {/* Treemap */}
      {categories.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Storage Breakdown</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                content={({ x, y, width, height, name, fill, size }) => {
                  if (width < 40 || height < 20) return null;
                  return (
                    <g>
                      <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />
                      <text x={x + 6} y={y + 16} fill="white" fontSize={11} fontWeight="500">
                        {name}
                      </text>
                      {height > 35 && (
                        <text x={x + 6} y={y + 30} fill="rgba(255,255,255,0.7)" fontSize={10}>
                          {formatBytes(size)}
                        </text>
                      )}
                    </g>
                  );
                }}
              />
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category list */}
      {categories.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-3">By Category</h2>
          <div className="divide-y divide-slate-700/50">
            {categories.map((c) => (
              <div key={c.category} className="flex items-center gap-3 py-3">
                <span className="text-xl w-7 text-center">{CATEGORY_ICONS[c.category] || '📁'}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-200 font-medium">{c.category}</span>
                    <span className="text-slate-400">{formatBytes(c.total_bytes)}</span>
                  </div>
                  <div className="text-xs text-slate-500">{c.file_count?.toLocaleString()} files</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 50 largest files */}
      {topFiles.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-3">Top {topFiles.length} Largest Files</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {topFiles.map((f, i) => (
              <div key={f.path} className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-700/50 last:border-0">
                <span className="text-slate-500 w-6 text-right flex-shrink-0">{i + 1}</span>
                <span className="flex-shrink-0">{CATEGORY_ICONS[f.category] || '📄'}</span>
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
