import React, { useState, useEffect, useRef } from 'react';
import { User, Shield, LayoutDashboard, TrendingUp, Zap, ShieldCheck } from 'lucide-react';
import UserTab from './UserTab';
import SignalsTab from './SignalsTab';
import AlgoSignalsTab from './AlgoSignalsTab';
import GttPlacementTab from './GttPlacementTab';
import SessionTab from './SessionTab';
import OverviewTab from './OverviewTab';
import { getWebSocketUrl } from '../api';

export default function Dashboard({ user, onLogout, isLoggingOut }) {
  // Default to the required 'user' tab
  const [activeTab, setActiveTab] = useState('user');

  // Shared state between Algo Signals and GTT Placement
  const [algoResults, setAlgoResults] = useState([]);
  const [scannedStocksCount, setScannedStocksCount] = useState(0);
  const [gttResults, setGttResults] = useState({});
  const [livePrices, setLivePrices] = useState({});
  const [wsStatus, setWsStatus] = useState('Idle');
  const [tickCount, setTickCount] = useState(0);

  const wsRef = useRef(null);

  // Single shared WebSocket connection for subscribed tokens
  useEffect(() => {
    const tokens = algoResults.map((r) => r.instrumentToken).filter(Boolean);
    if (tokens.length === 0) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsStatus('Idle');
      return;
    }

    const wsUrl = getWebSocketUrl(tokens, 'full');
    setWsStatus('Connecting...');

    let ws = null;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('Live Streaming');
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const ticks = Array.isArray(raw) ? raw : [raw];
          setLivePrices((prev) => {
            const next = { ...prev };
            for (const t of ticks) {
              if (t && t.instrument_token && t.last_price != null) {
                next[t.instrument_token] = t.last_price;
              }
            }
            return next;
          });
          setTickCount((c) => c + ticks.length);
        } catch (e) {
          console.warn('[DashboardWS] Tick parse error:', e);
        }
      };

      ws.onerror = () => {
        setWsStatus('Offline / Reconnecting');
      };

      ws.onclose = () => {
        setWsStatus('Closed');
      };
    } catch (e) {
      console.error('[DashboardWS] Failed to connect WebSocket:', e);
      setWsStatus('Failed');
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [algoResults]);

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
          className={`tab-btn ${activeTab === 'algo_signals' ? 'active' : ''}`}
          onClick={() => setActiveTab('algo_signals')}
        >
          <Zap size={18} color="#f59e0b" />
          <span style={{ fontWeight: activeTab === 'algo_signals' ? 700 : 500 }}>Algo Signals</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'gtt_placement' ? 'active' : ''}`}
          onClick={() => setActiveTab('gtt_placement')}
        >
          <ShieldCheck size={18} color="#38bdf8" />
          <span style={{ fontWeight: activeTab === 'gtt_placement' ? 700 : 500 }}>GTT Placement</span>
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
        {activeTab === 'algo_signals' && (
          <AlgoSignalsTab
            results={algoResults}
            setResults={setAlgoResults}
            scannedStocksCount={scannedStocksCount}
            setScannedStocksCount={setScannedStocksCount}
            livePrices={livePrices}
            setLivePrices={setLivePrices}
            wsStatus={wsStatus}
            tickCount={tickCount}
            onSignalsUpdated={(hits) => setAlgoResults(hits)}
            onGttResultsUpdated={(map) => setGttResults(map)}
            gttResults={gttResults}
          />
        )}
        {activeTab === 'gtt_placement' && (
          <GttPlacementTab
            algoResults={algoResults}
            gttResults={gttResults}
            livePrices={livePrices}
            wsStatus={wsStatus}
            tickCount={tickCount}
          />
        )}
        {activeTab === 'signals' && <SignalsTab />}
        {activeTab === 'overview' && <OverviewTab user={user} onSelectTab={setActiveTab} />}
        {activeTab === 'session' && <SessionTab user={user} onLogout={onLogout} isLoggingOut={isLoggingOut} />}
      </div>
    </div>
  );
}
