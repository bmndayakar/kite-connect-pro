import React from 'react';
import { ShieldCheck, LogOut, Activity, User, KeyRound } from 'lucide-react';

export default function Navbar({ isAuthenticated, user, onLogout, isLoggingOut }) {
  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="nav-logo-icon">
          <KeyRound size={20} />
        </div>
        <span>Kite Connect Hub</span>
      </div>

      <div className="nav-actions">
        {isAuthenticated ? (
          <>
            <div className="nav-user-badge">
              <span className="status-dot"></span>
              <User size={14} />
              <span>{user?.user_name || 'Trader'}</span>
              <strong>({user?.user_id || 'ID'})</strong>
            </div>

            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', cursor: isLoggingOut ? 'wait' : 'pointer' }}
              title="Logout and invalidate local backend session"
            >
              {isLoggingOut ? (
                <div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }}></div>
              ) : (
                <LogOut size={15} />
              )}
              <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </>
        ) : (
          <div className="nav-user-badge" style={{ borderColor: 'var(--border-subtle)' }}>
            <Activity size={14} color="var(--text-dim)" />
            <span>Not Connected</span>
          </div>
        )}
      </div>
    </header>
  );
}

