# Zerodha Kite Connect Pro Hub 🚀

A modern full-stack web application built with **React + Vite** and **Python FastAPI** for Zerodha Kite Connect OAuth authentication, session persistence, and trading account profile management.

---

## 🌟 Key Features

- **Light Mode UI**: Clean, modern financial terminal aesthetic styled with CSS variables and crisp typography.
- **Backend Session Persistence**: The raw `access_token` generated via the official Kite Connect Python SDK is saved locally in `backend/session.json` and **never exposed to the browser/client**.
- **Local Development Reusability**: The application automatically detects and reuses the cached access token across page refreshes and code changes (HMR) so you don't need to log in again after every code edit.
- **Tabbed Dashboard**:
  - **User Profile Tab**: Fetches the authenticated profile from Zerodha via `/api/user/profile` and displays **User Name**, **User ID**, **Enabled Products** (CNC, MIS, NRML, etc.), **Enabled Exchanges** (NSE, BSE, NFO, MCX, etc.), and account metadata.
  - **Signals Tab (Nifty 100 SMA Crossover Scanner)**:
    - Scans Nifty 100 stocks (loaded directly from the official Nifty Indices CSV).
    - Maps all symbols to Kite NSE instrument tokens (`instrument_token`).
    - Computes rolling daily Simple Moving Averages (**SMA 6** and **SMA 30** by default, fully configurable).
    - Detects **Bullish Crossovers** (short crosses above long) and **Bearish Crossovers** (short crosses below long).
    - Ranks all stocks strictly by the **most recent crossover date first**.
    - Interactive controls: Short SMA, Long SMA, Lookback Days, Max Stocks, preset strategies, and live filters (Bullish/Bearish/Search).
  - **Overview Tab**: Welcome portal, quick status indicators, and trading connectivity.
  - **Session & Persistence Tab**: Detailed view of backend token storage rules, Zerodha daily 6:00 AM reset policy, and Python SDK code snippets.
- **1-Click OAuth Helper**: Open the official Kite OAuth login page directly from the login form to retrieve your `request_token`.
- **Auto-prefill**: Automatically detects and pre-fills your `api_key` and `api_secret` from `credentials.txt`.

---

## 📁 Project Structure

```
dabbulu-bokka-pani/
├── backend/
│   ├── main.py            # FastAPI endpoints, CORS, validation
│   ├── kite_service.py    # KiteConnect SDK wrapper, token caching & profile fetching
│   ├── requirements.txt   # Python dependencies
│   └── session.json       # Auto-created backend session cache (never exposed)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx       # Header with live status and logout
│   │   │   ├── LoginPage.jsx    # Credentials form & Kite OAuth link
│   │   │   ├── Dashboard.jsx    # Tab controller (User, Overview, Session)
│   │   │   ├── UserTab.jsx      # User Name, ID, Products & Exchanges
│   │   │   ├── OverviewTab.jsx  # Platform overview
│   │   │   └── SessionTab.jsx   # Token persistence info & code snippets
│   │   ├── api.js               # Frontend API client
│   │   ├── App.jsx              # Main state machine & session recovery
│   │   └── index.css            # Dark mode styling & responsive theme
│   ├── vite.config.js           # Vite dev proxy configuration
│   └── package.json
├── credentials.txt              # Local Kite API Key & Secret
├── start.bat                    # 1-Click launcher for both backend & frontend
├── run_backend.bat              # Standalone backend runner
├── run_frontend.bat             # Standalone frontend runner
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Launch with One Click
Double-click `start.bat` in the root folder. It will:
1. Start the FastAPI backend on `http://127.0.0.1:8000`.
2. Start the Vite React frontend on `http://localhost:5173`.
3. Automatically launch your browser.

---

### 2. Manual Startup (Terminal)

#### A. Start Backend (Terminal 1)
```powershell
# From project root
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

#### B. Start Frontend (Terminal 2)
```powershell
# From project root
cd frontend
npm run dev
```
Open your browser at: [http://localhost:5173](http://localhost:5173)

---

## 🔐 How Kite Connect Authentication Works

1. **Step 1: Open Login Page**
   - Click the **"Get Request Token via Kite Login"** button on the login screen.
   - Or open: `https://kite.zerodha.com/connect/login?v=3&api_key=YOUR_API_KEY`
2. **Step 2: Authenticate with Zerodha**
   - Sign in using your Zerodha User ID, password, and TOTP.
3. **Step 3: Copy Request Token**
   - Upon authentication, Zerodha redirects your browser:
     ```
     https://your-redirect-url/?action=login&status=success&request_token=YOUR_REQUEST_TOKEN
     ```
   - Copy the value of `request_token`.
4. **Step 4: Click Login**
   - Paste the `request_token` into the app and click **"Login & Enter Dashboard"**.
   - FastAPI generates the daily `access_token` and saves it securely in `backend/session.json`.
   - The dashboard opens instantly!

---

## 💡 Local Development Token Persistence

- Zerodha access tokens are valid until **06:00 AM IST** the following morning.
- During local development, every time you edit code or refresh the browser, the frontend checks `/api/auth/status`. If `session.json` is present and valid, it bypasses the login screen and takes you straight to the dashboard.
- To log in with another account or invalidate the token, simply click the **Logout** button in the top navigation bar.

---

## 🛠️ Customizing the UI

- **Theme Colors & Typography**: Edit CSS variables in [frontend/src/index.css](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/frontend/src/index.css).
- **Adding Tabs**: Add new tabs to [frontend/src/components/Dashboard.jsx](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/frontend/src/components/Dashboard.jsx).
- **Extending Backend APIs**: Add new trading endpoints (orders, holdings, quotes) inside [backend/main.py](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/backend/main.py) using the initialized `kite_manager.kite` client.

