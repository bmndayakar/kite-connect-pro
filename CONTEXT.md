# PROJECT CONTEXT & AGENT HANDOFF GUIDE 🧠

> **Target Audience**: AI Agents & Engineers picking up this codebase.
> **Last Verified Working**: 2026-10-24
> **Live Production**:
> - Frontend: `https://kiteconnect.hungerstories.com` (Hostinger Shared Web Hosting)
> - Backend: `https://kite-connect-pro.onrender.com` (Render.com Python Web Service)

---

## 1. Why This Application Was Built (Motivation & Problem Statement)

Zerodha's Kite Connect API is a widely used financial API in India, but has developer hurdles:
1. **Manual Daily Re-login Required**: By SEBI regulation, Kite access tokens expire strictly every morning at **06:00 AM IST**. You must generate a new `request_token` via 2FA daily.
2. **Local Development Friction**: Typical sample code forces you to re-authenticate every time you restart your dev server or edit code.
3. **Security Vulnerability**: In naive full-stack implementations, the `access_token` is often sent to the frontend or exposed in local storage, which violates security best practices.
4. **Trading Signal Discovery**: Algorithmic traders need a fast, automated way to scan liquid indices (Nifty 100) for high-probability moving average crossovers (e.g. SMA 6 vs SMA 30) mapped to official Kite instrument tokens.

### What This Solution Accomplishes:
- **Zero Token Leakage**: The raw `access_token` is generated on the backend using the official `kiteconnect` SDK and stored in server-side `backend/session.json`. The token is **never** sent to the client browser.
- **Local Dev Reusability**: FastAPI and React check `GET /api/auth/status` on load. If a valid token exists, you skip login entirely across HMR code changes.
- **Algo Signals (Breakout & Retest Scanner)**: Scans Nifty 100 stocks for institutional breakouts (volume $\ge 3\times$ 20-day average) followed by retests of the breakout candle midpoint (within $\pm 1\%$). Streams live ticks via WebSocket (`/ws/ticks`) with OHLC fallback and fixed row ranking.
- **Full Nifty 100 SMA Crossover Scanner**: Loads the official Nifty Indices CSV, maps all 100 stocks to Kite NSE `instrument_token`, calculates daily SMA 6 & SMA 30, detects Bullish/Bearish crossovers, and ranks by the **most recent crossover date first**.
- **Production-Ready Split Architecture**: Static single-file React frontend running on Hostinger Shared Hosting + FastAPI backend on Render.com.

---

## 2. System Architecture & Tech Stack

```
                                  ┌──────────────────────────────────────────────┐
                                  │      Hostinger Shared Web Hosting            │
                                  │   https://kiteconnect.hungerstories.com      │
                                  │                                              │
                                  │   Single-File Inlined React (Vite SPA)       │
                                  │   [index.html + .htaccess]                   │
                                  └──────────────────────┬───────────────────────┘
                                                         │ HTTPS API Requests
                                                         ▼
┌──────────────────────────────────┐      ┌──────────────────────────────────────┐
│       Zerodha Kite API           │◄────►│         Render.com Web Service       │
│  - OAuth 2FA (connect/login)     │      │   https://kite-connect-pro.onrender  │
│  - Profile API (kite.profile)    │      │                                      │
│  - Instruments (api.kite.trade)  │      │   FastAPI + Uvicorn + KiteConnect    │
└──────────────────────────────────┘      │   backend/session.json (Token cache) │
                                          └──────────────────────────────────────┘
```

- **Frontend**: React 19, Vite 6, `vite-plugin-singlefile`, Lucide React icons, clean CSS variables (Light Theme, high contrast, responsive).
- **Backend**: Python 3.10+ (tested on Python 3.15), FastAPI, Uvicorn, Pydantic v2, `kiteconnect` 5.2+.
- **Data & Caching**:
  - `backend/data/ind_nifty100list.csv`: Official Nifty 100 constituents list.
  - `backend/data/nse_instruments.json`: Mapped Kite NSE equity `instrument_token` database.
  - `backend/session.json`: Server-side active session token (auto-created on login, `.gitignore`d).

---

## 3. Repository Map & Key Files

```
dabbulu-bokka-pani/
│
├── CONTEXT.md                    # THIS FILE (Comprehensive agent handoff context)
├── README.md                     # General user overview & quickstart
├── credentials.txt               # Local credentials (IGNORED BY GIT)
├── credentials.example.txt       # Template file for onboarding
│
├── start.bat                     # Windows 1-Click launcher (starts backend + frontend)
├── run_backend.bat / .ps1        # Standalone FastAPI launcher (port 8000)
├── run_frontend.bat / .ps1       # Standalone Vite launcher (port 5173)
│
├── backend/
│   ├── main.py                   # FastAPI app, CORS middleware, API endpoints & WebSocket ticks
│   ├── kite_service.py           # KiteSessionManager (session creation, profile, cache)
│   ├── scanner_service.py        # NiftyScannerService (CSV parsing, SMA 6/30, crossover detection)
│   ├── scanner_data_service.py   # ScannerDataService (Nifty 100 daily candles & OHLC snapshots)
│   ├── gtt_service.py            # GttService (Simulated GTT state check, atomic duplicate prevention, dummy store)
│   ├── requirements.txt          # Python dependencies
│   ├── session.json              # Active backend session (auto-generated, do not commit)
│   └── data/
│       ├── ind_nifty100list.csv  # 100 official Nifty constituents from NSE/NiftyIndices
│       ├── nse_instruments.json  # 10,000+ mapped Kite NSE instrument tokens
│       └── dummy_gtts.json       # Persistent local store for simulated DUMMY- GTT records
│
└── frontend/
    ├── package.json              # React dependencies (lucide-react, vite-plugin-singlefile)
    ├── vite.config.js            # Inlines JS/CSS into single index.html for static hosting
    ├── .env.production           # Production API pointer: https://kite-connect-pro.onrender.com/api
    ├── public/
    │   └── .htaccess             # Apache rewrite rules for SPA hosting on Hostinger
    ├── dist/
    │   ├── index.html            # ~330KB self-contained production bundle (UPLOAD THIS TO HOSTINGER)
    │   └── .htaccess             # Apache rewrite file
    └── src/
        ├── App.jsx               # Root state machine (auth recovery on boot)
        ├── api.js                # API client with environment-aware baseURL & WebSocket helpers
        ├── index.css             # High contrast CSS theme & responsive design system
        └── components/
            ├── Navbar.jsx        # Navigation bar, live session status, logout button
            ├── LoginPage.jsx     # Form with prefill & "Get Request Token" helper
            ├── Dashboard.jsx     # Tab controller (User, Algo Signals, GTT Placement, Signals, Overview, Session)
            ├── AlgoSignalsTab.jsx# High-volume breakout and retest setups (Dark UI, Run Live button, shared live LTP)
            ├── GttPlacementTab.jsx# Kite GTT Placement (Read-only status table, Qty 1, Breakout Low, Stoploss 5%)
            ├── UserTab.jsx       # Displays User Name, Client ID, Products, Exchanges
            ├── SignalsTab.jsx    # Nifty 100 SMA Crossover Scanner UI & ranked table
            ├── OverviewTab.jsx   # Welcome cards, shortcuts, feature summaries
            └── SessionTab.jsx    # Session security details & Python code snippet
```

---

## 4. API Endpoints Reference

All endpoints are prefixed with `/api` (or proxied via Vite locally):

| Method | Endpoint | Description | Payload / Query |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/credentials` | Reads `credentials.txt` to pre-fill login inputs | None |
| `GET` | `/api/auth/login-url` | Generates official Kite OAuth redirect URL | `?api_key=...` |
| `GET` | `/api/auth/status` | Checks if `session.json` has a valid token | None |
| `POST`| `/api/auth/login` | Exchanges `request_token` for `access_token` | `{ api_key, api_secret, request_token }` |
| `GET` | `/api/user/profile` | Fetches authenticated profile via `kite.profile()` | None (uses cached session) |
| `POST`| `/api/signals/scan` | Runs Nifty 100 SMA crossover scan | `{ short_sma, long_sma, lookback_days, max_stocks }` |
| `POST`| `/api/auth/logout` | Clears `session.json` and resets Kite client | None |

---

## 5. How the Core Features Work

### 5.1 Zerodha OAuth & Token Persistence Flow
1. User clicks **"Get Request Token via Kite Login"** in [LoginPage.jsx](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/frontend/src/components/LoginPage.jsx).
2. Browser opens: `https://kite.zerodha.com/connect/login?v=3&api_key=...`
3. User enters credentials & TOTP. Zerodha redirects to configured Redirect URL with `request_token=...` in query params.
4. User pastes `request_token` and clicks Login.
5. FastAPI calls `kite.generate_session(request_token=..., api_secret=...)`.
6. Token is saved in `backend/session.json`. Response to frontend returns **only** sanitized profile info (user ID, user name, broker). The raw access token is **never returned**.
7. On app reload / code edit, `App.jsx` calls `GET /api/auth/status`. If valid, it jumps straight to Dashboard.

### 5.2 Nifty 100 SMA Crossover Scanner
Located in [backend/scanner_service.py](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/backend/scanner_service.py):
1. **Constituent Loading**: Reads `backend/data/ind_nifty100list.csv`.
2. **Token Mapping**: Looks up `Symbol` in `backend/data/nse_instruments.json` to get `instrument_token`.
3. **Candle Fetching**:
   - First attempts official Kite historical API `kite.historical_data(instrument_token, ...)`.
   - If historical API is unsubscribed or unavailable, automatically falls back to concurrent market queries for `{symbol}.NS` via `ThreadPoolExecutor(max_workers=10)` (completes in ~2-3 seconds for 100 stocks).
4. **Moving Average Calculation**:
   - Computes rolling sums for `short_sma` (default 6) and `long_sma` (default 30).
5. **Crossover Detection**:
   - Scans backwards from the most recent day:
   - **Bullish**: `curr_short > curr_long` AND `prev_short <= prev_long`.
   - **Bearish**: `curr_short < curr_long` AND `prev_short >= prev_long`.
6. **Recency Ranking**:
   - Sorts results by `days_ago` ascending (`crossover_date` descending) so today's/yesterday's signals appear at the very top as `Rank 1, 2, 3...`.
7. **Signal Persistence & Dynamic Recency Timer**:
   - **On-Demand**: Does not auto-scan on initial render; waits for the user to click "Generate Signals".
   - **Persistent Storage**: Saves results and timestamp to `localStorage` (`kite_signals_cache`), preserving the table across tab switches and browser reloads until re-scanned.
   - **Dynamic Timer**: Displays real-time recency text (`Signals generated 1 minute ago`, `just now`, etc.) updating every 10 seconds.
   - **Direct Charts**: Clickable tickers that open official Kite TradingView charts in a new tab.

---

## 6. How to Run Locally

### Option 1: 1-Click Batch (Windows)
Double-click `start.bat`. It starts both backend and frontend in separate background cmd windows and opens `http://localhost:5173`.

### Option 2: Manual Terminal Startup
**Backend**:
```powershell
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend**:
```powershell
cd frontend
npm run dev
```

---

## 7. How to Deploy to Production

### 7.1 Frontend (Hostinger Shared Web Hosting)
Because Hostinger Shared Hosting runs LiteSpeed/Apache and cannot execute long-running Python ASGI daemons, the frontend is built using **`vite-plugin-singlefile`**:
```powershell
cd frontend
npm run build
```
This produces a single, self-contained **`frontend/dist/index.html`** (280 KB).
**Deployment Steps on Hostinger**:
1. Open Hostinger hPanel ➔ File Manager.
2. Navigate to the subdomain folder (`public_html/kiteconnect/` or `domains/hungerstories.com/public_html/kiteconnect/`).
3. Upload `frontend/dist/index.html` and `frontend/dist/.htaccess`.
4. Done! No subfolders or asset paths required.

### 7.2 Backend (Render.com Free Web Service)
1. Hosted as a GitHub-connected Web Service on Render:
   - Root directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
2. Live URL: `https://kite-connect-pro.onrender.com`
3. Frontend points to this via `frontend/.env.production`:
   ```
   VITE_API_BASE_URL=https://kite-connect-pro.onrender.com/api
   ```

---

## 8. Critical Gotchas & Troubleshooting

1. **"The user is not enabled for the app"**:
   - Cause: The Zerodha Client ID logged into in the browser does not match the Client ID configured on [developers.kite.trade/apps](https://developers.kite.trade/apps).
   - Fix: Ensure app type is "Connect" (not "Publisher"), and verify there are no accidental spaces in the Client ID field in the developer console.
2. **"Token is invalid or has expired"**:
   - Kite `request_token` values are **strictly single-use** and expire in **2 to 5 minutes**. Once submitted, they cannot be reused. Generate a fresh one by opening the Kite login URL.
3. **Zerodha 6:00 AM IST Expiration Rule**:
   - Every morning at 6:00 AM IST, Zerodha invalidates all access tokens globally. The user must generate a new `request_token` once each morning.
4. **Render Free Tier Cold Starts**:
   - If inactive for 15 minutes, Render spins down the free container. The very first request after inactivity takes ~50 seconds to warm up. Subsequent requests respond in milliseconds.
5. **Blank Screen on Hostinger**:
   - If someone accidentally builds without `vite-plugin-singlefile`, Vite emits an `/assets/` folder. If Hostinger doesn't find `/assets/....js`, it rewrites to `index.html`, causing a MIME type parse error. **Always keep `vite-plugin-singlefile` enabled in `frontend/vite.config.js`** so the entire bundle remains inside `dist/index.html`.

---

## 9. Next Steps / Roadmap Ideas

If extending this application further:
1. **Live Orders Tab**: Place Regular, Bracket, or Cover orders via `kite.place_order()`.
2. **Holdings & Positions Tab**: Render live portfolio P&L using `kite.holdings()` and `kite.positions()`.
3. **WebSocket Live Ticker**: Connect to Kite ticker (`KiteTicker`) to stream real-time tick prices for the top ranked crossover stocks.
4. **Automated Cron / Webhook Alerts**: Send Telegram or Discord notifications whenever an SMA crossover is triggered during market hours (9:15 AM - 3:30 PM IST).

