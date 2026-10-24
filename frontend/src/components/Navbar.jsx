import React from 'react';
import { ShieldCheck, LogOut, Activity, User, KeyRound } from 'lucide-react';

export default function Navbar({ isAuthenticated, user, onLogout }) {
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
              onClick={onLogout}
              className="btn btn-secondary btn-ghost"
              title="Logout and invalidate local backend session"
            >
              <LogOut size={16} />
              <span>Logout</span>
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

