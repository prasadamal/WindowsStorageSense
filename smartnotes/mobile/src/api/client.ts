/**
 * Axios HTTP client — pre-configured for the SmartNotes API.
 *
 * - Attaches Bearer token from AsyncStorage on every request.
 * - On 401, attempts a silent token refresh.
 * - Exposes typed helpers: get, post, patch, del.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

const STORAGE_KEYS = {
  accessToken: '@smartnotes/access_token',
  refreshToken: '@smartnotes/refresh_token',
} as const;

// ── Client factory ────────────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach token ─────────────────────────────────────────

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────

let _isRefreshing = false;
let _refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (_isRefreshing) {
      return new Promise((resolve) => {
        _refreshQueue.push((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`;
          resolve(apiClient(original));
        });
      });
    }

    _isRefreshing = true;

    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
      if (!refreshToken) throw new Error('No refresh token');

      const resp = await axios.post<{ access_token: string; refresh_token: string }>(
        `${BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
      );

      const { access_token, refresh_token } = resp.data;
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.accessToken, access_token],
        [STORAGE_KEYS.refreshToken, refresh_token],
      ]);

      _refreshQueue.forEach((cb) => cb(access_token));
      _refreshQueue = [];

      original.headers.Authorization = `Bearer ${access_token}`;
      return apiClient(original);
    } catch {
      _refreshQueue = [];
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
      return Promise.reject(error);
    } finally {
      _isRefreshing = false;
    }
  },
);

// ── Token helpers ─────────────────────────────────────────────────────────────

export const tokenStorage = {
  save: async (access: string, refresh: string) => {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.accessToken, access],
      [STORAGE_KEYS.refreshToken, refresh],
    ]);
  },
  clear: async () => {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  },
  getAccess: () => AsyncStorage.getItem(STORAGE_KEYS.accessToken),
};
