import React, { useEffect, useState, useRef } from 'react';
import {
  Share2, StopCircle, RefreshCw, Copy, CheckCircle,
  File, X, Plus, Wifi, Globe, Bluetooth, ExternalLink,
  AlertCircle, Monitor, Upload, Link, Clock,
} from 'lucide-react';
import api from '../api';
import { formatBytes } from '../utils';

function FilePathList({ paths, onChange }) {
  const [input, setInput] = useState('');
  const add = () => {
    const p = input.trim();
    if (p && !paths.includes(p)) onChange([...paths, p]);
    setInput('');
  };
  return (
    <div className="space-y-2">
      {paths.map((p) => (
        <div key={p} className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-1.5">
          <File className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span className="text-sm text-slate-300 flex-1 truncate">{p}</span>
          <button onClick={() => onChange(paths.filter((x) => x !== p))} className="text-slate-500 hover:text-red-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Enter full file path, e.g. C:\Users\You\photo.jpg"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} className="btn-secondary flex items-center gap-1 px-3 text-sm">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </div>
  );
}

function CopyURLButton({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
      {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function LANTab() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filePaths, setFilePaths] = useState([]);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const fetchStatus = async () => {
    try { const res = await api.get('/transfer/status'); setStatus(res.data); } catch {}
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 3000);
    return () => clearInterval(pollRef.current);
  }, []);

  const start = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/transfer/start', { file_paths: filePaths });
      setStatus({ ...res.data, active: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start sharing.');
    } finally { setLoading(false); }
  };

  const stop = async () => {
    setLoading(true);
    try { await api.post('/transfer/stop'); setStatus({ active: false }); setFilePaths([]); }
    finally { setLoading(false); }
  };

  const isActive = status?.active;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 bg-brand-600/5 border border-brand-600/20 rounded-xl">
        <Wifi className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-slate-400 space-y-1">
          <p className="text-slate-200 font-medium">LAN / Wi-Fi Transfer</p>
          <p>Start a local web server. Any device on the same Wi-Fi opens the URL to download — no internet, no accounts.</p>
        </div>
      </div>

      {isActive ? (
        <div className="card border-green-600/30 bg-green-900/10 space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Sharing active</span>
            <span className="ml-auto text-xs text-slate-500">{status.files?.length} file(s) · {status.ip}:{status.port}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2.5">
            <Monitor className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="text-sm text-slate-200 flex-1 truncate font-mono">{status.url}</span>
            <CopyURLButton url={status.url} />
            <button onClick={() => window.open(status.url, '_blank', 'noopener')} className="text-slate-400 hover:text-white ml-1">
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 bg-white rounded-xl p-3 flex flex-col items-center gap-1">
              <Monitor className="w-16 h-16 text-indigo-600" />
              <p className="text-xs text-gray-500 text-center font-mono break-all max-w-[120px]">{status.url}</p>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs text-slate-500 mb-2">Shared files:</p>
              {status.files?.map((name) => (
                <div key={name} className="flex items-center gap-2 text-sm text-slate-300">
                  <File className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={stop} disabled={loading} className="btn-danger flex items-center gap-2 text-sm">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
            Stop Sharing
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <FilePathList paths={filePaths} onChange={setFilePaths} />
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
            </div>
          )}
          <button onClick={start} disabled={loading || !filePaths.length} className="btn-primary flex items-center gap-2 text-sm">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Start LAN Share
          </button>
        </div>
      )}
    </div>
  );
}

function InternetTab() {
  const [filePath, setFilePath] = useState('');
  const [expires, setExpires] = useState('14d');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const upload = async () => {
    if (!filePath.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await api.post('/transfer/internet-upload', { file_path: filePath.trim(), expires });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Check your internet connection.');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 bg-purple-600/5 border border-purple-600/20 rounded-xl">
        <Globe className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-slate-400 space-y-1">
          <p className="text-slate-200 font-medium">Internet Transfer via file.io</p>
          <p>Upload a file and get a one-time download link to share with anyone worldwide. No account required. File deleted after first download or expiry.</p>
        </div>
      </div>

      {result ? (
        <div className="card border-green-600/30 bg-green-900/10 space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Upload successful!</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-500">File</p>
              <p className="text-white font-medium">{result.name}</p>
              <p className="text-slate-400 text-xs">{formatBytes(result.size_bytes)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Expires</p>
              <p className="text-white font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />{result.expires || expires}
              </p>
              <p className="text-slate-400 text-xs">one-time download</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2.5">
            <Link className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="text-sm text-slate-200 flex-1 truncate font-mono">{result.url}</span>
            <CopyURLButton url={result.url} />
            <button onClick={() => window.open(result.url, '_blank', 'noopener')} className="text-slate-400 hover:text-white ml-1">
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setResult(null)} className="btn-secondary text-sm">Upload another file</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">File to upload</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Enter full file path, e.g. C:\Users\You\report.pdf"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && upload()}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">Link expiry</label>
            <select
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-500"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            >
              <option value="1d">1 day</option>
              <option value="7d">7 days</option>
              <option value="14d">14 days (default)</option>
            </select>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
            </div>
          )}
          <button onClick={upload} disabled={loading || !filePath.trim()} className="btn-primary flex items-center gap-2 text-sm">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? 'Uploading…' : 'Upload & Get Link'}
          </button>
          <p className="text-xs text-slate-600">Max file size: 2 GB. Deleted after first download or expiry.</p>
        </div>
      )}
    </div>
  );
}

function BluetoothTab() {
  const [launched, setLaunched] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const launch = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/transfer/bluetooth');
      if (res.data.launched) { setLaunched(true); }
      else { setError(res.data.error || 'Could not launch Bluetooth wizard.'); }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start Bluetooth transfer.');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 bg-blue-600/5 border border-blue-600/20 rounded-xl">
        <Bluetooth className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-slate-400 space-y-1">
          <p className="text-slate-200 font-medium">Bluetooth File Transfer</p>
          <p>Uses Windows built-in Bluetooth File Transfer Wizard (fsquirt.exe). Pair your device first, then click below.</p>
        </div>
      </div>

      {launched && (
        <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/40 rounded-lg text-green-300 text-sm">
          <CheckCircle className="w-4 h-4" /> Bluetooth wizard launched — follow the on-screen steps.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-slate-200">Before you start</h3>
        <ol className="text-sm text-slate-400 space-y-1.5 list-decimal list-inside pl-1">
          <li>Open <strong className="text-white">Windows Settings → Bluetooth &amp; devices</strong></li>
          <li>Pair the receiving device if not already paired</li>
          <li>Ensure Bluetooth is on on both devices</li>
          <li>Click the button below to open the wizard</li>
        </ol>
        <button onClick={launch} disabled={loading} className="btn-primary flex items-center gap-2 text-sm mt-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
          Open Bluetooth Transfer Wizard
        </button>
      </div>

      <div className="text-xs text-slate-600 space-y-0.5 p-3 bg-slate-800/30 rounded-lg">
        <p className="font-medium text-slate-500 mb-1">Requirements</p>
        <p>• Windows 7 or later with Bluetooth adapter</p>
        <p>• Device paired in Windows Settings</p>
        <p>• Bluetooth enabled on receiving device</p>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'lan',       label: 'LAN / Wi-Fi',   icon: <Wifi      className="w-4 h-4" />, activeClass: 'text-brand-400'  },
  { id: 'internet',  label: 'Internet',       icon: <Globe     className="w-4 h-4" />, activeClass: 'text-purple-400' },
  { id: 'bluetooth', label: 'Bluetooth',      icon: <Bluetooth className="w-4 h-4" />, activeClass: 'text-blue-400'   },
];

export default function QuickTransferPage() {
  const [active, setActive] = useState('lan');
  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Quick Transfer</h1>
        <p className="text-slate-400 text-sm mt-1">
          Send files to any device — over your local network, the internet, or Bluetooth.
        </p>
      </div>
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
              active === t.id ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-white hover:bg-slate-700/40'
            }`}
          >
            <span className={active === t.id ? t.activeClass : ''}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      {active === 'lan'       && <LANTab />}
      {active === 'internet'  && <InternetTab />}
      {active === 'bluetooth' && <BluetoothTab />}
    </div>
  );
}
