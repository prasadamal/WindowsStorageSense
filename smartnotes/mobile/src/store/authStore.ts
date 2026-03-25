/**
 * Auth store — current user, loading state, login / logout actions.
 */

import { create } from 'zustand';
import { authApi } from '@/api';
import type { LoginBody, RegisterBody, User } from '@/api/types';
import { tokenStorage } from '@/api/client';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialising: boolean;
  error: string | null;

  // actions
  initialise: () => Promise<void>;
  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialising: true,
  error: null,

  initialise: async () => {
    const token = await tokenStorage.getAccess();
    if (token) {
      try {
        const user = await authApi.me();
        set({ user, isInitialising: false });
        return;
      } catch {
        await tokenStorage.clear();
      }
    }
    set({ isInitialising: false });
  },

  login: async (body) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.login(body);
      const user = await authApi.me();
      set({ user, isLoading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      set({ isLoading: false, error: msg });
      throw e;
    }
  },

  register: async (body) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.register(body);
      await authApi.login({ email: body.email, password: body.password });
      const user = await authApi.me();
      set({ user, isLoading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      set({ isLoading: false, error: msg });
      throw e;
    }
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
