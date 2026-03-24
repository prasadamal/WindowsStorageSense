import axios from 'axios';

const API_BASE = 'http://127.0.0.1:8765';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export default api;
