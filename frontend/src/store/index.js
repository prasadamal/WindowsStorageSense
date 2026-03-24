import { create } from 'zustand';
import api from './api';

const useStore = create((set, get) => ({
  // Session / scan
  sessionId: null,
  scanStatus: null,
  isScanning: false,

  // Dashboard
  dashboard: null,
  dashboardLoading: false,

  // Drives
  drives: [],

  // Settings
  settings: {},

  // Onboarding
  onboardingComplete: false,
  selectedDrives: [],

  // ----------------------------------------------------------------
  setSessionId: (id) => set({ sessionId: id }),
  setScanStatus: (s) => set({ scanStatus: s }),
  setDrives: (drives) => set({ drives }),
  setSettings: (settings) => set({ settings }),
  setOnboardingComplete: (v) => set({ onboardingComplete: v }),
  setSelectedDrives: (drives) => set({ selectedDrives: drives }),

  // ----------------------------------------------------------------
  fetchDrives: async () => {
    try {
      const res = await api.get('/drives');
      set({ drives: res.data.drives || [] });
    } catch {}
  },

  fetchDashboard: async () => {
    set({ dashboardLoading: true });
    try {
      const res = await api.get('/dashboard');
      set({ dashboard: res.data, dashboardLoading: false });
    } catch {
      set({ dashboardLoading: false });
    }
  },

  startScan: async (drivePaths) => {
    set({ isScanning: true, scanStatus: 'running' });
    try {
      const res = await api.post('/scan/start', { drive_paths: drivePaths });
      const sessionId = res.data.session_id;
      set({ sessionId });
      return sessionId;
    } catch {
      set({ isScanning: false });
      throw new Error('Scan failed to start');
    }
  },

  pollScanStatus: async (sessionId) => {
    try {
      const res = await api.get(`/scan/${sessionId}/status`);
      const { status, files_found } = res.data;
      set({ scanStatus: status });
      if (status === 'complete') {
        set({ isScanning: false });
      }
      return res.data;
    } catch {
      return null;
    }
  },

  fetchSettings: async () => {
    try {
      const res = await api.get('/settings');
      set({ settings: res.data });
    } catch {}
  },

  updateSetting: async (key, value) => {
    try {
      await api.post('/settings', { key, value });
      set((state) => ({ settings: { ...state.settings, [key]: value } }));
    } catch {}
  },
}));

export default useStore;
