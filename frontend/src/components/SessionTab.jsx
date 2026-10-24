import React from 'react';
import { ShieldCheck, HardDrive, RefreshCw, Clock, Terminal, AlertTriangle, CheckCircle } from 'lucide-react';

export default function SessionTab({ user }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Session Security Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), var(--bg-card))',
          borderLeft: '4px solid var(--accent-green)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-green)',
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Access Token Stored Securely on Backend</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Compliant with financial security best practices: the raw Zerodha <code>access_token</code> is stored server-side in <code>backend/session.json</code> and never transmitted to the client browser.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Developer Persistence & Expiry Rules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Local Dev Persistence */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' }}>
            <HardDrive size={20} color="#0284c7" />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Local Development Persistence</h4>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            To protect your developer workflow from friction:
          </p>
          <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>
              Hot Module Replacement (HMR) and browser page reloads <strong>will not log you out</strong>.
            </li>
            <li>
              When the frontend boots, it automatically calls <code>/api/auth/status</code> to verify the backend session.
            </li>
            <li>
              The saved token is automatically reused across server reloads and frontend edits.
            </li>
          </ul>
        </div>

        {/* Zerodha Expiry Policy */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' }}>
            <Clock size={20} color="#f59e0b" />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Zerodha Daily Expiration Policy</h4>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Zerodha mandates that all Kite Connect access tokens expire strictly every morning:
          </p>
          <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
              ⏰ Daily Reset Time: 06:00 AM IST
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
              After 6:00 AM, Kite invalidates the previous day's token. Simply enter a fresh <code>request_token</code> each morning to renew for the entire trading day.
            </div>
          </div>
        </div>
      </div>

      {/* Code Snippet */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' }}>
          <Terminal size={18} color="var(--accent-kite)" />
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>How Backend Reuses the Session in Python</h4>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Any custom scripts or algorithms in this workspace can reuse the authenticated session directly:
        </p>

        <pre
          style={{
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            color: '#0f172a',
            overflowX: 'auto',
            lineHeight: 1.5,
          }}
        >
{`from backend.kite_service import kite_manager

# kite_manager has the initialized, authenticated KiteConnect instance:
kite = kite_manager.kite

# Fetch holdings, orders, or quotes seamlessly:
profile = kite.profile()
print(f"Logged in as: {profile['user_name']} ({profile['user_id']})")

# Example: Get quote for NIFTY 50
# quotes = kite.quote(["NSE:NIFTY 50"])`}
        </pre>
      </div>
    </div>
  );
}

