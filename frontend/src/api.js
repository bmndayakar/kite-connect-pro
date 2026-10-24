// API utility functions for Zerodha Kite Connect Backend
// In local dev, falls back to '/api' (proxied by Vite)
// In production, uses VITE_API_BASE_URL (e.g. your Render.com free backend URL)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchInitialCredentials() {
  try {
    const res = await fetch(`${BASE_URL}/credentials`);
    if (!res.ok) throw new Error('Failed to load initial credentials');
    return await res.json();
  } catch (err) {
    console.warn('Initial credentials fetch failed:', err);
    return { api_key: '', api_secret: '' };
  }
}

export async function checkAuthStatus() {
  try {
    const res = await fetch(`${BASE_URL}/auth/status?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (!res.ok) return { authenticated: false };
    return await res.json();
  } catch (err) {
    console.error('Session check failed:', err);
    return { authenticated: false, message: err.message };
  }
}

export async function loginWithKite({ apiKey, apiSecret, requestToken }) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      api_secret: apiSecret,
      request_token: requestToken,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Login failed. Please verify credentials.');
  }
  return data;
}

export async function fetchUserProfile() {
  const res = await fetch(`${BASE_URL}/user/profile`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to fetch user profile.');
  }
  return data.data;
}

export async function logoutUser() {
  try {
    const res = await fetch(`${BASE_URL}/auth/logout?_t=${Date.now()}`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify({}),
    });
    return await res.json();
  } catch (err) {
    console.error('Logout error:', err);
    return { success: false };
  }
}

export async function scanSignals({ shortSma = 6, longSma = 30, lookbackDays = 100, maxStocks = 50 }) {
  const res = await fetch(`${BASE_URL}/signals/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      short_sma: Number(shortSma),
      long_sma: Number(longSma),
      lookback_days: Number(lookbackDays),
      max_stocks: Number(maxStocks),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to scan signals.');
  }
  return data;
}

export async function fetchScannerData(forceRefresh = false) {
  const url = `${BASE_URL}/scanner-data?force_refresh=${forceRefresh}&_t=${Date.now()}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to fetch scanner data.');
  }
  return data;
}

export async function fetchOhlcSnapshot(tokens = []) {
  if (!tokens || tokens.length === 0) return {};
  const tokenStr = Array.isArray(tokens) ? tokens.join(',') : tokens;
  const res = await fetch(`${BASE_URL}/ohlc?tokens=${tokenStr}&_t=${Date.now()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to fetch OHLC snapshot.');
  }
  return data;
}

export function getWebSocketUrl(tokens = [], mode = 'full') {
  const tokenStr = Array.isArray(tokens) ? tokens.join(',') : tokens;
  let wsOrigin = '';
  if (BASE_URL.startsWith('http')) {
    wsOrigin = BASE_URL.replace(/^http/, 'ws');
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsOrigin = `${protocol}//${window.location.host}${BASE_URL}`;
  }
  const baseClean = wsOrigin.replace(/\/+$/, '');
  const rootWs = baseClean.endsWith('/api') ? baseClean.slice(0, -4) : baseClean;
  return `${rootWs}/ws/ticks?tokens=${encodeURIComponent(tokenStr)}&mode=${encodeURIComponent(mode)}`;
}


