import React, { useState } from 'react';
import { User, Shield, LayoutDashboard, TrendingUp } from 'lucide-react';
import UserTab from './UserTab';
import SignalsTab from './SignalsTab';
import SessionTab from './SessionTab';
import OverviewTab from './OverviewTab';

export default function Dashboard({ user, onLogout, isLoggingOut }) {
  // Default to the required 'user' tab
  const [activeTab, setActiveTab] = useState('user');

  return (
    <div className="animate-fade-in">
      {/* Dashboard Tabs Header */}
      <div className="tabs-header">
        <button
          className={`tab-btn ${activeTab === 'user' ? 'active' : ''}`}
          onClick={() => setActiveTab('user')}
        >
          <User size={18} />
          <span>User Profile</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'signals' ? 'active' : ''}`}
          onClick={() => setActiveTab('signals')}
        >
          <TrendingUp size={18} color="var(--accent-kite)" />
          <span style={{ fontWeight: activeTab === 'signals' ? 700 : 500 }}>Signals (SMA Scanner)</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'session' ? 'active' : ''}`}
          onClick={() => setActiveTab('session')}
        >
          <Shield size={18} />
          <span>Session & Persistence</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="tab-content">
        {activeTab === 'user' && <UserTab onLogout={onLogout} isLoggingOut={isLoggingOut} />}
        {activeTab === 'signals' && <SignalsTab />}
        {activeTab === 'overview' && <OverviewTab user={user} onSelectTab={setActiveTab} />}
        {activeTab === 'session' && <SessionTab user={user} onLogout={onLogout} isLoggingOut={isLoggingOut} />}
      </div>
    </div>
  );
}

