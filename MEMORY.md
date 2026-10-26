# Project & Agent Memory: Zerodha Kite Connect

> **Permanent Memory File**  
> This file preserves the complete architectural context, official Zerodha guidelines, Kite Connect API specifications, and codebase conventions for all AI agents and developers working on this project.

---

## 1. Official Zerodha Agent Setup Principles (from `zerodha_prompt.md`)

* **Package Management**: Zerodha officially prefers **`uv`** for managing Python environments:
  ```bash
  uv init my-kite-app && cd my-kite-app
  uv add kiteconnect
  uv run --with kiteconnect main.py
  ```
* **Authentication Security**:
  * Kite Connect uses an OAuth handshake: Send user to `kite.login_url()`, receive `request_token` via redirect URL, and exchange for `access_token` via `kite.generate_session(request_token, api_secret)`.
  * **Strict Rule**: Never ask the user for their password or TOTP; never hardcode or expose `api_secret`.
  * Session lifetime: An `access_token` is valid until **06:00 AM IST** the following morning or until explicit logout/invalidation.
* **Idiomatic SDK Usage**:
  * Always use official constants from `pykiteconnect` (`kite.GTT_TYPE_SINGLE`, `kite.VARIETY_REGULAR`, `kite.PRODUCT_CNC`, `kite.EXCHANGE_NSE`, etc.) instead of hardcoded strings.
  * Direct examples: Refer to official pykiteconnect examples at `https://github.com/zerodha/pykiteconnect/tree/master/examples`.
* **Markdown Documentation**:
  * Any Kite Connect v3 documentation page is available as clean markdown by appending `.md` to the path (e.g., `https://kite.trade/docs/connect/v3/orders/index.md`).
  * Offline copies of all 9 core docs are stored locally in [`docs/kite_connect/`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/docs/kite_connect).

---

## 2. Kite Connect API Specifications & Rules

### 2.1 GTT (Good Till Triggered) Orders
* **Endpoints**:
  * `POST /gtt/triggers`: Place trigger (returns `{"trigger_id": 12345678}`).
  * `GET /gtt/triggers`: List all active/recent triggers (past 7 days).
  * `GET /gtt/triggers/:id`: Fetch specific trigger.
  * `PUT /gtt/triggers/:id`: Modify trigger.
  * `DELETE /gtt/triggers/:id`: Delete trigger.
* **Trigger Types**:
  * `single` (`kite.GTT_TYPE_SINGLE`): Single entry or target order. `trigger_values` must have exactly 1 value: `[price]`.
  * `two-leg` (`kite.GTT_TYPE_OCO`): One-Cancels-Other (Target + Stoploss). `trigger_values` must have exactly 2 values: `[stoploss, target]`.
* **Required Order Keys in `orders` list**:
  * `transaction_type` (`"BUY"` or `"SELL"`)
  * `quantity` (`int`)
  * `order_type` (`"LIMIT"`)
  * `product` (`"CNC"`, `"MIS"`, `"NRML"`)
  * `price` (`float`)
* **Rounding & Tick Size**: All order and trigger prices must be exact multiples of the instrument's `tick_size` (typically `0.05` for NSE equities).

### 2.2 Regular Orders & Portfolio State
* **Order Varieties**:
  * `regular`: Standard market hours order.
  * `amo`: After Market Order.
  * `iceberg`: Large orders split across 2–50 legs (`iceberg_legs`, `iceberg_quantity`).
* **Order Types**: `MARKET`, `LIMIT`, `SL` (Stoploss Limit), `SL-M` (Stoploss Market).
* **Holdings Calculation**:
  * Deliverable holding quantity must sum both settled `quantity` and unsettled T+1 `t1_quantity`:
    `total_holding = quantity + t1_quantity`
* **Positions**:
  * Net open positions reside in `kite.positions()["net"]`. Check `p["quantity"] != 0`.

### 2.3 WebSocket Streaming (`KiteTicker`)
* **URL**: `wss://ws.kite.trade?api_key=xxx&access_token=xxx`
* **Limits**: Up to **3,000 instruments** per connection; maximum **3 active connections** per API key.
* **Modes**:
  * `ltp` (8 bytes): `instrument_token`, `last_price`.
  * `quote` (44 bytes): OHLC, volume, last traded quantity, average price.
  * `full` (184 bytes): Quote + 5-level market depth (bids/offers).
* **Heartbeats**: Server sends 1-byte heartbeat ping every 1–2 seconds when no ticks are flowing.

### 2.4 Rate Limits & Error Handling
| Category | Rate Limit |
| :--- | :--- |
| **Market Quotes (`/quote`)** | **1 request / second** |
| **Historical Candles** | **3 requests / second** |
| **Order Placement (`/orders`)** | **10 req/s** (max 400/min, max 5,000/day, max 25 modifications/order) |
| **All Other Endpoints** | **10 requests / second** |

* **HTTP 403 `TokenException`**: Session expired (daily 6 AM IST reset or user logged in elsewhere). Must invalidate local session and redirect to login.
* **HTTP 400 `InputException`**: Parameter error, invalid tick size, or missing required field.
* **HTTP 400 `MarginException`**: Insufficient trading funds.
* **HTTP 429 `NetworkException`**: Rate limit exceeded; implement exponential backoff.

---

## 3. Application Architecture & Trading Modes

This codebase implements a hybrid dual-mode execution engine:

### 3.1 Simulation Mode (Default / Paper Trading)
* **Goal**: Safe paper trading without financial risk.
* **Execution**:
  * Completely bypasses broker order APIs (`kite.place_gtt` is never called).
  * Generates atomic simulated triggers with the `DUMMY-{SYMBOL}-{COUNTER}` prefix.
  * Persists records in `backend/data/dummy_gtts.json`.
  * Badged as `[DUMMY]` and `SUCCESS (DUMMY)` in the UI.

### 3.2 Live Broker Mode (Real Trading)
* **Goal**: Real order submission to Indian stock exchanges via Zerodha.
* **Safety Protocols**:
  * Default mode is **never** live; user must explicitly select `Live Broker`.
  * Requires active, authenticated Kite session.
  * Pre-Trade Safety Modal summarizes all candidate orders, 1-share quantities, 5% stoploss, risk per share, and total capital exposure before placement.
  * Submits via `kite_client.place_gtt()` with single trigger, CNC delivery, and breakout candle low.
  * Captures official numeric Zerodha `trigger_id` and records `is_real: true`.
  * Badged as `[REAL GTT]` (green) and `SUCCESS (LIVE GTT)` in the UI.

### 3.3 Atomic State Checks & Duplicate Prevention
Before creating any GTT (dummy or live), the backend validates:
1. No active buy GTT exists on Kite for the symbol (`kite.get_gtts()`).
2. No active dummy buy GTT exists in local storage.
3. No pending/open intraday or delivery BUY order exists for the day (`kite.orders()`).
4. No net open position exists (`kite.positions()["net"]`).
5. No settled or T+1 delivery holding exists (`kite.holdings()`).

---

## 4. Key File Navigation

* **Backend**:
  * [`backend/main.py`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/backend/main.py): FastAPI app, OAuth endpoints, `/api/scanner-data`, `/api/algo-orders/live-gtt`.
  * [`backend/kite_service.py`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/backend/kite_service.py): Authentication, token persistence (`session.json`), profile, quotes.
  * [`backend/gtt_service.py`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/backend/gtt_service.py): Dual-mode GTT execution engine (`execute_gtts`), atomic state validation, tick rounding.
  * [`backend/scanner_data_service.py`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/backend/scanner_data_service.py): Institutional breakout & retest scanner algorithm.
* **Frontend**:
  * [`frontend/src/components/AlgoSignalsTab.jsx`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/frontend/src/components/AlgoSignalsTab.jsx): Breakout screener, trading mode toggle, pre-trade safety confirmation modal.
  * [`frontend/src/components/GttPlacementTab.jsx`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/frontend/src/components/GttPlacementTab.jsx): Read-only candidate inspection, real vs dummy trigger badges, active account states.
  * [`frontend/src/components/Dashboard.jsx`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/frontend/src/components/Dashboard.jsx): Root tab controller and shared `tradingMode` state management.
  * [`frontend/src/api.js`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/frontend/src/api.js): Axios client with dynamic `mode` parameter.
* **Documentation & Reference**:
  * [`zerodha_prompt.md`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/zerodha_prompt.md): Official instructions from Zerodha for AI coding agents.
  * [`docs/kite_connect/`](file:///c:/Users/dayam/Documents/dabbulu-bokka-pani/docs/kite_connect): Full offline suite of official Kite Connect v3 markdown files.

