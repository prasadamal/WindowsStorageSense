import React, { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import useStore from '../store';
import api from '../api';

const SETTING_DEFS = [
  {
    key: 'scan_mode',
    label: 'Scan Mode',
    type: 'select',
    options: [
      { value: 'safe', label: 'Safe Mode (Recommended)' },
      { value: 'advanced', label: 'Advanced Mode' },
    ],
    description: 'Safe Mode requires confirmation for all actions. Advanced Mode exposes more options.',
  },
  {
    key: 'junk_threshold_gb',
    label: 'Junk Notification Threshold (GB)',
    type: 'number',
    description: 'Show a notification when cleanable junk exceeds this size.',
  },
  {
    key: 'stale_days',
    label: 'Stale File Threshold (days)',
    type: 'number',
    description: 'Files not accessed for this many days are flagged as stale.',
  },
  {
    key: 'dark_mode',
    label: 'Dark Mode',
    type: 'toggle',
    description: 'Toggle between dark and light mode.',
  },
];

export default function SettingsPage() {
  const { settings, fetchSettings, updateSetting } = useStore();
  const [localSettings, setLocalSettings] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    setLocalSettings({
      scan_mode: 'safe',
      junk_threshold_gb: '5',
      stale_days: '365',
      dark_mode: 'true',
      ...settings,
    });
  }, [settings]);

  const handleChange = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    for (const [key, value] of Object.entries(localSettings)) {
      await updateSetting(key, String(value));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRegisterTask = async () => {
    await api.post('/scheduler/register-task');
    alert('Windows Task Scheduler job registered for weekly background scans.');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm">Configure StorageSense behavior</p>
      </div>

      <div className="card space-y-6">
        {SETTING_DEFS.map((def) => (
          <div key={def.key} className="flex items-start gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-white mb-1">{def.label}</label>
              <p className="text-xs text-slate-400">{def.description}</p>
            </div>
            <div className="flex-shrink-0">
              {def.type === 'select' && (
                <select
                  value={localSettings[def.key] || ''}
                  onChange={(e) => handleChange(def.key, e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
                >
                  {def.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
              {def.type === 'number' && (
                <input
                  type="number"
                  value={localSettings[def.key] || ''}
                  onChange={(e) => handleChange(def.key, e.target.value)}
                  className="w-24 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
                />
              )}
              {def.type === 'toggle' && (
                <button
                  onClick={() => handleChange(def.key, localSettings[def.key] === 'true' ? 'false' : 'true')}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    localSettings[def.key] === 'true' ? 'bg-brand-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${
                    localSettings[def.key] === 'true' ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              )}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-4 pt-4 border-t border-slate-700/50">
          <button onClick={handleSave} className="btn-primary flex items-center gap-2 text-sm">
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Scheduler */}
      <div className="card">
        <h2 className="font-semibold text-white mb-2">Background Scheduler</h2>
        <p className="text-slate-400 text-sm mb-4">
          Register a Windows Task Scheduler job to run weekly background scans and send tray notifications.
        </p>
        <button onClick={handleRegisterTask} className="btn-secondary text-sm">
          Register Weekly Scan Task
        </button>
      </div>

      {/* About */}
      <div className="card">
        <h2 className="font-semibold text-white mb-2">About</h2>
        <div className="space-y-1 text-sm text-slate-400">
          <p>WindowsStorageSense v1.0.0</p>
          <p>Electron + React frontend · Python FastAPI backend · SQLite database</p>
          <p className="text-xs mt-2 text-slate-500">
            All data is processed locally. No file names, paths, or metadata are transmitted externally.
          </p>
        </div>
      </div>
    </div>
  );
}
