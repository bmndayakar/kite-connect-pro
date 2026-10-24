import React, { useState, useEffect, useRef } from 'react';
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
  Play
} from 'lucide-react';
import { fetchScannerData, fetchOhlcSnapshot, getWebSocketUrl, fetchGttState, placeLiveGtt } from '../api';

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
  gttResults = {}
}) {
  const [loading, setLoading] = useState(results.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [isRunningLive, setIsRunningLive] = useState(false);
  const [error, setError] = useState(null);
  const [runLiveMessage, setRunLiveMessage] = useState(null);
  const [runLiveError, setRunLiveError] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null);

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
      // 1. Count each stock as scanned
      scannedCount++;

      const rawCandles = stock.candles || [];
      const candles = normalizeCandles(rawCandles);

      // 2. Require at least 25 candles
      if (candles.length < 25) {
        continue;
      }

      const N = candles.length;
      // 3. Start checking from the second-last candle and scan backward
      // 4. Earliest eligible candle must have >= 20 preceding candles (b >= 20)
      //    and no more than 20 candles before latest candle: (N - 1) - b <= 20 => b >= N - 21
      const minB = Math.max(20, N - 21);

      let foundSetupForStock = null;

      for (let b = N - 2; b >= minB; b--) {
        const candidate = candles[b];

        // 5. Calculate avg volume and highest high of the previous 20 candles, excluding candidate
        let volSum = 0;
        let prevHigh = -Infinity;
        for (let i = b - 20; i < b; i++) {
          volSum += candles[i].volume;
          if (candles[i].high > prevHigh) {
            prevHigh = candles[i].high;
          }
        }
        const avgVol = volSum / 20;

        // 6. Accept candidate only when:
        // - avgVol > 0
        // - close > open
        // - volume >= 3 * avgVol
        // - close > prevHigh
        if (avgVol <= 0) continue;
        if (candidate.close <= candidate.open) continue;
        if (candidate.volume < 3 * avgVol) continue;
        if (candidate.close <= prevHigh) continue;

        // 7. Find highest high among all candles after breakout candle
        let maxPriceAfter = -Infinity;
        for (let j = b + 1; j < N; j++) {
          if (candles[j].high > maxPriceAfter) {
            maxPriceAfter = candles[j].high;
          }
        }

        // 8. Reject candidate unless subsequent high is above breakout candle's high
        if (maxPriceAfter <= candidate.high) continue;

        // 9. Calculations:
        const midpoint = (candidate.high + candidate.low) / 2;
        const currentPrice = candles[N - 1].close;
        const distanceFromMidpoint = ((currentPrice - midpoint) / midpoint) * 100;
        const breakoutAge = N - 1 - b;

        // 10. Accept setup only when:
        // - absolute distance from midpoint is within 1%
        // - breakout age is no more than 20 candles
        if (Math.abs(distanceFromMidpoint) > 1.0) continue;
        if (breakoutAge > 20) continue;

        // 11. Add only one result per stock. Stop scanning that stock after finding most recent accepted setup
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

        break; // Stop scanning this stock once the most recent setup is found
      }

      if (foundSetupForStock) {
        hits.push(foundSetupForStock);
      }
    }

    // Sort results:
    // 1. By breakout age, lowest first
    // 2. Tie-break by absolute distance from midpoint, lowest first
    hits.sort((a, b) => {
      if (a.daysSince !== b.daysSince) {
        return a.daysSince - b.daysSince;
      }
      return Math.abs(a.distanceFromMidpoint) - Math.abs(b.distanceFromMidpoint);
    });

    return { scanned: scannedCount, hits };
  };

  // Fetch scanner data from backend
  const loadData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
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

      // Initialize live prices from candle close
      const initPrices = {};
      hits.forEach((h) => {
        if (h.instrumentToken) {
          initPrices[h.instrumentToken] = h.currentPrice;
        }
      });
      if (setLivePrices) {
        setLivePrices((prev) => ({ ...initPrices, ...prev }));
      }

      // Fetch snapshot LTP fallback for returned tokens
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
      setError(err.message || 'Failed to load scanner data.');
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

  // Run Live Workflow
  const handleRunLive = async () => {
    try {
      // 1. Set running state
      setIsRunningLive(true);
      setRunLiveError(null);
      setRunLiveMessage(null);

      // 2. Clear previous GTT placement errors
      setError(null);

      // 3. Force-refresh scanner data
      const resp = await fetchScannerData(true);
      const stocksList = resp.stocks || [];

      // 4. Rerun existing Algo Signals scanner using exact existing logic
      const { scanned, hits } = runBreakoutScanner(stocksList);
      if (setScannedStocksCount) setScannedStocksCount(scanned);
      if (setResults) setResults(hits);
      if (onSignalsUpdated) onSignalsUpdated(hits);

      if (hits.length === 0) {
        setRunLiveMessage('No breakout setups matched current parameters to create GTT candidates.');
        return;
      }

      // 5. Load an OHLC snapshot for the fresh signal symbols
      const tokens = hits.map((h) => h.instrumentToken).filter(Boolean);
      let snapshot = {};
      if (tokens.length > 0) {
        try {
          snapshot = await fetchOhlcSnapshot(tokens);
        } catch (e) {
          console.warn('[AlgoSignals] OHLC snapshot error during Run Live:', e);
        }
      }

      // 6. Merge snapshot prices with websocket ticks
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

      // 7. Build GTT candidates from fresh Algo Signals
      // Buy price: breakout candle low (breakoutLow)
      // Stoploss: 5% below buy price (buy_price * 0.95)
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

      // 8. Call /api/algo-orders/gtt-state
      const stateResults = await fetchGttState(candidateOrders);
      const stateMap = {};
      stateResults.forEach((st) => {
        if (st && st.symbol) {
          stateMap[st.symbol] = st;
        }
      });

      // 9. Select only rows where buy price, stoploss, and live or snapshot LTP are available, and backend buy_status is ready
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

      // 10. Call /api/algo-orders/live-gtt only for those ready rows (creates dummy records only)
      let liveResults = [];
      if (readyRows.length > 0) {
        const ordersToPlace = readyRows.map((r) => ({
          symbol: r.symbol,
          quantity: r.quantity || 1,
          buy_price: r.buy_price,
          stoploss: r.stoploss,
          last_price: r.last_price,
        }));
        liveResults = await placeLiveGtt(ordersToPlace, true);
      }

      const liveMap = {};
      liveResults.forEach((lr) => {
        if (lr && lr.symbol) {
          liveMap[lr.symbol] = lr;
        }
      });

      // 11. Update GTT Placement with returned placement results
      // 12. For skipped rows, show the backend state result instead of creating a dummy record
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
      setRunLiveMessage(
        `Run Live complete: ${createdCount} dummy GTT created, ${skippedCount} skipped. View GTT Placement tab.`
      );
    } catch (err) {
      console.error('[AlgoSignals] Run Live error:', err);
      setRunLiveError(err.message || 'Run Live execution failed.');
    } finally {
      // 13. Stop running state
      setIsRunningLive(false);
    }
  };

  const selectedItem = results.find((r) => r.symbol === selectedSymbol) || results[0];

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
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '1.25rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
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
              <Zap size={13} />
              Algo Signals
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
              NIFTY 100
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
            High-volume breakout and retest setups
          </h2>
          <p style={{ margin: 0, fontSize: '0.825rem', color: '#94a3b8' }}>
            Identifies institutional breakout candles (≥3x volume) followed by a pullback retesting the midpoint (within ±1%).
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Refresh Scanner Button */}
          <button
            onClick={() => loadData(true)}
            disabled={loading || refreshing || isRunningLive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: loading || refreshing || isRunningLive ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Force refresh candles and rescan"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Scanning...' : 'Refresh Scanner'}</span>
          </button>

          {/* Run Live Button */}
          <button
            onClick={handleRunLive}
            disabled={loading || refreshing || isRunningLive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: isRunningLive ? '#334155' : 'rgba(245, 158, 11, 0.2)',
              color: isRunningLive ? '#94a3b8' : '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: loading || refreshing || isRunningLive ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: isRunningLive ? 'none' : '0 0 12px rgba(245, 158, 11, 0.25)',
            }}
            title="Rerun scanner and simulate dummy GTT order placement"
          >
            <Play size={14} className={isRunningLive ? 'animate-pulse' : ''} fill={isRunningLive ? 'none' : '#fbbf24'} />
            <span>{isRunningLive ? 'Running...' : 'Run Live'}</span>
          </button>
        </div>
      </div>

      {/* Run Live Feedback Banner */}
      {runLiveMessage && (
        <div
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '8px',
            padding: '0.85rem 1.15rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            color: '#86efac',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} color="#22c55e" />
            <span>{runLiveMessage}</span>
          </div>
          <button
            onClick={() => setRunLiveMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#86efac',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {runLiveError && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.85rem 1.15rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} color="#ef4444" />
          <div>
            <strong style={{ color: '#ef4444' }}>Run Live Error: </strong>
            {runLiveError}
          </div>
        </div>
      )}

      {/* Compact Summary Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.85rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Triggered Breakouts Metric */}
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
              Triggered Breakouts
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
              {loading ? '-' : results.length}
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
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Stocks Scanned Metric */}
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
              Stocks Scanned
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
              {loading ? '-' : scannedStocksCount}
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(148, 163, 184, 0.12)',
              color: '#94a3b8',
              padding: '8px',
              borderRadius: '8px',
            }}
          >
            <Database size={20} />
          </div>
        </div>

        {/* Live Tick Subscription & Status */}
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

      {/* Error Banner */}
      {error && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.9rem 1.1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#fca5a5',
            fontSize: '0.875rem',
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#ef4444' }}>API Error: </strong>
            {error}
          </div>
        </div>
      )}

      {/* Table Container */}
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
            <Layers size={17} color="#38bdf8" />
            Triggered Breakouts
          </h3>
          <span style={{ fontSize: '0.775rem', color: '#64748b' }}>
            Click any row to inspect setup • Click symbol to open Zerodha Kite Chart
          </span>
        </div>

        {/* Loading State */}
        {loading && (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '0.95rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <RefreshCw size={28} className="animate-spin" color="#38bdf8" />
            <div>
              <div style={{ color: '#ffffff', fontWeight: 600 }}>Loading scanner cache...</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                Fetching Nifty 100 candles and testing institutional volume setups
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && results.length === 0 && (
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
              No breakout retest setups match the current parameters.
            </div>
            <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: '440px', margin: '0.5rem auto 0 auto' }}>
              No Nifty 100 stocks currently exhibit an institutional breakout (volume ≥ 3x) with a retracement within ±1% of the breakout midpoint.
            </p>
          </div>
        )}

        {/* Data Table */}
        {!loading && results.length > 0 && (
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
                    backgroundColor: '#0a0f1d',
                    borderBottom: '1px solid #1e293b',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    fontSize: '0.72rem',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '0.7rem 0.85rem', width: '50px', textAlign: 'center' }}>Rank</th>
                  <th style={{ padding: '0.7rem 1rem' }}>Symbol</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>Current Price</th>
                  <th style={{ padding: '0.7rem 0.85rem' }}>Breakout Date</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center' }}>Age</th>
                  <th style={{ padding: '0.7rem 0.85rem', textAlign: 'right' }}>Breakout Vol</th>
                  <th style={{ padding: '0.7rem 0.85rem', textAlign: 'right' }}>Retest Distance</th>
                  <th style={{ padding: '0.7rem 0.85rem', textAlign: 'right' }}>Peak Gains</th>
                  <th style={{ padding: '0.7rem 0.85rem', textAlign: 'right' }}>Retracement</th>
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
                          ? 'rgba(56, 189, 248, 0.12)'
                          : index % 2 === 0
                          ? 'transparent'
                          : 'rgba(255, 255, 255, 0.015)',
                        borderBottom: '1px solid #1e293b',
                        borderLeft: isSelected ? '3px solid #38bdf8' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.12s ease',
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
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <a
                            href={chartUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={`Open ${row.symbol} chart in Zerodha Kite`}
                            style={{
                              color: '#38bdf8',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {row.symbol}
                            <ExternalLink size={12} color="#0284c7" />
                          </a>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                          {row.companyName}
                        </div>
                      </td>

                      {/* Current Price */}
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color: '#ffffff',
                            fontSize: '0.88rem',
                          }}
                        >
                          ₹{Number(currentLtp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Breakout Date */}
                      <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>
                        {row.breakoutDate}
                      </td>

                      {/* Age (daysSince) */}
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: row.daysSince <= 5 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                            color: row.daysSince <= 5 ? '#4ade80' : '#cbd5e1',
                          }}
                        >
                          {row.daysSince}d
                        </span>
                      </td>

                      {/* Breakout Vol */}
                      <td
                        style={{
                          padding: '0.65rem 0.85rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#fbbf24',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {Number(row.volMultiple).toFixed(2)}x
                      </td>

                      {/* Retest Distance */}
                      <td
                        style={{
                          padding: '0.65rem 0.85rem',
                          textAlign: 'right',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: isRetestPositive ? '#38bdf8' : '#cbd5e1',
                        }}
                      >
                        {isRetestPositive ? '+' : ''}
                        {Number(row.distanceFromMidpoint).toFixed(2)}%
                      </td>

                      {/* Peak Gains */}
                      <td
                        style={{
                          padding: '0.65rem 0.85rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: '#4ade80',
                        }}
                      >
                        +{Number(row.returnFromCloseToSubHigh).toFixed(2)}%
                      </td>

                      {/* Retracement */}
                      <td
                        style={{
                          padding: '0.65rem 0.85rem',
                          textAlign: 'right',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: '#f87171',
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
                Selected Setup Inspector
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

            <a
              href={`https://kite.zerodha.com/chart/ext/tvc/NSE/${encodeURIComponent(selectedItem.symbol)}/${selectedItem.instrumentToken}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
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
            <div style={{ backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Midpoint Price</div>
              <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>
                ₹{selectedItem.midpoint.toFixed(2)}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                High: ₹{selectedItem.breakoutHigh.toFixed(2)} • Low: ₹{selectedItem.breakoutLow.toFixed(2)}
              </div>
            </div>

            <div style={{ backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Subsequent High</div>
              <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>
                ₹{selectedItem.maxPriceAfter.toFixed(2)}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                Prev 20d High: ₹{selectedItem.prevHigh.toFixed(2)}
              </div>
            </div>

            <div style={{ backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Volume Surge</div>
              <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>
                {selectedItem.volMultiple.toFixed(2)}x
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                Over 20-day average volume
              </div>
            </div>

            <div style={{ backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Current Price vs Midpoint</div>
              <div
                style={{
                  color: selectedItem.distanceFromMidpoint >= 0 ? '#38bdf8' : '#f87171',
                  fontWeight: 700,
                  fontSize: '1rem',
                  marginTop: '2px',
                }}
              >
                {selectedItem.distanceFromMidpoint >= 0 ? '+' : ''}
                {selectedItem.distanceFromMidpoint.toFixed(2)}%
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                Within ±1.0% tolerance band
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
