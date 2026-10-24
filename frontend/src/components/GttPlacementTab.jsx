import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Activity,
  ExternalLink,
  Layers,
  Info,
  CheckCircle2,
  Ban,
  ArrowUpRight
} from 'lucide-react';
import { fetchGttState } from '../api';

export default function GttPlacementTab({
  algoResults = [],
  gttResults = {},
  livePrices = {},
  wsStatus = 'Idle',
  tickCount = 0
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [localStates, setLocalStates] = useState({});

  // Derive GTT candidates strictly from current Algo Signals
  const candidates = algoResults.map((hit) => {
    const ltp = livePrices[hit.instrumentToken] ?? hit.currentPrice;
    const buyPrice = hit.breakoutLow;
    const stoploss = buyPrice != null ? Number((buyPrice * 0.95).toFixed(2)) : null;

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

  // Background state check for candidates without status yet
  useEffect(() => {
    async function loadInitialStates() {
      const unpopulated = candidates.filter(
        (c) => !gttResults[c.symbol] && !localStates[c.symbol] && c.buy_price
      );
      if (unpopulated.length === 0) return;

      try {
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
      return { bg: 'var(--accent-green-subtle)', color: 'var(--accent-green)', text: 'CLEAR' };
    }
    if (s === 'blocked') {
      return { bg: 'var(--danger-subtle)', color: 'var(--danger)', text: 'BLOCKED' };
    }
    if (s === 'already_active') {
      return { bg: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)', text: 'ALREADY ACTIVE' };
    }
    if (s === 'waiting') {
      return { bg: '#fffbeb', color: '#b45309', text: 'WAITING' };
    }
    return { bg: 'var(--bg-primary)', color: 'var(--text-muted)', text: s.toUpperCase() || 'UNKNOWN' };
  };

  const getBuyStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'success') {
      return { bg: 'var(--accent-green-subtle)', color: 'var(--accent-green)', text: 'SUCCESS (DUMMY)' };
    }
    if (s === 'ready') {
      return { bg: '#ecfdf5', color: '#059669', text: 'READY' };
    }
    if (s === 'already_active') {
      return { bg: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)', text: 'ALREADY ACTIVE' };
    }
    if (s === 'blocked') {
      return { bg: 'var(--danger-subtle)', color: 'var(--danger)', text: 'BLOCKED' };
    }
    if (s === 'waiting_for_ltp') {
      return { bg: '#fffbeb', color: '#b45309', text: 'WAITING FOR LTP' };
    }
    if (s === 'not_available') {
      return { bg: 'var(--bg-primary)', color: 'var(--text-muted)', text: 'NOT AVAILABLE' };
    }
    if (s === 'failed') {
      return { bg: 'var(--danger-subtle)', color: 'var(--danger)', text: 'FAILED' };
    }
    return { bg: 'var(--bg-primary)', color: 'var(--text-muted)', text: s.toUpperCase() || 'CHECKING' };
  };

  const dummyCount = candidates.filter((c) => c.buy_trigger_id && String(c.buy_trigger_id).startsWith('DUMMY-')).length;
  const blockedCount = candidates.filter((c) => c.buy_status === 'blocked' || c.buy_status === 'already_active').length;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Card */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <span
            style={{
              backgroundColor: 'var(--accent-blue-subtle)',
              color: 'var(--accent-blue)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
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
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
            }}
          >
            Read-Only Simulation Mode
          </span>
        </div>
        <h2
          style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          GTT Order Placement
        </h2>
        <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Read-only status from Algo Signals · Qty 1 · Buy GTT at breakout candle low · Stoploss 5% below buy · State from Kite orders, positions, holdings, and GTTs
        </p>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Signal Candidates
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '2px' }}>
              {candidates.length}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'var(--accent-blue-subtle)',
              color: 'var(--accent-blue)',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Layers size={20} />
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Dummy GTTs Active
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: '2px' }}>
              {dummyCount}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'var(--accent-green-subtle)',
              color: 'var(--accent-green)',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Blocked / Active In Kite
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }}>
              {blockedCount}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'var(--danger-subtle)',
              color: 'var(--danger)',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Ban size={20} />
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Live Price Feed
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: wsStatus.includes('Live') ? 'var(--accent-green)' : wsStatus.includes('Connecting') ? '#d97706' : 'var(--text-muted)',
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
                  backgroundColor: wsStatus.includes('Live') ? 'var(--accent-green)' : wsStatus.includes('Connecting') ? '#d97706' : 'var(--text-dim)',
                  display: 'inline-block',
                }}
              />
              {wsStatus} {tickCount > 0 && `(${tickCount} ticks)`}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'var(--accent-green-subtle)',
              color: 'var(--accent-green)',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Activity size={20} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldCheck size={18} color="var(--accent-blue)" />
            Kite GTT Placement
          </h3>
          <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
            Read-only status • Trigger dummy creation via 'Run Live' button in Algo Signals tab
          </span>
        </div>

        {/* Empty State */}
        {candidates.length === 0 && (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.925rem',
            }}
          >
            <Info size={32} color="var(--text-dim)" style={{ margin: '0 auto 0.75rem auto' }} />
            <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>
              No GTT candidates available.
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0.5rem auto 0 auto' }}>
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
                fontSize: '0.825rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontSize: '0.7rem',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <th style={{ padding: '0.75rem 0.85rem', width: '45px', textAlign: 'center' }}>Rank</th>
                  <th style={{ padding: '0.75rem 0.9rem' }}>Symbol</th>
                  <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Buy</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Stoploss</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Last Price</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>Account State</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>Buy Status</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>Buy Trigger</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>Day Buy Order</th>
                  <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center' }}>Position Qty</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>Stoploss Status</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>Stoploss Trigger</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Message</th>
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
                          ? 'var(--accent-blue-subtle)'
                          : index % 2 === 0
                          ? '#ffffff'
                          : '#fafafa',
                        borderBottom: '1px solid var(--border-subtle)',
                        borderLeft: isSelected ? '3px solid var(--accent-blue)' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.12s ease',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor =
                            index % 2 === 0 ? '#ffffff' : '#fafafa';
                        }
                      }}
                    >
                      <td
                        style={{
                          padding: '0.7rem 0.85rem',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                        }}
                      >
                        {index + 1}
                      </td>

                      <td style={{ padding: '0.7rem 0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <a
                            href={chartUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={`Open ${row.symbol} chart in Zerodha Kite`}
                            style={{
                              color: 'var(--accent-blue)',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            {row.symbol}
                            <ExternalLink size={11} color="var(--accent-blue)" />
                          </a>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {row.companyName}
                        </div>
                      </td>

                      <td style={{ padding: '0.7rem 0.6rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-main)' }}>
                        {row.quantity}
                      </td>

                      <td style={{ padding: '0.7rem 0.85rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {row.buy_price != null ? (
                          <span style={{ color: 'var(--text-main)' }}>₹{Number(row.buy_price).toFixed(2)}</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>N/A</span>
                        )}
                      </td>

                      <td style={{ padding: '0.7rem 0.85rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {row.stoploss != null ? (
                          <span style={{ color: 'var(--danger)' }}>₹{Number(row.stoploss).toFixed(2)}</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>N/A</span>
                        )}
                      </td>

                      <td style={{ padding: '0.7rem 0.85rem', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {row.last_price != null && row.last_price > 0 ? (
                          <span style={{ color: 'var(--accent-blue)' }}>₹{Number(row.last_price).toFixed(2)}</span>
                        ) : (
                          <span style={{ color: '#b45309', fontStyle: 'italic', fontWeight: 500 }}>Waiting</span>
                        )}
                      </td>

                      <td style={{ padding: '0.7rem 0.85rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            backgroundColor: acctBadge.bg,
                            color: acctBadge.color,
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {acctBadge.text}
                        </span>
                      </td>

                      <td style={{ padding: '0.7rem 0.85rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            backgroundColor: buyBadge.bg,
                            color: buyBadge.color,
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {buyBadge.text}
                        </span>
                      </td>

                      <td style={{ padding: '0.7rem 0.85rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {row.buy_trigger_id || row.active_buy_trigger_id || '-'}
                      </td>

                      <td style={{ padding: '0.7rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {row.day_buy_order_id ? (
                          <span style={{ color: 'var(--danger)' }}>
                            {row.day_buy_order_id} ({row.day_buy_order_status})
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td style={{ padding: '0.7rem 0.6rem', textAlign: 'center', color: row.position_quantity > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {row.position_quantity || 0}
                      </td>

                      <td style={{ padding: '0.7rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        <span
                          style={{
                            backgroundColor: 'var(--bg-primary)',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {row.stoploss_status || 'planned_after_buy'}
                        </span>
                      </td>

                      <td style={{ padding: '0.7rem 0.85rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {row.stoploss_trigger_id || row.active_stoploss_trigger_id || '-'}
                      </td>

                      <td
                        style={{
                          padding: '0.7rem 1rem',
                          color: row.buy_status === 'success' ? 'var(--accent-green)' : row.buy_status === 'blocked' ? 'var(--danger)' : 'var(--text-muted)',
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
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1rem',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                GTT Setup Inspector
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', marginTop: '2px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {selectedItem.symbol}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {selectedItem.companyName}
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.75rem',
                color: selectedItem.buy_status === 'success' ? 'var(--accent-green)' : 'var(--text-muted)',
                backgroundColor: 'var(--bg-primary)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontWeight: 600,
              }}
            >
              {selectedItem.message}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              fontSize: '0.825rem',
            }}
          >
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Dummy Buy Trigger</div>
              <div style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: '1.1rem', marginTop: '2px' }}>
                {selectedItem.buy_price != null ? `₹${selectedItem.buy_price.toFixed(2)}` : 'N/A'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                Breakout candle low (tick rounded)
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Stoploss Trigger</div>
              <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '1.1rem', marginTop: '2px' }}>
                {selectedItem.stoploss != null ? `₹${selectedItem.stoploss.toFixed(2)}` : 'N/A'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                5% below buy (planned after buy)
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Risk Per Share</div>
              <div style={{ color: '#b45309', fontWeight: 700, fontSize: '1.1rem', marginTop: '2px' }}>
                {selectedItem.buy_price && selectedItem.stoploss ? `₹${(selectedItem.buy_price - selectedItem.stoploss).toFixed(2)}` : 'N/A'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                Buy price minus stoploss
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Active Trigger ID</div>
              <div style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '0.9rem', marginTop: '2px', fontFamily: 'monospace' }}>
                {selectedItem.buy_trigger_id || selectedItem.active_buy_trigger_id || 'None'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                Simulated trigger ID with DUMMY- prefix
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
