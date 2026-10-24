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
    const res = await fetch(`${BASE_URL}/auth/status`);
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
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
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


