import os
import csv
import io
import json
import time
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
NIFTY100_CSV = DATA_DIR / "ind_nifty100list.csv"
INSTRUMENTS_JSON = DATA_DIR / "nse_instruments.json"

class NiftyScannerService:
    def __init__(self):
        self.stocks: List[Dict[str, str]] = []
        self.instrument_map: Dict[str, int] = {}
        self._initialize_data()

    def _initialize_data(self):
        """Loads Nifty 100 constituents and Kite NSE instrument mappings."""
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._load_nifty100_list()
        self._load_instrument_map()

    def _load_nifty100_list(self):
        """Loads official Nifty 100 constituents from CSV or downloads if missing."""
        if not NIFTY100_CSV.exists():
            try:
                url = "https://niftyindices.com/IndexConstituent/ind_nifty100list.csv"
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    content = resp.read()
                with open(NIFTY100_CSV, "wb") as f:
                    f.write(content)
            except Exception as e:
                print(f"[Warning] Failed downloading Nifty 100 CSV: {e}")

        if NIFTY100_CSV.exists():
            try:
                with open(NIFTY100_CSV, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    self.stocks = [
                        {
                            "symbol": row["Symbol"].strip(),
                            "company_name": row["Company Name"].strip(),
                            "industry": row.get("Industry", "").strip(),
                        }
                        for row in reader
                        if "Symbol" in row and row["Symbol"].strip()
                    ]
                print(f"[Scanner] Loaded {len(self.stocks)} Nifty 100 constituents from CSV.")
            except Exception as e:
                print(f"[Error] Failed parsing Nifty 100 CSV: {e}")

    def _load_instrument_map(self):
        """Loads Kite instrument tokens for NSE equities."""
        if not INSTRUMENTS_JSON.exists():
            try:
                url = "https://api.kite.trade/instruments/NSE"
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    content = resp.read().decode("utf-8")
                reader = csv.DictReader(io.StringIO(content))
                mapping = {}
                for r in reader:
                    if r.get("instrument_type") == "EQ":
                        mapping[r["tradingsymbol"].strip()] = int(r["instrument_token"])
                with open(INSTRUMENTS_JSON, "w", encoding="utf-8") as f:
                    json.dump(mapping, f)
                self.instrument_map = mapping
            except Exception as e:
                print(f"[Warning] Failed downloading Kite instruments: {e}")
        else:
            try:
                with open(INSTRUMENTS_JSON, "r", encoding="utf-8") as f:
                    self.instrument_map = json.load(f)
                print(f"[Scanner] Loaded {len(self.instrument_map)} Kite NSE instrument tokens.")
            except Exception as e:
                print(f"[Error] Failed reading instruments JSON: {e}")

    def _fetch_candles_kite(self, kite, instrument_token: int, lookback_days: int) -> Optional[List[Dict[str, Any]]]:
        """Attempts to fetch daily candles using Kite Connect SDK."""
        if not kite or not instrument_token:
            return None
        try:
            to_date = datetime.now().date()
            # Add safety margin for weekends and trading holidays
            from_date = to_date - timedelta(days=int(lookback_days * 1.6) + 30)
            data = kite.historical_data(
                instrument_token=instrument_token,
                from_date=from_date,
                to_date=to_date,
                interval="day"
            )
            if data and len(data) > 0:
                candles = []
                for c in data:
                    d = c["date"]
                    d_str = d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10]
                    candles.append({
                        "date": d_str,
                        "close": float(c["close"]),
                    })
                return candles
        except Exception as e:
            # If historical data permission is not granted on Kite app, we fallback gracefully
            return None

    def _fetch_candles_market(self, symbol: str, lookback_days: int) -> Optional[List[Dict[str, Any]]]:
        """Fetches daily candles via market API fallback."""
        try:
            # Range: 6mo or 1y based on lookback
            range_param = "1y" if lookback_days > 120 else "6mo"
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}.NS?range={range_param}&interval=1d"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            res = data["chart"]["result"][0]
            timestamps = res.get("timestamp", [])
            closes = res.get("indicators", {}).get("quote", [{}])[0].get("close", [])

            candles = []
            for ts, close in zip(timestamps, closes):
                if close is not None:
                    d_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
                    candles.append({
                        "date": d_str,
                        "close": float(close)
                    })
            return candles if len(candles) >= 30 else None
        except Exception:
            return None

    def _calculate_sma(self, closes: List[float], period: int) -> List[Optional[float]]:
        """Calculates Simple Moving Average for a series of closes."""
        smas: List[Optional[float]] = [None] * len(closes)
        if len(closes) < period:
            return smas

        window_sum = sum(closes[:period])
        smas[period - 1] = window_sum / period

        for i in range(period, len(closes)):
            window_sum += closes[i] - closes[i - period]
            smas[i] = window_sum / period

        return smas

    def _analyze_stock(self, stock: Dict[str, str], kite, short_sma: int, long_sma: int, lookback_days: int) -> Optional[Dict[str, Any]]:
        """Analyzes a single stock for SMA crossover."""
        symbol = stock["symbol"]
        company_name = stock["company_name"]
        instrument_token = self.instrument_map.get(symbol)

        # 1. Try Kite Connect first
        source = "Kite Connect"
        candles = self._fetch_candles_kite(kite, instrument_token, lookback_days)

        # 2. Fallback to market feed if Kite historical API is unavailable/unsubscribed
        if not candles:
            candles = self._fetch_candles_market(symbol, lookback_days)
            source = "NSE Market Feed"

        if not candles or len(candles) <= long_sma:
            return None

        closes = [c["close"] for c in candles]
        dates = [c["date"] for c in candles]

        # Calculate SMAs
        sma_short_series = self._calculate_sma(closes, short_sma)
        sma_long_series = self._calculate_sma(closes, long_sma)

        # Detect the most recent crossover
        crossover_info = None
        total_len = len(closes)

        # Scan backwards from the most recent candle
        for i in range(total_len - 1, long_sma, -1):
            curr_s = sma_short_series[i]
            prev_s = sma_short_series[i - 1]
            curr_l = sma_long_series[i]
            prev_l = sma_long_series[i - 1]

            if curr_s is None or prev_s is None or curr_l is None or prev_l is None:
                continue

            days_ago = (total_len - 1) - i
            if days_ago > lookback_days:
                break

            # Bullish: Short crosses above Long
            if prev_s <= prev_l and curr_s > curr_l:
                crossover_info = {
                    "type": "Bullish",
                    "date": dates[i],
                    "days_ago": days_ago,
                    "crossover_index": i,
                }
                break

            # Bearish: Short crosses below Long
            if prev_s >= prev_l and curr_s < curr_l:
                crossover_info = {
                    "type": "Bearish",
                    "date": dates[i],
                    "days_ago": days_ago,
                    "crossover_index": i,
                }
                break

        if not crossover_info:
            return None

        latest_close = closes[-1]
        latest_sma_short = sma_short_series[-1]
        latest_sma_long = sma_long_series[-1]

        return {
            "ticker": symbol,
            "company": company_name,
            "instrument_token": instrument_token or "N/A",
            "crossover_type": crossover_info["type"],
            "crossover_date": crossover_info["date"],
            "days_ago": crossover_info["days_ago"],
            "close": round(latest_close, 2),
            "sma_short": round(latest_sma_short, 2) if latest_sma_short else None,
            "sma_long": round(latest_sma_long, 2) if latest_sma_long else None,
            "data_source": source
        }

    def scan_nifty100(
        self,
        kite=None,
        short_sma: int = 6,
        long_sma: int = 30,
        lookback_days: int = 100,
        max_stocks: int = 100
    ) -> Dict[str, Any]:
        """
        Scans Nifty 100 stocks for SMA crossovers.
        Ranks results by most recent crossover date first.
        """
        if short_sma >= long_sma:
            raise ValueError("Short SMA period must be strictly less than Long SMA period.")

        target_stocks = self.stocks[:max_stocks]
        if not target_stocks:
            # Fallback safety in case CSV wasn't downloaded
            self._initialize_data()
            target_stocks = self.stocks[:max_stocks]

        results = []
        # Run concurrent analysis for fast response (10 threads)
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [
                executor.submit(self._analyze_stock, stock, kite, short_sma, long_sma, lookback_days)
                for stock in target_stocks
            ]
            for f in futures:
                try:
                    res = f.result()
                    if res:
                        results.append(res)
                except Exception as e:
                    print(f"[Scanner] Error analyzing stock: {e}")

        # Rank stocks by most recent crossover date first (days_ago ascending / date descending)
        results.sort(key=lambda x: (x["days_ago"], x["ticker"]))

        # Assign rank numbers 1, 2, 3...
        for idx, item in enumerate(results, start=1):
            item["rank"] = idx

        bullish_count = sum(1 for r in results if r["crossover_type"] == "Bullish")
        bearish_count = sum(1 for r in results if r["crossover_type"] == "Bearish")

        return {
            "success": True,
            "total_scanned": len(target_stocks),
            "signals_found": len(results),
            "bullish_signals": bullish_count,
            "bearish_signals": bearish_count,
            "parameters": {
                "short_sma": short_sma,
                "long_sma": long_sma,
                "lookback_days": lookback_days,
                "max_stocks": max_stocks
            },
            "signals": results
        }

scanner_service = NiftyScannerService()

