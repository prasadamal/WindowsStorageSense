import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, HardDrive, Files, Copy, Trash2, Gamepad2,
  Download, FolderOpen, Settings, Rocket, RefreshCw, Shield,
  FolderSearch, Music, Share2, Search, Sparkles, Layers,
  BarChart2,
} from 'lucide-react';

import useStore from './store';

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

// ---------------------------------------------------------------------------
// Sidebar navigation structure — grouped sections
// ---------------------------------------------------------------------------
const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/analyzer',  icon: BarChart2,       label: 'Deep Analyzer' },
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
      { to: '/storage',       icon: HardDrive, label: 'Storage' },
      { to: '/drives/optimize', icon: Shield,  label: 'Drive Advisor' },
      { to: '/startup',       icon: Rocket,    label: 'Startup' },
      { to: '/uninstaller',   icon: FolderOpen, label: 'Uninstaller' },
      { to: '/games',         icon: Gamepad2,  label: 'Games' },
    ],
  },
  {
    label: '',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

function Sidebar() {
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
            <p className="text-xs text-slate-500 leading-none mt-0.5">v2.0</p>
          </div>
        </div>
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

function AppShell({ children }) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-surface-900">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const { onboardingComplete, setOnboardingComplete, fetchDrives, fetchSettings } = useStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const done = localStorage.getItem('onboarding_complete') === 'true';
    setOnboardingComplete(done);
    setChecking(false);
    fetchDrives();
    fetchSettings();
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

  return (
    <BrowserRouter>
      <Routes>
        {!onboardingComplete ? (
          <>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </>
        ) : (
          <>
            <Route path="/dashboard"     element={<AppShell><Dashboard /></AppShell>} />
            <Route path="/analyzer"      element={<AppShell><DeepAnalyzerPage /></AppShell>} />
            <Route path="/explorer"      element={<AppShell><FileExplorerPage /></AppShell>} />
            <Route path="/optimizer"     element={<AppShell><SmartOptimizerPage /></AppShell>} />
            <Route path="/media"         element={<AppShell><MediaOrganizerPage /></AppShell>} />
            <Route path="/downloads"     element={<AppShell><DownloadsPage /></AppShell>} />
            <Route path="/junk"          element={<AppShell><JunkCleaner /></AppShell>} />
            <Route path="/duplicates"    element={<AppShell><DuplicatesPage /></AppShell>} />
            <Route path="/files"         element={<AppShell><FilesPage /></AppShell>} />
            <Route path="/transfer"      element={<AppShell><QuickTransferPage /></AppShell>} />
            <Route path="/storage"       element={<AppShell><StorageAnalyzer /></AppShell>} />
            <Route path="/drives/optimize" element={<AppShell><DriveOptimizer /></AppShell>} />
            <Route path="/startup"       element={<AppShell><StartupManager /></AppShell>} />
            <Route path="/uninstaller"   element={<AppShell><UninstallerPage /></AppShell>} />
            <Route path="/games"         element={<AppShell><GamesPage /></AppShell>} />
            <Route path="/settings"      element={<AppShell><SettingsPage /></AppShell>} />
            <Route path="*"              element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
