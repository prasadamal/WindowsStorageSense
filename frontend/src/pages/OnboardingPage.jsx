import React, { useState } from 'react';
import { HardDrive, ChevronRight, Check, Loader2 } from 'lucide-react';
import useStore from '../store';
import api from '../api';
import { formatBytes } from '../utils';

const STEPS = ['Select Drives', 'Choose Mode', 'Initial Scan'];

export default function OnboardingPage() {
  const { drives, fetchDrives, startScan, setOnboardingComplete, selectedDrives, setSelectedDrives } = useStore();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('safe');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ status: '', files_found: 0 });
  const [sessionId, setSessionId] = useState(null);

  React.useEffect(() => {
    fetchDrives();
  }, []);

  const toggleDrive = (path) => {
    setSelectedDrives(
      selectedDrives.includes(path)
        ? selectedDrives.filter((d) => d !== path)
        : [...selectedDrives, path]
    );
  };

  const handleStartScan = async () => {
    if (selectedDrives.length === 0) return;
    setScanning(true);
    try {
      const sid = await startScan(selectedDrives);
      setSessionId(sid);

      // Poll for progress
      const poll = setInterval(async () => {
        try {
          const res = await api.get(`/scan/${sid}/status`);
          setScanProgress(res.data);
          if (res.data.status === 'complete') {
            clearInterval(poll);
            localStorage.setItem('onboarding_complete', 'true');
            setOnboardingComplete(true);
          }
        } catch {}
      }, 1500);
    } catch (e) {
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <HardDrive className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white">Welcome to StorageSense</h1>
        <p className="text-slate-400 mt-2">Let's set up your storage intelligence — takes about 2 minutes.</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 ${i === step ? 'text-brand-400' : i < step ? 'text-green-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border
                ${i === step ? 'border-brand-500 bg-brand-600/20' : i < step ? 'border-green-500 bg-green-500/20' : 'border-slate-600 bg-slate-800'}`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className="text-sm font-medium hidden sm:block">{s}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-slate-600" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-xl card">
        {/* Step 0: Select drives */}
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Select Drives to Monitor</h2>
            <p className="text-slate-400 text-sm mb-4">Choose which drives StorageSense should scan and monitor.</p>
            <div className="space-y-3">
              {drives.map((drive) => (
                <button
                  key={drive.path}
                  onClick={() => toggleDrive(drive.path)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left
                    ${selectedDrives.includes(drive.path)
                      ? 'border-brand-500 bg-brand-600/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                    ${selectedDrives.includes(drive.path) ? 'bg-brand-600' : 'bg-slate-700'}`}>
                    <HardDrive className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white">{drive.label || drive.path}</div>
                    <div className="text-xs text-slate-400">
                      {formatBytes(drive.free_bytes)} free of {formatBytes(drive.total_bytes)}
                      {drive.drive_type !== 'Unknown' && ` · ${drive.drive_type}`}
                    </div>
                    <div className="mt-1.5 progress-bar">
                      <div
                        className={`progress-bar-fill ${drive.percent_used > 90 ? 'bg-red-500' : drive.percent_used > 70 ? 'bg-yellow-500' : 'bg-brand-500'}`}
                        style={{ width: `${drive.percent_used}%` }}
                      />
                    </div>
                  </div>
                  {selectedDrives.includes(drive.path) && (
                    <Check className="w-5 h-5 text-brand-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <button
              disabled={selectedDrives.length === 0}
              onClick={() => setStep(1)}
              className="btn-primary w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 1: Mode */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Choose Your Mode</h2>
            <p className="text-slate-400 text-sm mb-4">You can change this at any time in Settings.</p>
            <div className="space-y-3">
              {[
                {
                  id: 'safe',
                  label: 'Safe Mode',
                  recommended: true,
                  desc: 'Recommended for most users. All actions require confirmation. Nothing is deleted automatically.',
                },
                {
                  id: 'advanced',
                  label: 'Advanced Mode',
                  desc: 'For power users who want more control. Exposes additional options and technical details.',
                },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors
                    ${mode === m.id ? 'border-brand-500 bg-brand-600/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{m.label}</span>
                    {m.recommended && <span className="badge badge-green">Recommended</span>}
                    {mode === m.id && <Check className="w-4 h-4 text-brand-400 ml-auto" />}
                  </div>
                  <p className="text-slate-400 text-sm mt-1">{m.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(0)} className="btn-secondary flex-1">Back</button>
              <button onClick={() => setStep(2)} className="btn-primary flex-1">Continue</button>
            </div>
          </div>
        )}

        {/* Step 2: Scan */}
        {step === 2 && (
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white mb-1">Initial Scan</h2>
            <p className="text-slate-400 text-sm mb-6">
              We'll scan {selectedDrives.join(', ')} to build your storage profile.
            </p>
            {!scanning ? (
              <button onClick={handleStartScan} className="btn-primary w-full">
                Start Scan
              </button>
            ) : (
              <div>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                  <span className="text-white font-medium">
                    {scanProgress.status === 'complete' ? 'Complete!' : 'Scanning…'}
                  </span>
                </div>
                <div className="text-slate-400 text-sm">
                  {scanProgress.files_found?.toLocaleString() || 0} files found
                </div>
                {scanProgress.status === 'complete' && (
                  <p className="text-green-400 mt-3 font-medium">Scan complete! Opening your dashboard…</p>
                )}
              </div>
            )}
            {!scanning && (
              <button onClick={() => setStep(1)} className="btn-secondary w-full mt-3">Back</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
