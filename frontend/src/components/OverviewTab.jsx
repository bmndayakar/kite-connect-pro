import React from 'react';
import { Activity, ShieldCheck, Zap, Compass, ExternalLink, BarChart3, Clock, TrendingUp } from 'lucide-react';

export default function OverviewTab({ user, onSelectTab }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Welcome Banner */}
      <div
        className="card"
        style={{
          background: 'radial-gradient(ellipse at top right, rgba(240, 89, 43, 0.08), transparent 60%), var(--bg-card)',
          padding: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span className="badge badge-kite">Kite Connect Active</span>
          <span className="badge badge-green">Ready for Trading</span>
        </div>
        <h2 style={{ fontSize: '1.65rem', fontWeight: 700, marginTop: '0.25rem' }}>
          Welcome back, {user?.user_name || 'Trader'}!
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '650px', marginTop: '0.5rem', lineHeight: 1.5 }}>
          Your Zerodha Kite session is active and securely persisted. You can inspect your authorized products and exchanges in the <strong>User Tab</strong>, or review session persistence details in the <strong>Session Tab</strong>.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => onSelectTab('signals')}>
            <TrendingUp size={16} />
            <span>Launch SMA Crossover Scanner</span>
          </button>
          <button className="btn btn-secondary" onClick={() => onSelectTab('user')}>
            <span>View User Profile & Products</span>
          </button>
          <button className="btn btn-secondary" onClick={() => onSelectTab('session')}>
            <span>Inspect Session & Tokens</span>
          </button>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--accent-kite-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-kite)', marginBottom: '0.85rem' }}>
            <Zap size={20} />
          </div>
          <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>FastAPI Backend</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
            High-performance asynchronous Python backend managing all OAuth tokens and communicating with Kite Connect SDK.
          </p>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--accent-green-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-green)', marginBottom: '0.85rem' }}>
            <ShieldCheck size={20} />
          </div>
          <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Zero Token Leakage</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
            The Kite <code>access_token</code> is never passed to frontend browsers, eliminating token leakage risks in logs or developer tools.
          </p>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--accent-blue-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)', marginBottom: '0.85rem' }}>
            <BarChart3 size={20} />
          </div>
          <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Modular & Customizable</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
            Built using modern React + Vite with clean CSS variables and modular tabs, ready for adding orders, watchlists, or algorithmic strategies.
          </p>
        </div>
      </div>
    </div>
  );
}

