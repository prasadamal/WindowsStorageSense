import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8765';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach timestamp for cache-busting when needed
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — unified error normalization
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Normalize the error message so components can rely on error.message
    const detail =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Unknown error';
    error.message = detail;
    return Promise.reject(error);
  },
);

export default api;
