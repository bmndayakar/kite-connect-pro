import React, { useState, useEffect } from 'react';
import {
  Zap,
  Activity,
  RefreshCw,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Layers,
  Database,
  Play,
  ShieldCheck,
  ShieldAlert,
  X
} from 'lucide-react';
import { fetchScannerData, fetchOhlcSnapshot, fetchGttState, placeLiveGtt } from '../api';

export default function AlgoSignalsTab({
  results = [],
  setResults,
  scannedStocksCount = 0,
  setScannedStocksCount,
  livePrices = {},
  setLivePrices,
  wsStatus = 'Disconnected',
  tickCount = 0,
  onSignalsUpdated,
  onGttResultsUpdated,
  gttResults = {},
  tradingMode = 'simulation',
  setTradingMode
}) {
  const [loading, setLoading] = useState(results.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [isRunningLive, setIsRunningLive] = useState(false);
  const [error, setError] = useState(null);
  const [runLiveMessage, setRunLiveMessage] = useState(null);
  const [runLiveError, setRunLiveError] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Normalization logic
  const normalizeCandles = (rawCandles) => {
    if (!Array.isArray(rawCandles)) return [];
    return rawCandles
      .map((c) => {
        let dStr = '';
        if (c.date) {
          const d = new Date(c.date);
          if (!isNaN(d.getTime())) {
            dStr = d.toISOString().slice(0, 10);
          } else {
            dStr = String(c.date).slice(0, 10);
          }
        }
        return {
          date: dStr,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume),
        };
      })
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  };

  // Run scanner on raw data
  const runBreakoutScanner = (stocksData) => {
    if (!Array.isArray(stocksData)) return { scanned: 0, hits: [] };

    let scannedCount = 0;
    const hits = [];

    for (const stock of stocksData) {
      scannedCount++;
      const rawCandles = stock.candles || [];
      const candles = normalizeCandles(rawCandles);

      if (candles.length < 25) continue;

      const N = candles.length;
      const minB = Math.max(20, N - 21);
      let foundSetupForStock = null;

      for (let b = N - 2; b >= minB; b--) {
        const candidate = candles[b];

        let volSum = 0;
        let prevHigh = -Infinity;
        for (let i = b - 20; i < b; i++) {
          volSum += candles[i].volume;
          if (candles[i].high > prevHigh) {
            prevHigh = candles[i].high;
          }
        }
        const avgVol = volSum / 20;

        if (avgVol <= 0) continue;
        if (candidate.close <= candidate.open) continue;
        if (candidate.volume < 3 * avgVol) continue;
        if (candidate.close <= prevHigh) continue;

        let maxPriceAfter = -Infinity;
        for (let j = b + 1; j < N; j++) {
          if (candles[j].high > maxPriceAfter) {
            maxPriceAfter = candles[j].high;
          }
        }

        if (maxPriceAfter <= candidate.high) continue;

        const midpoint = (candidate.high + candidate.low) / 2;
        const currentPrice = candles[N - 1].close;
        const distanceFromMidpoint = ((currentPrice - midpoint) / midpoint) * 100;
        const breakoutAge = N - 1 - b;

        if (Math.abs(distanceFromMidpoint) > 1.0) continue;
        if (breakoutAge > 20) continue;

        const volMultiple = candidate.volume / avgVol;
        const returnFromCloseToSubHigh = ((maxPriceAfter - candidate.close) / candidate.close) * 100;
        const retracementHigh = ((maxPriceAfter - currentPrice) / maxPriceAfter) * 100;

        foundSetupForStock = {
          symbol: stock.symbol,
          companyName: stock.company_name || stock.companyName || stock.symbol,
          instrumentToken: stock.instrument_token || stock.instrumentToken,
          currentPrice,
          breakoutDate: candidate.date,
          bIndex: b,
          daysSince: breakoutAge,
          breakoutLow: candidate.low,
          breakoutHigh: candidate.high,
          midpoint,
          distanceFromMidpoint,
          volMultiple,
          prevHigh,
          maxPriceAfter,
          returnFromCloseToSubHigh,
          retracementHigh,
          candles,
        };

        break;
      }

      if (foundSetupForStock) {
        hits.push(foundSetupForStock);
      }
    }

    hits.sort((a, b) => {
      if (a.daysSince !== b.daysSince) {
        return a.daysSince - b.daysSince;
      }
      return Math.abs(a.distanceFromMidpoint) - Math.abs(b.distanceFromMidpoint);
    });

    return { scanned: scannedCount, hits };
  };

  const loadData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const resp = await fetchScannerData(forceRefresh);
      const stocksList = resp.stocks || [];
      const { scanned, hits } = runBreakoutScanner(stocksList);

      if (setScannedStocksCount) setScannedStocksCount(scanned);
      if (setResults) setResults(hits);
      if (onSignalsUpdated) onSignalsUpdated(hits);

      if (hits.length > 0 && !selectedSymbol) {
        setSelectedSymbol(hits[0].symbol);
      }

      const initPrices = {};
      hits.forEach((h) => {
        if (h.instrumentToken) {
          initPrices[h.instrumentToken] = h.currentPrice;
        }
      });
      if (setLivePrices) {
        setLivePrices((prev) => ({ ...initPrices, ...prev }));
      }

      const tokens = hits.map((h) => h.instrumentToken).filter(Boolean);
      if (tokens.length > 0) {
        fetchOhlcSnapshot(tokens)
          .then((snapshot) => {
            if (snapshot && typeof snapshot === 'object' && setLivePrices) {
              setLivePrices((prev) => {
                const updated = { ...prev };
                for (const [tKey, snap] of Object.entries(snapshot)) {
                  if (snap && snap.last_price != null) {
                    updated[Number(tKey)] = snap.last_price;
                  }
                }
                return updated;
              });
            }
          })
          .catch((err) => {
            console.warn('[AlgoSignals] OHLC snapshot failed:', err);
          });
      }
    } catch (err) {
      console.error('[AlgoSignals] Data load error:', err);
      if (err.message && (err.message.includes('Not Found') || err.message.includes('404'))) {
        setError('Endpoint /api/scanner-data returned 404 Not Found. Your Render backend is still running the previous deployment. Please click "Manual Deploy ➔ Deploy latest commit" on dashboard.render.com to update.');
      } else {
        setError(err.message || 'Failed to load scanner data.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (results.length === 0) {
      loadData(false);
    } else {
      setLoading(false);
      if (!selectedSymbol && results.length > 0) {
        setSelectedSymbol(results[0].symbol);
      }
    }
  }, []);

  const handleActionClick = () => {
    if (tradingMode === 'live') {
      setShowConfirmModal(true);
    } else {
      executeWorkflow('simulation');
    }
  };

  const executeWorkflow = async (mode) => {
    setShowConfirmModal(false);
    try {
      setIsRunningLive(true);
      setRunLiveError(null);
      setRunLiveMessage(null);
      setError(null);

      // Force-refresh scanner data
      const resp = await fetchScannerData(true);
      const stocksList = resp.stocks || [];
      const { scanned, hits } = runBreakoutScanner(stocksList);
      if (setScannedStocksCount) setScannedStocksCount(scanned);
      if (setResults) setResults(hits);
      if (onSignalsUpdated) onSignalsUpdated(hits);

      if (hits.length === 0) {
        setRunLiveMessage('No breakout setups matched current parameters to create GTT candidates.');
        return;
      }

      const tokens = hits.map((h) => h.instrumentToken).filter(Boolean);
      let snapshot = {};
      if (tokens.length > 0) {
        try {
          snapshot = await fetchOhlcSnapshot(tokens);
        } catch (e) {
          console.warn('[AlgoSignals] OHLC snapshot error during Run Live:', e);
        }
      }

      const mergedPrices = { ...livePrices };
      hits.forEach((h) => {
        if (h.instrumentToken && !mergedPrices[h.instrumentToken]) {
          mergedPrices[h.instrumentToken] = h.currentPrice;
        }
      });
      if (snapshot && typeof snapshot === 'object') {
        for (const [tKey, snap] of Object.entries(snapshot)) {
          if (snap && snap.last_price != null) {
            mergedPrices[Number(tKey)] = snap.last_price;
          }
        }
      }
      if (setLivePrices) {
        setLivePrices(mergedPrices);
      }

      const candidateOrders = hits.map((hit) => {
        const ltp = mergedPrices[hit.instrumentToken] ?? hit.currentPrice;
        const buyPrice = hit.breakoutLow;
        const stoploss = buyPrice != null ? Number((buyPrice * 0.95).toFixed(2)) : null;

        return {
          symbol: hit.symbol,
          quantity: 1,
          buy_price: buyPrice,
          stoploss: stoploss,
          last_price: ltp,
        };
      });

      const stateResults = await fetchGttState(candidateOrders, mode);
      const stateMap = {};
      stateResults.forEach((st) => {
        if (st && st.symbol) {
          stateMap[st.symbol] = st;
        }
      });

      const readyRows = stateResults.filter(
        (st) =>
          st.buy_price != null &&
          st.buy_price > 0 &&
          st.stoploss != null &&
          st.stoploss > 0 &&
          st.last_price != null &&
          st.last_price > 0 &&
          st.buy_status === 'ready'
      );

      let liveResults = [];
      if (readyRows.length > 0) {
        const ordersToPlace = readyRows.map((r) => ({
          symbol: r.symbol,
          quantity: r.quantity || 1,
          buy_price: r.buy_price,
          stoploss: r.stoploss,
          last_price: r.last_price,
        }));
        liveResults = await placeLiveGtt(ordersToPlace, true, mode);
      }

      const liveMap = {};
      liveResults.forEach((lr) => {
        if (lr && lr.symbol) {
          liveMap[lr.symbol] = lr;
        }
      });

      const finalGttMap = {};
      candidateOrders.forEach((cand) => {
        const sym = cand.symbol;
        if (liveMap[sym]) {
          finalGttMap[sym] = liveMap[sym];
        } else if (stateMap[sym]) {
          finalGttMap[sym] = stateMap[sym];
        }
      });

      if (onGttResultsUpdated) {
        onGttResultsUpdated(finalGttMap);
      }

      const createdCount = liveResults.filter((r) => r.buy_status === 'success').length;
      const skippedCount = candidateOrders.length - createdCount;
      const modeLabel = mode === 'live' ? 'REAL Zerodha GTT' : 'dummy simulated GTT';

      setRunLiveMessage(
        `Execution finished (${mode.toUpperCase()} MODE): ${createdCount} ${modeLabel} placed, ${skippedCount} skipped. View GTT Placement tab.`
      );
    } catch (err) {
      console.error('[AlgoSignals] Execution error:', err);
      setRunLiveError(err.message || 'Execution failed.');
    } finally {
      setIsRunningLive(false);
    }
  };

  const selectedItem = results.find((r) => r.symbol === selectedSymbol) || results[0];

  // Candidates for confirmation modal
  const readyCandidates = results.map((h) => ({
    symbol: h.symbol,
    buy_price: h.breakoutLow,
    stoploss: h.breakoutLow ? Number((h.breakoutLow * 0.95).toFixed(2)) : null,
  })).filter((c) => c.buy_price);

  const totalCapitalRequired = readyCandidates.reduce((acc, c) => acc + (c.buy_price || 0), 0);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Card */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span
                style={{
                  backgroundColor: 'var(--accent-kite-subtle)',
                  color: 'var(--accent-kite)',
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
                <Zap size={13} />
                Algo Signals
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
                NIFTY 100
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
              High-volume breakout and retest setups
            </h2>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Identifies institutional breakout candles (≥3x volume) followed by a pullback retesting the midpoint (within ±1%).
            </p>
          </div>

          {/* Action Controls & Mode Toggle */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            {/* Mode Switcher Pill */}
            {setTradingMode && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: '3px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setTradingMode('simulation')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: tradingMode === 'simulation' ? '#ffffff' : 'transparent',
                    color: tradingMode === 'simulation' ? '#b45309' : 'var(--text-muted)',
                    boxShadow: tradingMode === 'simulation' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  title="Paper trading: zero real money, dummy records only"
                >
                  <Zap size={13} color={tradingMode === 'simulation' ? '#b45309' : 'var(--text-dim)'} />
                  <span>Simulation</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTradingMode('live')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: tradingMode === 'live' ? 'var(--danger)' : 'transparent',
                    color: tradingMode === 'live' ? '#ffffff' : 'var(--text-muted)',
                    boxShadow: tradingMode === 'live' ? '0 1px 4px rgba(220, 38, 38, 0.3)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  title="Live broker mode: places real GTT orders on Zerodha Kite"
                >
                  <ShieldAlert size={13} color={tradingMode === 'live' ? '#ffffff' : 'var(--text-dim)'} />
                  <span>Live Broker</span>
                </button>
              </div>
            )}

            {/* Refresh Scanner Button */}
            <button
              onClick={() => loadData(true)}
              disabled={loading || refreshing || isRunningLive}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 0.95rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: loading || refreshing || isRunningLive ? 'not-allowed' : 'pointer',
              }}
              title="Force refresh candles and rescan"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Scanning...' : 'Refresh'}</span>
            </button>

            {/* Trigger Button (Dynamic based on mode) */}
            <button
              onClick={handleActionClick}
              disabled={loading || refreshing || isRunningLive}
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.15rem',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: loading || refreshing || isRunningLive ? 'not-allowed' : 'pointer',
                opacity: isRunningLive ? 0.75 : 1,
                backgroundColor: tradingMode === 'live' ? 'var(--danger)' : 'var(--accent-kite)',
                color: '#ffffff',
                boxShadow: tradingMode === 'live' ? '0 2px 10px rgba(220, 38, 38, 0.3)' : 'var(--shadow-glow)',
                border: 'none',
              }}
              title={tradingMode === 'live' ? 'Open pre-trade confirmation to place real GTT orders on Zerodha' : 'Rerun scanner and simulate dummy GTT order placement'}
            >
              {tradingMode === 'live' ? (
                <ShieldCheck size={14} className={isRunningLive ? 'animate-pulse' : ''} />
              ) : (
                <Play size={14} className={isRunningLive ? 'animate-pulse' : ''} fill="white" />
              )}
              <span>
                {isRunningLive
                  ? 'Processing...'
                  : tradingMode === 'live'
                  ? 'Place Real GTTs'
                  : 'Run Simulation'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Mode Warning Notice (Shown when in Live Broker mode) */}
      {tradingMode === 'live' && (
        <div
          className="alert"
          style={{
            backgroundColor: 'var(--danger-subtle)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.15rem',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <ShieldAlert size={18} color="var(--danger)" style={{ flexShrink: 0 }} />
            <span>
              <strong>LIVE BROKER MODE ACTIVE:</strong> Clicking <strong>Place Real GTTs</strong> will submit real buy GTT orders directly to your connected Zerodha Kite account (Qty: 1 per stock, CNC).
            </span>
          </div>
          <button
            onClick={() => setTradingMode('simulation')}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }}
          >
            Switch to Simulation
          </button>
        </div>
      )}

      {/* Feedback Messages */}
      {runLiveMessage && (
        <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <CheckCircle2 size={18} color="var(--accent-green)" />
            <span>{runLiveMessage}</span>
          </div>
          <button
            onClick={() => setRunLiveMessage(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {runLiveError && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.15rem' }}>
          <AlertTriangle size={18} color="var(--danger)" />
          <div>
            <strong>Execution Error: </strong>
            {runLiveError}
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.85rem 1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={18} color="var(--danger)" style={{ flexShrink: 0 }} />
            <div>
              <strong>API Error: </strong>
              {error}
            </div>
          </div>
          <button
            onClick={() => loadData(true)}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem', whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Triggered Breakouts
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-kite)', marginTop: '2px' }}>
              {loading ? '-' : results.length}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'var(--accent-kite-subtle)',
              color: 'var(--accent-kite)',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Trading Mode
            </div>
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: tradingMode === 'live' ? 'var(--danger)' : '#b45309',
                marginTop: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: tradingMode === 'live' ? 'var(--danger)' : '#b45309',
                  display: 'inline-block',
                }}
              />
              {tradingMode === 'live' ? 'LIVE BROKER' : 'SIMULATION'}
            </div>
          </div>
          <div
            style={{
              backgroundColor: tradingMode === 'live' ? 'var(--danger-subtle)' : '#fffbeb',
              color: tradingMode === 'live' ? 'var(--danger)' : '#b45309',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {tradingMode === 'live' ? <ShieldAlert size={20} /> : <Zap size={20} />}
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
            <Layers size={18} color="var(--accent-kite)" />
            Triggered Breakouts
          </h3>
          <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
            Click row to inspect setup • Click symbol to open Kite Chart
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <RefreshCw size={28} className="animate-spin" color="var(--accent-kite)" />
            <div>
              <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>Loading scanner cache...</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Fetching Nifty 100 candles and testing institutional volume setups
              </div>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && results.length === 0 && (
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
              No breakout retest setups match the current parameters.
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0.5rem auto 0 auto' }}>
              No Nifty 100 stocks currently exhibit an institutional breakout (volume ≥ 3x) with a retracement within ±1% of the breakout midpoint.
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && results.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.85rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontSize: '0.72rem',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <th style={{ padding: '0.75rem 0.85rem', width: '50px', textAlign: 'center' }}>Rank</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Symbol</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Current Price</th>
                  <th style={{ padding: '0.75rem 0.85rem' }}>Breakout Date</th>
                  <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Age</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Breakout Vol</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Retest Distance</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Peak Gains</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Retracement</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => {
                  const isSelected = selectedSymbol === row.symbol;
                  const currentLtp =
                    livePrices[row.instrumentToken] != null
                      ? livePrices[row.instrumentToken]
                      : row.currentPrice;

                  const chartUrl = row.instrumentToken
                    ? `https://kite.zerodha.com/chart/ext/tvc/NSE/${encodeURIComponent(row.symbol)}/${row.instrumentToken}`
                    : `https://kite.zerodha.com/chart/ext/tvc/NSE/${encodeURIComponent(row.symbol)}`;

                  const isRetestPositive = row.distanceFromMidpoint >= 0;

                  return (
                    <tr
                      key={row.symbol}
                      onClick={() => setSelectedSymbol(row.symbol)}
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--accent-kite-subtle)'
                          : index % 2 === 0
                          ? '#ffffff'
                          : '#fafafa',
                        borderBottom: '1px solid var(--border-subtle)',
                        borderLeft: isSelected ? '3px solid var(--accent-kite)' : '3px solid transparent',
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

                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <a
                            href={chartUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={`Open ${row.symbol} chart in Zerodha Kite`}
                            style={{
                              color: 'var(--accent-blue)',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {row.symbol}
                            <ExternalLink size={12} color="var(--accent-blue)" />
                          </a>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {row.companyName}
                        </div>
                      </td>

                      <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--text-main)',
                            fontSize: '0.9rem',
                          }}
                        >
                          ₹{Number(currentLtp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      <td style={{ padding: '0.7rem 0.85rem', color: 'var(--text-muted)' }}>
                        {row.breakoutDate}
                      </td>

                      <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: row.daysSince <= 5 ? 'var(--accent-green-subtle)' : 'var(--bg-primary)',
                            color: row.daysSince <= 5 ? 'var(--accent-green)' : 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {row.daysSince}d
                        </span>
                      </td>

                      <td
                        style={{
                          padding: '0.7rem 0.85rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#b45309',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {Number(row.volMultiple).toFixed(2)}x
                      </td>

                      <td
                        style={{
                          padding: '0.7rem 0.85rem',
                          textAlign: 'right',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: isRetestPositive ? 'var(--accent-blue)' : 'var(--text-muted)',
                        }}
                      >
                        {isRetestPositive ? '+' : ''}
                        {Number(row.distanceFromMidpoint).toFixed(2)}%
                      </td>

                      <td
                        style={{
                          padding: '0.7rem 0.85rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--accent-green)',
                        }}
                      >
                        +{Number(row.returnFromCloseToSubHigh).toFixed(2)}%
                      </td>

                      <td
                        style={{
                          padding: '0.7rem 0.85rem',
                          textAlign: 'right',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--danger)',
                        }}
                      >
                        +{Number(row.retracementHigh).toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Stock Setup Inspector */}
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
                Selected Setup Inspector
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

            <a
              href={`https://kite.zerodha.com/chart/ext/tvc/NSE/${encodeURIComponent(selectedItem.symbol)}/${selectedItem.instrumentToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Open Kite Chart
              <ArrowUpRight size={14} />
            </a>
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
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Midpoint Price</div>
              <div style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: '1.1rem', marginTop: '2px' }}>
                ₹{selectedItem.midpoint.toFixed(2)}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                High: ₹{selectedItem.breakoutHigh.toFixed(2)} • Low: ₹{selectedItem.breakoutLow.toFixed(2)}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Subsequent High</div>
              <div style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '1.1rem', marginTop: '2px' }}>
                ₹{selectedItem.maxPriceAfter.toFixed(2)}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                Prev 20d High: ₹{selectedItem.prevHigh.toFixed(2)}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Volume Surge</div>
              <div style={{ color: '#b45309', fontWeight: 700, fontSize: '1.1rem', marginTop: '2px' }}>
                {selectedItem.volMultiple.toFixed(2)}x
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                Over 20-day average volume
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Current vs Midpoint</div>
              <div
                style={{
                  color: selectedItem.distanceFromMidpoint >= 0 ? 'var(--accent-blue)' : 'var(--danger)',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  marginTop: '2px',
                }}
              >
                {selectedItem.distanceFromMidpoint >= 0 ? '+' : ''}
                {selectedItem.distanceFromMidpoint.toFixed(2)}%
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                Within ±1.0% tolerance band
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Trade Safety Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="card animate-fade-in"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '2px solid var(--danger)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    backgroundColor: 'var(--danger-subtle)',
                    color: 'var(--danger)',
                    padding: '8px',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Confirm Real GTT Orders
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Live Broker Trading
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              className="alert alert-error"
              style={{
                fontSize: '0.825rem',
                lineHeight: 1.5,
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
              }}
            >
              You are about to place <strong>REAL BUY GTT orders</strong> on your Zerodha account using Kite Connect API. Quantity is strictly <strong>1 share</strong> per stock.
            </div>

            {/* Candidate Summary Table */}
            <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '6px 10px' }}>Stock</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>Buy Price</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>5% Stoploss</th>
                  </tr>
                </thead>
                <tbody>
                  {readyCandidates.map((c) => (
                    <tr key={c.symbol} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--text-main)' }}>{c.symbol}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>1</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>₹{c.buy_price.toFixed(2)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--danger)' }}>₹{c.stoploss.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.825rem',
                color: 'var(--text-muted)',
                marginBottom: '1.25rem',
                padding: '0 4px',
              }}
            >
              <span>Total Orders to Place: <strong>{readyCandidates.length}</strong></span>
              <span>Total Capital Exposure: <strong>₹{totalCapitalRequired.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeWorkflow('live')}
                className="btn"
                style={{
                  backgroundColor: 'var(--danger)',
                  color: '#ffffff',
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                  cursor: 'pointer',
                }}
              >
                Confirm & Place Real GTTs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
