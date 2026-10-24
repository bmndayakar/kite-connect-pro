# Zerodha Agent Rules & Knowledge

## 1. Official Guidelines & Tooling
- Always refer to `MEMORY.md` and `zerodha_prompt.md` for project and broker specifications.
- Prefer `uv` for python environments (`uv add kiteconnect`, `uv run --with kiteconnect main.py`).
- Use official SDK constants from `pykiteconnect` (`kite.GTT_TYPE_SINGLE`, `kite.VARIETY_REGULAR`, `kite.PRODUCT_CNC`, etc.).
- Never hardcode `api_secret` or ask for passwords/TOTPs in code or prompts.
- All docs can be read as markdown by appending `.md` to `https://kite.trade/docs/connect/v3/` URLs, or referenced locally in `docs/kite_connect/`.

## 2. Trading Modes & Risk Management
- Default trading mode MUST ALWAYS be `simulation` (Paper Trading).
- Live broker execution (`mode="live"`) requires explicit user confirmation via the pre-trade modal and an authenticated Kite session.
- Real GTT triggers must be submitted via `kite_client.place_gtt()` with single trigger, CNC delivery product, and breakout candle low.
- Dummy GTT triggers must use the `DUMMY-{SYMBOL}-{COUNTER}` prefix and never call broker APIs.
- Validate Kite state before any order: check active GTTs, day buy orders, net positions, and holdings (`quantity + t1_quantity`).
- All order prices and triggers must be rounded to the instrument's exact tick size (typically 0.05).

## 3. Rate Limits & Token Lifecycle
- Respect API rate limits: Quotes (1 req/s), Historical (3 req/s), Orders (10 req/s, max 400/min, 5000/day).
- Daily access token reset occurs at 06:00 AM IST.
- Clear cached session and prompt for login when `TokenException` (HTTP 403) is encountered.
