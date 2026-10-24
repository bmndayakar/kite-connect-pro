import React, { useState, useEffect } from 'react';
import { User, Shield, RefreshCw, Layers, TrendingUp, Mail, Building, Tag, Check, AlertCircle } from 'lucide-react';
import { fetchUserProfile } from '../api';

// Friendly descriptions for Zerodha product codes
const PRODUCT_DESCRIPTIONS = {
  CNC: 'Cash and Carry (Equity Delivery / Zero Leverage)',
  MIS: 'Margin Intraday Square-off (Intraday Equity & F&O)',
  NRML: 'Normal Product (Overnight F&O & Currency Futures)',
  BO: 'Bracket Order (Target + Stoploss Intraday)',
  CO: 'Cover Order (Market/Limit + Mandatory Stoploss)',
};

// Friendly descriptions for Exchanges
const EXCHANGE_DESCRIPTIONS = {
  NSE: 'National Stock Exchange (Equities & Derivatives)',
  BSE: 'Bombay Stock Exchange (Equities & Mutual Funds)',
  NFO: 'NSE Futures & Options (Index & Stock Derivatives)',
  MCX: 'Multi Commodity Exchange (Commodity Derivatives)',
  CDS: 'Currency Derivatives Segment (USDINR, EURINR, etc.)',
  BFO: 'BSE Futures & Options',
};

export default function UserTab() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchUserProfile();
      setProfile(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch user profile from Zerodha API.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
        <div className="spinner" style={{ width: '32px', height: '32px', borderTopColor: 'var(--accent-kite)' }}></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Calling backend <code>/api/user/profile</code> (KiteConnect SDK)...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '2rem auto' }}>
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <div>
            <strong>Error Fetching Profile:</strong>
            <p style={{ marginTop: '0.25rem' }}>{error}</p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => loadProfile(true)}>
          <RefreshCw size={16} />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner: Profile Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
          borderLeft: '4px solid var(--accent-kite)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-kite), #e64a19)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'white',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            {profile?.user_name ? profile.user_name.charAt(0) : 'U'}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {profile?.user_name || 'Zerodha User'}
              </h2>
              <span className="badge badge-green">
                <Check size={12} />
                <span>Verified Account</span>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Client ID: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{profile?.user_id}</strong>
              </span>
              <span style={{ color: 'var(--border-subtle)' }}>•</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Broker: <strong style={{ color: '#0284c7' }}>{profile?.broker || 'ZERODHA'}</strong>
              </span>
              {profile?.user_type && (
                <>
                  <span style={{ color: 'var(--border-subtle)' }}>•</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Type: <strong style={{ textTransform: 'capitalize' }}>{profile.user_type}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => loadProfile(true)}
          className="btn btn-secondary"
          disabled={refreshing}
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} className={refreshing ? 'spinner' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Profile'}</span>
        </button>
      </div>

      {/* Grid: Products and Exchanges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Products Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <Layers size={20} color="var(--accent-kite)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Enabled Products</h3>
            <span className="badge badge-kite" style={{ marginLeft: 'auto' }}>
              {profile?.products?.length || 0} Products
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Order product types enabled and authorized on your Zerodha trading account:
          </p>

          <div className="chips-grid">
            {profile?.products?.length > 0 ? (
              profile.products.map((prod) => (
                <div key={prod} className="product-chip">
                  <span className="product-chip-code">{prod}</span>
                  <span className="product-chip-desc">
                    {PRODUCT_DESCRIPTIONS[prod] || 'Standard Product Type'}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No products listed.</span>
            )}
          </div>
        </div>

        {/* Exchanges Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={20} color="#a78bfa" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Enabled Exchanges</h3>
            <span className="badge badge-purple" style={{ marginLeft: 'auto' }}>
              {profile?.exchanges?.length || 0} Exchanges
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Market segments and exchanges active on your trading account:
          </p>

          <div className="chips-grid">
            {profile?.exchanges?.length > 0 ? (
              profile.exchanges.map((exch) => (
                <div key={exch} className="exchange-chip">
                  <span className="status-dot" style={{ backgroundColor: '#10b981', boxShadow: '0 0 6px #10b981' }}></span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{exch}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                      {EXCHANGE_DESCRIPTIONS[exch] || 'Active Market Segment'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No exchanges listed.</span>
            )}
          </div>
        </div>
      </div>

      {/* Account Metadata Row */}
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
          Additional Account Information
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {profile?.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Mail size={16} color="var(--text-dim)" />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Registered Email</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{profile.email}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Building size={16} color="var(--text-dim)" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Depository / Broker</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{profile?.broker || 'Zerodha Broking Limited'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Tag size={16} color="var(--text-dim)" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Allowed Order Types</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                {profile?.order_types ? profile.order_types.join(', ') : 'MARKET, LIMIT, SL, SL-M'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

