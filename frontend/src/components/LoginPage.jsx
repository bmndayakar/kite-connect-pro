import React, { useState, useEffect } from 'react';
import { Key, Lock, ArrowRight, ExternalLink, RefreshCw, Eye, EyeOff, AlertCircle, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { fetchInitialCredentials, loginWithKite } from '../api';

export default function LoginPage({ onLoginSuccess, isCheckingExistingSession, onSkipSessionCheck }) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [requestToken, setRequestToken] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prefilled, setPrefilled] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live timer while checking session
  useEffect(() => {
    let interval;
    if (isCheckingExistingSession) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCheckingExistingSession]);

  // Load initial credentials from credentials.txt if available
  useEffect(() => {
    async function initCreds() {
      const creds = await fetchInitialCredentials();
      if (creds.api_key) {
        setApiKey(creds.api_key);
        setPrefilled(true);
      }
      if (creds.api_secret) {
        setApiSecret(creds.api_secret);
      }
      if (creds.request_token) {
        setRequestToken(creds.request_token);
      }
    }
    initCreds();
  }, []);

  const handleOpenLoginUrl = () => {
    if (!apiKey.trim()) {
      setError('Please enter your Kite API Key first to generate the login link.');
      return;
    }
    setError(null);
    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(apiKey.trim())}`;
    window.open(loginUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!apiKey.trim() || !apiSecret.trim() || !requestToken.trim()) {
      setError('Please fill in all three fields: API Key, API Secret, and Request Token.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await loginWithKite({
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        requestToken: requestToken.trim(),
      });

      if (response.success) {
        onLoginSuccess(response.user);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials and request token.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingExistingSession) {
    return (
      <div
        className="animate-fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: '2rem 1rem',
        }}
      >
        <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '2.25rem 2rem' }}>
          <div
            className="spinner"
            style={{
              width: '40px',
              height: '40px',
              borderTopColor: 'var(--accent-kite)',
              margin: '0 auto 1.25rem auto',
            }}
          ></div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
            Checking for active backend session...
          </h3>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
            {elapsedSeconds < 3
              ? 'Verifying saved authentication token with the server...'
              : `Connecting to backend... If inactive, Render free-tier takes ~30s to warm up. (Elapsed: ${elapsedSeconds}s)`}
          </p>

          <button
            type="button"
            onClick={onSkipSessionCheck}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              margin: '0 auto',
            }}
          >
            <span>Skip Wait & Enter Credentials</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '540px', margin: '1rem auto' }} className="animate-fade-in">
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--accent-kite), #c2330a)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
              marginBottom: '1rem',
            }}
          >
            <Key size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Zerodha Kite Connect
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Enter your credentials to generate and securely persist your daily access token.
          </p>
        </div>

        {elapsedSeconds >= 4 && (
          <div className="alert alert-info" style={{ padding: '0.65rem 0.9rem', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            <Clock size={16} />
            <span>Backend is warming up on Render. You can fill out your credentials below to log in immediately.</span>
          </div>
        )}

        {prefilled && (
          <div className="alert alert-info" style={{ padding: '0.65rem 0.9rem', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            <Sparkles size={16} />
            <span>Pre-filled API Key & Secret from your local <code>credentials.txt</code> file.</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Authentication Error:</strong>
              <div style={{ marginTop: '0.25rem', fontSize: '0.84rem' }}>{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* API Key */}
          <div className="form-group">
            <label className="form-label">
              <span>API Key</span>
              <a
                href="https://developers.kite.trade/apps"
                target="_blank"
                rel="noreferrer"
                className="helper-link"
              >
                Developer Console <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </a>
            </label>
            <div className="input-container">
              <input
                type="text"
                className="form-input"
                placeholder="e.g. cjjsz6kwpe6oom15"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>

          {/* API Secret */}
          <div className="form-group">
            <label className="form-label">
              <span>API Secret</span>
            </label>
            <div className="input-container">
              <input
                type={showSecret ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter your Kite API Secret"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                autoComplete="off"
                required
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowSecret(!showSecret)}
                title={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Request Token with Quick Launcher */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <div className="form-label">
              <span>Request Token</span>
              <button
                type="button"
                onClick={handleOpenLoginUrl}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-kite)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <span>Get Request Token via Kite Login</span>
                <ExternalLink size={13} />
              </button>
            </div>
            <div className="input-container">
              <input
                type="text"
                className="form-input"
                placeholder="Paste the request_token from the redirected URL"
                value={requestToken}
                onChange={(e) => setRequestToken(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.4rem', lineHeight: 1.4 }}>
              💡 Click <strong>Get Request Token</strong> above, log in with Zerodha + TOTP, then copy the <code>request_token</code> from your browser URL.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="spinner"></div>
                <span>Generating Session...</span>
              </>
            ) : (
              <>
                <span>Login & Enter Dashboard</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Security & Local Dev Reuse Callout */}
        <div
          style={{
            marginTop: '1.75rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.82rem',
            color: 'var(--text-dim)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-green)', fontWeight: 600, marginBottom: '0.35rem' }}>
            <CheckCircle2 size={15} />
            <span>Secure Backend Session Persistence</span>
          </div>
          Your access token is generated via the Kite Connect SDK and saved on the FastAPI backend. It is <strong>never exposed to the browser</strong> and is automatically reused across local code changes so you don't need to re-login every time!
        </div>
      </div>
    </div>
  );
}

