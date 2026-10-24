import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Activity,
  ExternalLink,
  Layers,
  Info,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  ArrowUpRight,
  Database
} from 'lucide-react';
import { fetchGttState } from '../api';

export default function GttPlacementTab({
  algoResults = [],
  gttResults = {},
  livePrices = {},
  wsStatus = 'Idle',
  tickCount = 0,
  onRefreshGttState,
  isRefreshingState = false
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [localStates, setLocalStates] = useState({});
  const [loadingInitialState, setLoadingInitialState] = useState(false);

  // Derive GTT candidates strictly from current Algo Signals
  // A stock appearing in Algo Signals becomes a GTT candidate.
  // A stock disappearing from Algo Signals disappears from the GTT table.
  const candidates = algoResults.map((hit) => {
    const ltp = livePrices[hit.instrumentToken] ?? hit.currentPrice;
    const buyPrice = hit.breakoutLow;
    const stoploss = buyPrice != null ? Number((buyPrice * 0.95).toFixed(2)) : null;

    // Priority: GTT placement result (after Run Live) -> Local state check result -> Default candidate shape
    const existingResult = gttResults[hit.symbol] || localStates[hit.symbol];

    return {
      symbol: hit.symbol,
      companyName: hit.companyName,
      instrumentToken: hit.instrumentToken,
      quantity: 1,
      buy_price: existingResult?.buy_price ?? buyPrice,
      stoploss: existingResult?.stoploss ?? stoploss,
      tick_size: existingResult?.tick_size ?? 0.05,
      last_price: ltp,
      account_state: existingResult?.account_state ?? (buyPrice ? 'checking' : 'invalid'),
      position_quantity: existingResult?.position_quantity ?? 0,
      active_buy_trigger_id: existingResult?.active_buy_trigger_id ?? null,
      active_stoploss_trigger_id: existingResult?.active_stoploss_trigger_id ?? null,
      day_buy_order_id: existingResult?.day_buy_order_id ?? null,
      day_buy_order_status: existingResult?.day_buy_order_status ?? null,
      buy_status: existingResult?.buy_status ?? (buyPrice ? (ltp ? 'ready' : 'waiting_for_ltp') : 'not_available'),
      buy_trigger_id: existingResult?.buy_trigger_id ?? null,
      stoploss_status: existingResult?.stoploss_status ?? 'planned_after_buy',
      stoploss_trigger_id: existingResult?.stoploss_trigger_id ?? null,
      message: existingResult?.message ?? (buyPrice ? 'Ready for buy GTT placement.' : 'Buy price is not available for this row.')
    };
  });

  // If gttResults hasn't populated state for newly appeared symbols, check state via POST /api/algo-orders/gtt-state
  useEffect(() => {
    async function loadInitialStates() {
      const unpopulated = candidates.filter(
        (c) => !gttResults[c.symbol] && !localStates[c.symbol] && c.buy_price
      );
      if (unpopulated.length === 0) return;

      try {
        setLoadingInitialState(true);
        const ordersToCheck = unpopulated.map((c) => ({
          symbol: c.symbol,
          quantity: 1,
          buy_price: c.buy_price,
          stoploss: c.stoploss,
          last_price: c.last_price
        }));

        const states = await fetchGttState(ordersToCheck);
        const map = {};
        states.forEach((st) => {
          if (st && st.symbol) {
            map[st.symbol] = st;
          }
        });
        setLocalStates((prev) => ({ ...prev, ...map }));
      } catch (err) {
        console.warn('[GttPlacement] State check failed:', err);
      } finally {
        setLoadingInitialState(false);
      }
    }

    if (algoResults.length > 0) {
      loadInitialStates();
    }
  }, [algoResults]);

  const selectedItem = candidates.find((c) => c.symbol === selectedSymbol) || candidates[0];

  const getAccountStateBadge = (state) => {
    const s = String(state || '').toLowerCase();
    if (s === 'clear') {
      return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', text: 'CLEAR' };
    }
    if (s === 'blocked') {
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', text: 'BLOCKED' };
    }
    if (s === 'already_active') {
      return { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', text: 'ALREADY ACTIVE' };
    }
    if (s === 'waiting') {
      return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'WAITING' };
    }
    return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', text: s.toUpperCase() || 'UNKNOWN' };
  };

  const getBuyStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'success') {
      return { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', text: 'SUCCESS (DUMMY)' };
    }
    if (s === 'ready') {
      return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', text: 'READY' };
    }
    if (s === 'already_active') {
      return { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', text: 'ALREADY ACTIVE' };
    }
    if (s === 'blocked') {
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', text: 'BLOCKED' };
    }
    if (s === 'waiting_for_ltp') {
      return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'WAITING FOR LTP' };
    }
    if (s === 'not_available') {
      return { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', text: 'NOT AVAILABLE' };
    }
    if (s === 'failed') {
      return { bg: 'rgba(220, 38, 38, 0.2)', color: '#ef4444', text: 'FAILED' };
    }
    return { bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', text: s.toUpperCase() || 'CHECKING' };
  };

  // Metrics
  const dummyCount = candidates.filter((c) => c.buy_trigger_id && String(c.buy_trigger_id).startsWith('DUMMY-')).length;
  const readyCount = candidates.filter((c) => c.buy_status === 'ready').length;
  const blockedCount = candidates.filter((c) => c.buy_status === 'blocked' || c.buy_status === 'already_active').length;

  return (
    <div
      style={{
        backgroundColor: '#090d16',
        color: '#f1f5f9',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1px solid #1e293b',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
        minHeight: '700px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header & Page Title */}
      <div
        style={{
          borderBottom: '1px solid #1e293b',
          paddingBottom: '1.25rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShieldCheck size={14} />
            GTT Placement
          </span>
          <span
            style={{
              fontSize: '0.8rem',
              color: '#94a3b8',
              backgroundColor: '#1e293b',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            Read-Only Simulation Mode
          </span>
        </div>
        <h2
          style={{
            fontSize: '1.45rem',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0.4rem 0 0.2rem 0',
            letterSpacing: '-0.02em',
          }}
        >
          GTT Order Placement
        </h2>
        <p style={{ margin: 0, fontSize: '0.825rem', color: '#94a3b8' }}>
          Read-only status from Algo Signals · Qty 1 · Buy GTT at breakout candle low · Stoploss 5% below buy · State from Kite orders, positions, holdings, and GTTs
        </p>
      </div>

      {/* Compact Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '0.85rem',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Signal Candidates
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
              {candidates.length}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              padding: '8px',
              borderRadius: '8px',
            }}
          >
            <Layers size={20} />
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Dummy GTTs Active
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#22c55e', marginTop: '2px' }}>
              {dummyCount}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: '#22c55e',
              padding: '8px',
              borderRadius: '8px',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Blocked / Active In Kite
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f87171', marginTop: '2px' }}>
              {blockedCount}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              padding: '8px',
              borderRadius: '8px',
            }}
          >
            <Ban size={20} />
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Live Price Feed
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: wsStatus.includes('Live') ? '#22c55e' : wsStatus.includes('Connecting') ? '#f59e0b' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '4px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: wsStatus.includes('Live') ? '#22c55e' : wsStatus.includes('Connecting') ? '#f59e0b' : '#64748b',
                  display: 'inline-block',
                }}
              />
              {wsStatus} {tickCount > 0 && `(${tickCount} ticks)`}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: '#22c55e',
              padding: '8px',
              borderRadius: '8px',
            }}
          >
            <Activity size={20} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div
        style={{
          backgroundColor: '#0c121e',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0f172a',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldCheck size={18} color="#38bdf8" />
            Kite GTT Placement
          </h3>
          <span style={{ fontSize: '0.775rem', color: '#64748b' }}>
            Read-only status • Trigger dummy creation via 'Run Live' button in Algo Signals tab
          </span>
        </div>

        {/* Empty State */}
        {candidates.length === 0 && (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '0.925rem',
            }}
          >
            <Info size={32} color="#64748b" style={{ margin: '0 auto 0.75rem auto' }} />
            <div style={{ color: '#f1f5f9', fontWeight: 600 }}>
              No GTT candidates available.
            </div>
            <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: '440px', margin: '0.5rem auto 0 auto' }}>
              No setups are currently returned by Algo Signals. Once institutional breakout setups trigger in Algo Signals, they will appear here as GTT candidates.
            </p>
          </div>
        )}

        {/* Candidates Table */}
        {candidates.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.8rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: '#0a0f1d',
                    borderBottom: '1px solid #1e293b',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    fontSize: '0.7rem',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <th style={{ padding: '0.7rem 0.85rem', width: '45px', textAlign: 'center' }}>Rank</th>
                  <th style={{ padding: '0.7rem 0.9rem' }}>Symbol</th>
                  <th style={{ padding: '0.7rem 0.6rem', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '0.7rem 0.85rem', textAlign: 'right' }}>Buy</th>
                  <th style={{ padding: '0.7rem 0.85rem', textAlign: 'right' }}>Stoploss</th>
                  <th style={{ padding: '0.7rem 0.85rem', textAlign: 'right' }}>Last Price</th>
                  <th style={{ padding: '0.7rem 0.85rem' }}>Account State</th>
                  <th style={{ padding: '0.7rem 0.85rem' }}>Buy Status</th>
                  <th style={{ padding: '0.7rem 0.85rem' }}>Buy Trigger</th>
                  <th style={{ padding: '0.7rem 0.85rem' }}>Day Buy Order</th>
                  <th style={{ padding: '0.7rem 0.6rem', textAlign: 'center' }}>Position Qty</th>
                  <th style={{ padding: '0.7rem 0.85rem' }}>Stoploss Status</th>
                  <th style={{ padding: '0.7rem 0.85rem' }}>Stoploss Trigger</th>
                  <th style={{ padding: '0.7rem 1rem' }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((row, index) => {
                  const isSelected = selectedSymbol === row.symbol;
                  const chartUrl = row.instrumentToken
                    ? `https://kite.zerodha.com/chart/ext/tvc/NSE/${encodeURIComponent(row.symbol)}/${row.instrumentToken}`
                    : `https://kite.zerodha.com/chart/ext/tvc/NSE/${encodeURIComponent(row.symbol)}`;

                  const acctBadge = getAccountStateBadge(row.account_state);
                  const buyBadge = getBuyStatusBadge(row.buy_status);

                  return (
                    <tr
                      key={row.symbol}
                      onClick={() => setSelectedSymbol(row.symbol)}
                      style={{
                        backgroundColor: isSelected
                          ? 'rgba(56, 189, 248, 0.12)'
                          : index % 2 === 0
                          ? 'transparent'
                          : 'rgba(255, 255, 255, 0.015)',
                        borderBottom: '1px solid #1e293b',
                        borderLeft: isSelected ? '3px solid #38bdf8' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.12s ease',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor =
                            index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)';
                        }
                      }}
                    >
                      {/* Rank */}
                      <td
                        style={{
                          padding: '0.65rem 0.85rem',
                          textAlign: 'center',
                          color: '#64748b',
                          fontWeight: 600,
                        }}
                      >
                        {index + 1}
                      </td>

                      {/* Symbol */}
                      <td style={{ padding: '0.65rem 0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <a
                            href={chartUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={`Open ${row.symbol} chart in Zerodha Kite`}
                            style={{
                              color: '#38bdf8',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            {row.symbol}
                            <ExternalLink size={11} color="#0284c7" />
                          </a>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {row.companyName}
                        </div>
                      </td>

                      {/* Qty */}
                      <td style={{ padding: '0.65rem 0.6rem', textAlign: 'center', fontWeight: 600, color: '#f1f5f9' }}>
                        {row.quantity}
                      </td>

                      {/* Buy (breakout candle low) */}
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {row.buy_price != null ? (
                          <span style={{ color: '#ffffff' }}>₹{Number(row.buy_price).toFixed(2)}</span>
                        ) : (
                          <span style={{ color: '#64748b' }}>N/A</span>
                        )}
                      </td>

                      {/* Stoploss (5% below buy) */}
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {row.stoploss != null ? (
                          <span style={{ color: '#f87171' }}>₹{Number(row.stoploss).toFixed(2)}</span>
                        ) : (
                          <span style={{ color: '#64748b' }}>N/A</span>
                        )}
                      </td>

                      {/* Last Price */}
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {row.last_price != null && row.last_price > 0 ? (
                          <span style={{ color: '#38bdf8' }}>₹{Number(row.last_price).toFixed(2)}</span>
                        ) : (
                          <span style={{ color: '#fbbf24', fontStyle: 'italic', fontWeight: 500 }}>Waiting</span>
                        )}
                      </td>

                      {/* Account State */}
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            backgroundColor: acctBadge.bg,
                            color: acctBadge.color,
                          }}
                        >
                          {acctBadge.text}
                        </span>
                      </td>

                      {/* Buy Status */}
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            backgroundColor: buyBadge.bg,
                            color: buyBadge.color,
                          }}
                        >
                          {buyBadge.text}
                        </span>
                      </td>

                      {/* Buy Trigger */}
                      <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#cbd5e1' }}>
                        {row.buy_trigger_id || row.active_buy_trigger_id || '-'}
                      </td>

                      {/* Day Buy Order */}
                      <td style={{ padding: '0.65rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                        {row.day_buy_order_id ? (
                          <span style={{ color: '#f87171' }}>
                            {row.day_buy_order_id} ({row.day_buy_order_status})
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Position Qty */}
                      <td style={{ padding: '0.65rem 0.6rem', textAlign: 'center', color: row.position_quantity > 0 ? '#f87171' : '#64748b', fontWeight: 600 }}>
                        {row.position_quantity || 0}
                      </td>

                      {/* Stoploss Status */}
                      <td style={{ padding: '0.65rem 0.85rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                        <span
                          style={{
                            backgroundColor: 'rgba(148, 163, 184, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#94a3b8',
                          }}
                        >
                          {row.stoploss_status || 'planned_after_buy'}
                        </span>
                      </td>

                      {/* Stoploss Trigger */}
                      <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#cbd5e1' }}>
                        {row.stoploss_trigger_id || row.active_stoploss_trigger_id || '-'}
                      </td>

                      {/* Message */}
                      <td
                        style={{
                          padding: '0.65rem 1rem',
                          color: row.buy_status === 'success' ? '#4ade80' : row.buy_status === 'blocked' ? '#f87171' : '#cbd5e1',
                          fontSize: '0.75rem',
                          maxWidth: '300px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={row.message}
                      >
                        {row.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Setup Inspector */}
      {selectedItem && (
        <div
          style={{
            marginTop: '1.25rem',
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '10px',
            padding: '1.15rem 1.35rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1rem',
              borderBottom: '1px solid #1e293b',
              paddingBottom: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                GTT Setup Inspector
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', marginTop: '2px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                  {selectedItem.symbol}
                </span>
                <span style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                  {selectedItem.companyName}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: selectedItem.buy_status === 'success' ? '#4ade80' : '#94a3b8',
                  backgroundColor: '#090d16',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #1e293b',
                }}
              >
                {selectedItem.message}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              fontSize: '0.825rem',
            }}
          >
            <div style={{ backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Dummy Buy Trigger</div>
              <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>
                {selectedItem.buy_price != null ? `₹${selectedItem.buy_price.toFixed(2)}` : 'N/A'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                Breakout candle low (tick rounded)
              </div>
            </div>

            <div style={{ backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Stoploss Trigger</div>
              <div style={{ color: '#f87171', fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>
                {selectedItem.stoploss != null ? `₹${selectedItem.stoploss.toFixed(2)}` : 'N/A'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                5% below buy (planned after buy)
              </div>
            </div>

            <div style={{ backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Risk Per Share</div>
              <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>
                {selectedItem.buy_price && selectedItem.stoploss ? `₹${(selectedItem.buy_price - selectedItem.stoploss).toFixed(2)}` : 'N/A'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                Buy price minus stoploss
              </div>
            </div>

            <div style={{ backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Active Trigger ID</div>
              <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem', marginTop: '2px', fontFamily: 'monospace' }}>
                {selectedItem.buy_trigger_id || selectedItem.active_buy_trigger_id || 'None'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                Simulated trigger ID with DUMMY- prefix
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
