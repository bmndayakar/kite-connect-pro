import os
import csv
import json
import time
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
NIFTY100_CSV = DATA_DIR / "ind_nifty100list.csv"
INSTRUMENTS_JSON = DATA_DIR / "nse_instruments.json"
SCANNER_CACHE_FILE = DATA_DIR / "scanner_data_cache.json"

class ScannerDataService:
    def __init__(self):
        self.stocks: List[Dict[str, Any]] = []
        self.tokens: Dict[str, int] = {}
        self._load_metadata()

    def _load_metadata(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if NIFTY100_CSV.exists():
            try:
                with open(NIFTY100_CSV, "r", encoding="utf-8") as f:
                    self.stocks = list(csv.DictReader(f))
            except Exception as e:
                print(f"[ScannerData] Failed loading CSV: {e}")

        if INSTRUMENTS_JSON.exists():
            try:
                with open(INSTRUMENTS_JSON, "r", encoding="utf-8") as f:
                    self.tokens = json.load(f)
            except Exception as e:
                print(f"[ScannerData] Failed loading tokens: {e}")

    def _fetch_stock_candles(self, stock_item: Dict[str, Any], kite_client=None) -> Optional[Dict[str, Any]]:
        sym = stock_item["Symbol"].strip()
        cname = stock_item["Company Name"].strip()
        tok = self.tokens.get(sym)

        # 1. Try Kite if available
        if kite_client and tok:
            try:
                to_date = datetime.now().date()
                from_date = to_date - timedelta(days=180)
                raw = kite_client.historical_data(tok, from_date, to_date, "day")
                if raw and len(raw) >= 25:
                    candles = []
                    for c in raw:
                        d = c["date"]
                        d_str = d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10]
                        candles.append({
                            "date": d_str,
                            "open": round(float(c["open"]), 2),
                            "high": round(float(c["high"]), 2),
                            "low": round(float(c["low"]), 2),
                            "close": round(float(c["close"]), 2),
                            "volume": int(c.get("volume", 0))
                        })
                    return {
                        "symbol": sym,
                        "company_name": cname,
                        "instrument_token": tok,
                        "nifty_flags": ["NIFTY 100"],
                        "candles": candles
                    }
            except Exception:
                pass

        # 2. Market feed fallback (Yahoo finance)
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}.NS?range=6mo&interval=1d"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                res = data["chart"]["result"][0]
                ts = res.get("timestamp", [])
                q = res.get("indicators", {}).get("quote", [{}])[0]
                opens = q.get("open", [])
                highs = q.get("high", [])
                lows = q.get("low", [])
                closes = q.get("close", [])
                vols = q.get("volume", [])
                candles = []
                for t, o, h, l, c, v in zip(ts, opens, highs, lows, closes, vols):
                    if c is not None and o is not None and h is not None and l is not None and v is not None:
                        candles.append({
                            "date": datetime.fromtimestamp(t).strftime("%Y-%m-%d"),
                            "open": round(float(o), 2),
                            "high": round(float(h), 2),
                            "low": round(float(l), 2),
                            "close": round(float(c), 2),
                            "volume": int(v)
                        })
                candles.sort(key=lambda x: x["date"])
                if len(candles) >= 25:
                    return {
                        "symbol": sym,
                        "company_name": cname,
                        "instrument_token": tok,
                        "nifty_flags": ["NIFTY 100"],
                        "candles": candles
                    }
        except Exception:
            pass

        return None

    def get_scanner_data(self, kite_client=None, force_refresh=False) -> Dict[str, Any]:
        """
        Returns Nifty 100 stock metadata and normalized daily candles.
        Caches results on disk for rapid response times.
        """
        # Check cache (valid for 2 hours)
        if not force_refresh and SCANNER_CACHE_FILE.exists():
            try:
                mtime = os.path.getmtime(SCANNER_CACHE_FILE)
                if time.time() - mtime < 7200: # 2 hours
                    with open(SCANNER_CACHE_FILE, "r", encoding="utf-8") as f:
                        cached = json.load(f)
                    if cached.get("stocks") and len(cached["stocks"]) >= 30:
                        return cached
            except Exception as e:
                print(f"[ScannerData] Cache read error: {e}")

        # Fetch candles concurrently across Nifty 100
        target = self.stocks if self.stocks else []
        stock_list = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(self._fetch_stock_candles, st, kite_client) for st in target]
            for f in futures:
                try:
                    res = f.result()
                    if res and len(res.get("candles", [])) >= 25:
                        stock_list.append(res)
                except Exception:
                    pass

        payload = {
            "metadata": {
                "total_stocks": len(stock_list),
                "source": "Nifty 100",
                "generated_at": datetime.now().isoformat(),
                "timeframe": "1d"
            },
            "stocks": stock_list
        }

        # Save to disk cache
        try:
            with open(SCANNER_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(payload, f)
            print(f"[ScannerData] Cached scanner data for {len(stock_list)} stocks.")
        except Exception as e:
            print(f"[ScannerData] Failed writing cache: {e}")

        return payload

    def get_ohlc_snapshot(self, tokens: List[int]) -> Dict[str, Any]:
        """
        Returns snapshot LTP/OHLC for the requested instrument tokens.
        """
        snapshot = {}
        # Try finding the latest close from cached scanner data
        if SCANNER_CACHE_FILE.exists():
            try:
                with open(SCANNER_CACHE_FILE, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                token_set = set(tokens)
                for s in cached.get("stocks", []):
                    tok = s.get("instrument_token")
                    if tok in token_set and s.get("candles"):
                        last_c = s["candles"][-1]
                        snapshot[str(tok)] = {
                            "instrument_token": tok,
                            "last_price": last_c["close"],
                            "close": last_c["close"],
                            "high": last_c["high"],
                            "low": last_c["low"],
                            "open": last_c["open"],
                            "symbol": s["symbol"]
                        }
            except Exception:
                pass
        return snapshot

scanner_data_service = ScannerDataService()
