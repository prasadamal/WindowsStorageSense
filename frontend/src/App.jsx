import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, HardDrive, Files, Copy, Trash2, Gamepad2,
  Download, FolderOpen, Settings, Rocket, RefreshCw, Shield,
  FolderSearch, Music, Share2, Search, Sparkles, Layers,
  BarChart2, Activity, Keyboard,
} from 'lucide-react';

import useStore from './store';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import CommandPalette from './components/CommandPalette';

// Pages
import Dashboard from './pages/Dashboard';
import StorageAnalyzer from './pages/StorageAnalyzer';
import FilesPage from './pages/FilesPage';
import DuplicatesPage from './pages/DuplicatesPage';
import JunkCleaner from './pages/JunkCleaner';
import UninstallerPage from './pages/UninstallerPage';
import StartupManager from './pages/StartupManager';
import GamesPage from './pages/GamesPage';
import DownloadsPage from './pages/DownloadsPage';
import SettingsPage from './pages/SettingsPage';
import OnboardingPage from './pages/OnboardingPage';
import DriveOptimizer from './pages/DriveOptimizer';
import FileExplorerPage from './pages/FileExplorerPage';
import MediaOrganizerPage from './pages/MediaOrganizerPage';
import QuickTransferPage from './pages/QuickTransferPage';
import SmartOptimizerPage from './pages/SmartOptimizerPage';
import DeepAnalyzerPage from './pages/DeepAnalyzerPage';
import SystemMonitorPage from './pages/SystemMonitorPage';

// ---------------------------------------------------------------------------
// Sidebar navigation structure — grouped sections
// ---------------------------------------------------------------------------
const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/analyzer',  icon: BarChart2,       label: 'Deep Analyzer' },
      { to: '/system',    icon: Activity,        label: 'System Monitor' },
    ],
  },
  {
    label: 'Explore',
    items: [
      { to: '/explorer', icon: FolderSearch, label: 'File Explorer' },
    ],
  },
  {
    label: 'Organize',
    items: [
      { to: '/optimizer', icon: Sparkles,  label: 'Smart Optimizer' },
      { to: '/media',     icon: Music,     label: 'Media Organizer' },
      { to: '/downloads', icon: Download,  label: 'Downloads' },
    ],
  },
  {
    label: 'Clean',
    items: [
      { to: '/junk',       icon: Trash2,   label: 'Junk Cleaner' },
      { to: '/duplicates', icon: Copy,     label: 'Duplicates' },
      { to: '/files',      icon: Files,    label: 'All Files' },
    ],
  },
  {
    label: 'Transfer',
    items: [
      { to: '/transfer', icon: Share2, label: 'Quick Transfer' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/storage',       icon: HardDrive,  label: 'Storage' },
      { to: '/drives/optimize', icon: Shield,   label: 'Drive Advisor' },
      { to: '/startup',       icon: Rocket,     label: 'Startup' },
      { to: '/uninstaller',   icon: FolderOpen, label: 'Uninstaller' },
      { to: '/games',         icon: Gamepad2,   label: 'Games' },
    ],
  },
  {
    label: '',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

function Sidebar({ onCommandPalette }) {
  return (
    <aside className="w-56 flex-shrink-0 bg-surface-950 border-r border-slate-700/40 flex flex-col">
      {/* App branding */}
      <div className="px-4 pt-6 pb-5 border-b border-slate-700/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-900/50">
            <HardDrive className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm text-white tracking-tight">StorageSense</span>
            <p className="text-xs text-slate-500 leading-none mt-0.5">v3.0</p>
          </div>
        </div>
      </div>

      {/* Search / command palette trigger */}
      <div className="px-2 pt-3">
        <button
          onClick={onCommandPalette}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600/60 text-sm transition-all duration-150"
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 text-left text-xs">Search…</span>
          <kbd className="text-[10px] bg-slate-700 border border-slate-600 px-1.5 py-0.5 rounded font-mono">⌃K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.label && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-1">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-brand-600/15 text-brand-400 border border-brand-600/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-400' : ''}`} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700/30">
        <p className="text-xs text-slate-600">Windows Storage Intelligence</p>
      </div>
    </aside>
  );
}

function AppShell({ children, onCommandPalette }) {
  return (
    <div className="flex h-full">
      <Sidebar onCommandPalette={onCommandPalette} />
      <main className="flex-1 overflow-auto bg-surface-900">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}

function AppInner() {
  const { onboardingComplete, setOnboardingComplete, fetchDrives, fetchSettings } = useStore();
  const [checking, setChecking] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem('onboarding_complete') === 'true';
    setOnboardingComplete(done);
    setChecking(false);
    fetchDrives();
    fetchSettings();
  }, []);

  // Global Ctrl+K / Cmd+K shortcut for command palette
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (checking) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-900">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Starting…</span>
        </div>
      </div>
    );
  }

  const wrap = (el) => (
    <AppShell onCommandPalette={() => setPaletteOpen(true)}>
      {el}
    </AppShell>
  );

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Routes>
        {!onboardingComplete ? (
          <>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        ) : (
          <>
            <Route path="/dashboard"       element={wrap(<Dashboard />)} />
            <Route path="/analyzer"        element={wrap(<DeepAnalyzerPage />)} />
            <Route path="/system"          element={wrap(<SystemMonitorPage />)} />
            <Route path="/explorer"        element={wrap(<FileExplorerPage />)} />
            <Route path="/optimizer"       element={wrap(<SmartOptimizerPage />)} />
            <Route path="/media"           element={wrap(<MediaOrganizerPage />)} />
            <Route path="/downloads"       element={wrap(<DownloadsPage />)} />
            <Route path="/junk"            element={wrap(<JunkCleaner />)} />
            <Route path="/duplicates"      element={wrap(<DuplicatesPage />)} />
            <Route path="/files"           element={wrap(<FilesPage />)} />
            <Route path="/transfer"        element={wrap(<QuickTransferPage />)} />
            <Route path="/storage"         element={wrap(<StorageAnalyzer />)} />
            <Route path="/drives/optimize" element={wrap(<DriveOptimizer />)} />
            <Route path="/startup"         element={wrap(<StartupManager />)} />
            <Route path="/uninstaller"     element={wrap(<UninstallerPage />)} />
            <Route path="/games"           element={wrap(<GamesPage />)} />
            <Route path="/settings"        element={wrap(<SettingsPage />)} />
            <Route path="*"                element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </BrowserRouter>
  );
}
