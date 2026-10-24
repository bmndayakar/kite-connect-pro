import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Play,
  RotateCcw,
  Sliders,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowUpDown,
  Filter,
  BarChart2
} from 'lucide-react';
import { scanSignals } from '../api';

export default function SignalsTab() {
  const [shortSma, setShortSma] = useState(6);
  const [longSma, setLongSma] = useState(30);
  const [lookbackDays, setLookbackDays] = useState(100);
  const [maxStocks, setMaxStocks] = useState(50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [filterType, setFilterType] = useState('ALL'); // ALL, Bullish, Bearish
  const [searchTerm, setSearchTerm] = useState('');

  // Run initial scan on mount
  useEffect(() => {
    handleRunScan();
  }, []);

  const handleRunScan = async () => {
    setError(null);
    if (Number(shortSma) >= Number(longSma)) {
      setError('Short SMA period must be strictly less than Long SMA period.');
      return;
    }

    setLoading(true);
    try {
      const data = await scanSignals({
        shortSma,
        longSma,
        lookbackDays,
        maxStocks,
      });
      setScanResult(data);
    } catch (err) {
      setError(err.message || 'Error occurred while scanning Nifty 100 stocks.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (s, l) => {
    setShortSma(s);
    setLongSma(l);
  };

  // Filter signals by Crossover Type and Search Term
  const signals = scanResult?.signals || [];
  const filteredSignals = signals.filter((item) => {
    const matchesFilter =
      filterType === 'ALL' || item.crossover_type.toUpperCase() === filterType.toUpperCase();
    const matchesSearch =
      item.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.company.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDaysAgo = (days) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Configuration & Scanner Controls Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-kite-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-kite)' }}>
              <BarChart2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Nifty 100 SMA Crossover Scanner</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Detects bullish and bearish moving average crossovers mapped to Kite NSE instrument tokens.
              </p>
            </div>
          </div>

          {/* Quick Strategy Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Presets:</span>
            <button
              type="button"
              className={`badge ${shortSma === 6 && longSma === 30 ? 'badge-kite' : 'btn-ghost'}`}
              onClick={() => handleApplyPreset(6, 30)}
              style={{ cursor: 'pointer', border: '1px solid var(--border-subtle)', padding: '0.25rem 0.55rem' }}
            >
              SMA 6 / 30 (Default)
            </button>
            <button
              type="button"
              className={`badge ${shortSma === 9 && longSma === 21 ? 'badge-kite' : 'btn-ghost'}`}
              onClick={() => handleApplyPreset(9, 21)}
              style={{ cursor: 'pointer', border: '1px solid var(--border-subtle)', padding: '0.25rem 0.55rem' }}
            >
              SMA 9 / 21 (Swing)
            </button>
            <button
              type="button"
              className={`badge ${shortSma === 50 && longSma === 200 ? 'badge-kite' : 'btn-ghost'}`}
              onClick={() => handleApplyPreset(50, 200)}
              style={{ cursor: 'pointer', border: '1px solid var(--border-subtle)', padding: '0.25rem 0.55rem' }}
            >
              SMA 50 / 200 (Golden)
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          
          {/* Short SMA */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              <span>Short SMA Period</span>
            </label>
            <input
              type="number"
              className="form-input"
              value={shortSma}
              min="2"
              max="100"
              onChange={(e) => setShortSma(parseInt(e.target.value) || 2)}
            />
          </div>

          {/* Long SMA */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              <span>Long SMA Period</span>
            </label>
            <input
              type="number"
              className="form-input"
              value={longSma}
              min="5"
              max="300"
              onChange={(e) => setLongSma(parseInt(e.target.value) || 5)}
            />
          </div>

          {/* Lookback Days */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              <span>Lookback Days</span>
            </label>
            <input
              type="number"
              className="form-input"
              value={lookbackDays}
              min="5"
              max="365"
              onChange={(e) => setLookbackDays(parseInt(e.target.value) || 5)}
            />
          </div>

          {/* Max Stocks */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              <span>Max Stocks</span>
            </label>
            <select
              className="form-input"
              value={maxStocks}
              onChange={(e) => setMaxStocks(parseInt(e.target.value))}
              style={{ cursor: 'pointer' }}
            >
              <option value="25">Top 25 Stocks (Fast)</option>
              <option value="50">Top 50 Stocks (Standard)</option>
              <option value="100">All 100 Stocks (Full Nifty 100)</option>
            </select>
          </div>

          {/* Generate Signals Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRunScan}
            disabled={loading}
            style={{ height: '42px' }}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                <span>Scanning Nifty 100...</span>
              </>
            ) : (
              <>
                <Play size={16} fill="white" />
                <span>Generate Signals</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: '1rem', marginBottom: 0 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Summary KPI Badges & Table Toolbar */}
      {scanResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
            
            {/* Total Scanned */}
            <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>STOCKS SCANNED</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{scanResult.total_scanned}</div>
              </div>
              <span className="badge badge-blue">Nifty 100</span>
            </div>

            {/* Total Signals */}
            <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>SIGNALS DETECTED</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{scanResult.signals_found}</div>
              </div>
              <span className="badge badge-purple">{scanResult.parameters.lookback_days}d Lookback</span>
            </div>

            {/* Bullish Signals */}
            <div
              className="card"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderLeft: '3px solid var(--accent-green)',
                cursor: 'pointer',
              }}
              onClick={() => setFilterType(filterType === 'Bullish' ? 'ALL' : 'Bullish')}
            >
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>BULLISH CROSSOVERS</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857' }}>
                  {scanResult.bullish_signals}
                </div>
              </div>
              <span className="badge badge-green">
                <TrendingUp size={14} />
                <span>Bullish</span>
              </span>
            </div>

            {/* Bearish Signals */}
            <div
              className="card"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderLeft: '3px solid var(--danger)',
                cursor: 'pointer',
              }}
              onClick={() => setFilterType(filterType === 'Bearish' ? 'ALL' : 'Bearish')}
            >
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>BEARISH CROSSOVERS</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b91c1c' }}>
                  {scanResult.bearish_signals}
                </div>
              </div>
              <span className="badge" style={{ backgroundColor: 'var(--danger-subtle)', color: '#b91c1c', border: '1px solid #fecaca' }}>
                <TrendingDown size={14} />
                <span>Bearish</span>
              </span>
            </div>
          </div>

          {/* Table Filters & Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn btn-secondary ${filterType === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterType('ALL')}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.82rem',
                  borderColor: filterType === 'ALL' ? 'var(--accent-kite)' : 'var(--border-subtle)',
                  color: filterType === 'ALL' ? 'var(--text-main)' : 'var(--text-muted)',
                }}
              >
                All Signals ({scanResult.signals_found})
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setFilterType('Bullish')}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.82rem',
                  borderColor: filterType === 'Bullish' ? 'var(--accent-green)' : 'var(--border-subtle)',
                  color: filterType === 'Bullish' ? '#047857' : 'var(--text-muted)',
                }}
              >
                Bullish ({scanResult.bullish_signals})
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setFilterType('Bearish')}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.82rem',
                  borderColor: filterType === 'Bearish' ? 'var(--danger)' : 'var(--border-subtle)',
                  color: filterType === 'Bearish' ? '#b91c1c' : 'var(--text-muted)',
                }}
              >
                Bearish ({scanResult.bearish_signals})
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Filter by Ticker / Company..."
                className="form-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.82rem', paddingBlock: '0.5rem' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Signals Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.85rem 1rem', width: '70px', fontWeight: 600 }}>Rank</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Ticker</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Company</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Crossover Type</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Crossover Date</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600 }}>Close</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600 }}>SMA {shortSma}</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600 }}>SMA {longSma}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ padding: '3.5rem', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto', width: '28px', height: '28px', borderTopColor: 'var(--accent-kite)' }}></div>
                    <p style={{ marginTop: '0.85rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Fetching candles and computing moving averages...
                    </p>
                  </td>
                </tr>
              ) : filteredSignals.length > 0 ? (
                filteredSignals.map((item) => {
                  const isBullish = item.crossover_type === 'Bullish';
                  return (
                    <tr
                      key={item.ticker}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Rank */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: item.rank <= 3 ? 'var(--accent-kite-subtle)' : 'var(--bg-secondary)',
                            color: item.rank <= 3 ? 'var(--accent-kite)' : 'var(--text-dim)',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            border: `1px solid ${item.rank <= 3 ? 'rgba(240, 89, 43, 0.4)' : 'var(--border-subtle)'}`,
                          }}
                        >
                          {item.rank}
                        </span>
                      </td>

                      {/* Ticker */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                            {item.ticker}
                          </span>
                          <span
                            title={`Kite Instrument Token: ${item.instrument_token}`}
                            style={{
                              fontSize: '0.68rem',
                              color: 'var(--text-dim)',
                              backgroundColor: 'var(--bg-secondary)',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            NSE
                          </span>
                        </div>
                      </td>

                      {/* Company Name */}
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {item.company}
                      </td>

                      {/* Crossover Type */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {isBullish ? (
                          <span className="badge badge-green">
                            <TrendingUp size={13} />
                            <span>Bullish</span>
                          </span>
                        ) : (
                          <span className="badge" style={{ backgroundColor: 'var(--danger-subtle)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <TrendingDown size={13} />
                            <span>Bearish</span>
                          </span>
                        )}
                      </td>

                      {/* Crossover Date */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 500 }}>
                            {item.crossover_date}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            {formatDaysAgo(item.days_ago)}
                          </span>
                        </div>
                      </td>

                      {/* Close */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        ₹{item.close.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* SMA Short */}
                      <td
                        style={{
                          padding: '0.85rem 1rem',
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          color: isBullish ? '#047857' : '#b91c1c',
                          fontWeight: 600,
                        }}
                      >
                        ₹{item.sma_short ? item.sma_short.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
                      </td>

                      {/* SMA Long */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        ₹{item.sma_long ? item.sma_long.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    No signals matching the selected criteria. Try increasing lookback days or adjusting SMA thresholds.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Beginner Guide Footer */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
          <HelpCircle size={16} />
          <span>How SMA Crossover Ranking Works</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          • <strong>Bullish Crossover</strong>: Occurs when the faster Short SMA (default 6) crosses above the slower Long SMA (default 30), indicating strong upward momentum.<br />
          • <strong>Bearish Crossover</strong>: Occurs when the Short SMA falls below the Long SMA, signaling weakening price or potential downtrend.<br />
          • <strong>Ranking</strong>: Stocks are ordered strictly by the <strong>most recent crossover date</strong> first, ensuring actionable and timely trade setups appear right at the top.
        </p>
      </div>

    </div>
  );
}

