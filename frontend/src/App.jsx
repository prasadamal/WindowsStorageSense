import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, HardDrive, Files, Copy, Trash2, Gamepad2,
  Download, FolderOpen, Settings, Rocket, RefreshCw, Shield,
  FolderSearch, Music, Share2,
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

const NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/explorer',   icon: FolderSearch,    label: 'File Explorer' },
  { to: '/media',      icon: Music,           label: 'Media Organizer' },
  { to: '/transfer',   icon: Share2,          label: 'Quick Transfer' },
  { to: '/storage',    icon: HardDrive,       label: 'Storage' },
  { to: '/files',      icon: Files,           label: 'Files' },
  { to: '/duplicates', icon: Copy,            label: 'Duplicates' },
  { to: '/junk',       icon: Trash2,          label: 'Junk Cleaner' },
  { to: '/uninstaller',icon: FolderOpen,      label: 'Uninstaller' },
  { to: '/startup',    icon: Rocket,          label: 'Startup' },
  { to: '/games',      icon: Gamepad2,        label: 'Games' },
  { to: '/downloads',  icon: Download,        label: 'Downloads' },
  { to: '/drives/optimize', icon: Shield,     label: 'Drive Advisor' },
  { to: '/settings',   icon: Settings,        label: 'Settings' },
];

function Sidebar() {
  return (
    <aside className="w-56 flex-shrink-0 bg-surface-950 border-r border-slate-700/50 flex flex-col">
      {/* App logo */}
      <div className="px-4 pt-8 pb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <HardDrive className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-slate-100">StorageSense</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-500">v1.0.0 — Windows only</p>
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
    // Check if onboarding has been completed (stored in localStorage)
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
            <Route
              path="/dashboard"
              element={<AppShell><Dashboard /></AppShell>}
            />
            <Route
              path="/explorer"
              element={<AppShell><FileExplorerPage /></AppShell>}
            />
            <Route
              path="/media"
              element={<AppShell><MediaOrganizerPage /></AppShell>}
            />
            <Route
              path="/transfer"
              element={<AppShell><QuickTransferPage /></AppShell>}
            />
            <Route
              path="/storage"
              element={<AppShell><StorageAnalyzer /></AppShell>}
            />
            <Route
              path="/files"
              element={<AppShell><FilesPage /></AppShell>}
            />
            <Route
              path="/duplicates"
              element={<AppShell><DuplicatesPage /></AppShell>}
            />
            <Route
              path="/junk"
              element={<AppShell><JunkCleaner /></AppShell>}
            />
            <Route
              path="/uninstaller"
              element={<AppShell><UninstallerPage /></AppShell>}
            />
            <Route
              path="/startup"
              element={<AppShell><StartupManager /></AppShell>}
            />
            <Route
              path="/games"
              element={<AppShell><GamesPage /></AppShell>}
            />
            <Route
              path="/downloads"
              element={<AppShell><DownloadsPage /></AppShell>}
            />
            <Route
              path="/drives/optimize"
              element={<AppShell><DriveOptimizer /></AppShell>}
            />
            <Route
              path="/settings"
              element={<AppShell><SettingsPage /></AppShell>}
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
