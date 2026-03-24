import React, { useEffect, useState, useRef } from 'react';
import {
  Share2, StopCircle, RefreshCw, Copy, CheckCircle,
  File, X, Plus, Wifi, ExternalLink, AlertCircle,
} from 'lucide-react';
import api from '../api';
import { formatBytes } from '../utils';

// ---------------------------------------------------------------------------
// QR code via a tiny inline generator (no external library needed)
// We use a free QR API endpoint to display a QR code image.
// ---------------------------------------------------------------------------
function QRCode({ url, size = 160 }) {
  const encoded = encodeURIComponent(url);
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`}
      alt="QR code"
      width={size}
      height={size}
      className="rounded-lg"
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function QuickTransferPage() {
  const [status, setStatus]     = useState(null);   // share status from backend
  const [loading, setLoading]   = useState(false);
  const [filePaths, setFilePaths] = useState([]);
  const [inputPath, setInputPath] = useState('');
  const [copied, setCopied]     = useState(false);
  const [error, setError]       = useState('');
  const pollRef = useRef(null);

  // -------------------------------------------------------------------------
  // Poll share status every 3 seconds
  // -------------------------------------------------------------------------
  const fetchStatus = async () => {
    try {
      const res = await api.get('/transfer/status');
      setStatus(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 3000);
    return () => clearInterval(pollRef.current);
  }, []);

  // -------------------------------------------------------------------------
  const addPath = () => {
    const p = inputPath.trim();
    if (p && !filePaths.includes(p)) setFilePaths((prev) => [...prev, p]);
    setInputPath('');
  };

  const removePath = (p) => setFilePaths((prev) => prev.filter((x) => x !== p));

  const handleStartShare = async () => {
    if (!filePaths.length) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/transfer/start', { file_paths: filePaths });
      setStatus({ ...res.data, active: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start sharing.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopShare = async () => {
    setLoading(true);
    try {
      await api.post('/transfer/stop');
      setStatus({ active: false });
      setFilePaths([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    if (!status?.url) return;
    navigator.clipboard.writeText(status.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenUrl = () => {
    if (status?.url) window.open(status.url, '_blank', 'noopener');
  };

  // -------------------------------------------------------------------------
  const isActive = status?.active;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Quick Transfer</h1>
        <p className="text-slate-400 text-sm mt-1">
          Share files instantly with any device on your local network — no cables, no accounts.
        </p>
      </div>

      {/* How it works */}
      <div className="card bg-brand-600/5 border-brand-600/20">
        <div className="flex items-start gap-3">
          <Wifi className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-slate-400 space-y-1">
            <p className="text-slate-200 font-medium">How it works</p>
            <p>1. Add the files you want to share below.</p>
            <p>2. Click <strong className="text-white">Start Sharing</strong> — a local web server starts on your PC.</p>
            <p>3. Open the URL or scan the QR code on any phone, tablet, or PC on the same Wi-Fi.</p>
            <p>4. The receiving device downloads the files directly — no internet, no cloud.</p>
          </div>
        </div>
      </div>

      {/* Active share panel */}
      {isActive && (
        <div className="card space-y-4 border-green-600/30 bg-green-900/10">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Sharing active</span>
            <span className="ml-auto text-xs text-slate-500">
              {status.files?.length} file(s) shared from {status.ip}:{status.port}
            </span>
          </div>

          {/* URL */}
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-200 flex-1 truncate font-mono">{status.url}</span>
            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              title="Copy URL"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={handleOpenUrl} className="text-slate-400 hover:text-white" title="Open in browser">
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* QR code + file list */}
          <div className="flex gap-6 items-start">
            <div className="flex-shrink-0">
              <QRCode url={status.url} size={150} />
              <p className="text-xs text-slate-500 text-center mt-1">Scan to receive</p>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs text-slate-500 mb-2">Shared files:</p>
              {status.files?.map((name) => (
                <div key={name} className="flex items-center gap-2 text-sm text-slate-300">
                  <File className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleStopShare}
            disabled={loading}
            className="btn-danger flex items-center gap-2 text-sm"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
            Stop Sharing
          </button>
        </div>
      )}

      {/* Setup panel (only shown when not sharing) */}
      {!isActive && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">Files to share</h2>

          {/* File path input */}
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Enter full file path, e.g. C:\Users\You\photo.jpg"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPath()}
            />
            <button onClick={addPath} className="btn-ghost px-3 py-2 text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* File list */}
          {filePaths.length > 0 && (
            <div className="space-y-1">
              {filePaths.map((p) => (
                <div key={p} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5">
                  <File className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="text-sm text-slate-300 flex-1 truncate">{p}</span>
                  <button onClick={() => removePath(p)} className="text-slate-500 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
              <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
            </div>
          )}

          <button
            onClick={handleStartShare}
            disabled={loading || filePaths.length === 0}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Start Sharing
          </button>
        </div>
      )}

      {/* Receiving instructions */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Receiving files from another device</h2>
        <div className="text-sm text-slate-400 space-y-2">
          <p>To receive files from another PC or phone on the same network:</p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li>On the sending device, open StorageSense → Quick Transfer.</li>
            <li>Add files and click <strong className="text-white">Start Sharing</strong>.</li>
            <li>Open the displayed URL in your browser or scan the QR code.</li>
            <li>Click each file to download it.</li>
          </ol>
          <p className="text-slate-500 text-xs mt-2">
            All transfers happen locally — no data leaves your network.
          </p>
        </div>
      </div>
    </div>
  );
}
