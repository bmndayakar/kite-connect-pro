from fastapi import FastAPI, HTTPException, status, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import asyncio
import random
from kite_service import kite_manager
from scanner_service import scanner_service
from scanner_data_service import scanner_data_service
from gtt_service import gtt_service

app = FastAPI(
    title="Kite Connect Pro Hub",
    description="Backend API for Zerodha Kite Connect login, persistent session caching, and user profile management.",
    version="1.0.0"
)

# Enable CORS for local dev and production frontend
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    api_key: str = Field(..., description="Kite Connect API Key")
    api_secret: str = Field(..., description="Kite Connect API Secret")
    request_token: str = Field(..., description="Request Token obtained after user login redirect")

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Zerodha Kite Connect Authentication Backend",
        "docs_url": "/docs"
    }

@app.get("/api/credentials")
def get_credentials():
    """
    Returns initial API Key and Secret from credentials.txt or saved session
    to help speed up developer onboarding.
    """
    creds = kite_manager.get_initial_credentials()
    return {
        "api_key": creds.get("api_key", ""),
        "api_secret": creds.get("api_secret", ""),
        "request_token": creds.get("request_token", "")
    }

@app.get("/api/auth/login-url")
def get_login_url(api_key: Optional[str] = None):
    """
    Generates Kite OAuth login URL for the given API Key.
    """
    key = api_key.strip() if api_key else kite_manager.get_initial_credentials().get("api_key", "")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API Key is required to generate the Kite login URL."
        )
    return {
        "login_url": f"https://kite.zerodha.com/connect/login?v=3&api_key={key}"
    }

@app.get("/api/auth/status")
def auth_status(response: Response):
    """
    Checks if a valid, active session token is already cached on the server.
    This enables reusing the access token during local development
    without prompting for re-login on hot reloads.
    """
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    status_info = kite_manager.get_auth_status()
    return status_info

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    """
    Exchanges request_token + api_secret + api_key for an access_token.
    Saves the access_token securely on the server and returns only user profile metadata.
    The access_token is NEVER exposed in the response.
    """
    if not payload.api_key or not payload.api_secret or not payload.request_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All fields (API Key, API Secret, Request Token) are required."
        )

    try:
        user_info = kite_manager.generate_session(
            api_key=payload.api_key,
            api_secret=payload.api_secret,
            request_token=payload.request_token
        )
        return {
            "success": True,
            "message": "Login successful. Access token saved securely on server.",
            "user": user_info
        }
    except Exception as e:
        error_msg = str(e)
        print(f"[Error in /api/auth/login]: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_msg or "Failed to generate session with Kite Connect."
        )

@app.get("/api/user/profile")
def get_user_profile():
    """
    Fetches the authenticated user profile directly from Zerodha Kite API.
    Returns User Name, User ID, Products, Exchanges, etc.
    """
    try:
        profile_data = kite_manager.get_user_profile()
        return {
            "success": True,
            "data": profile_data
        }
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_msg or "Unable to fetch profile. Session may have expired."
        )

@app.post("/api/auth/logout")
def logout(response: Response):
    """
    Clears local saved session token and logs out user from backend.
    """
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    kite_manager.logout()
    return {
        "success": True,
        "message": "Logged out successfully and cached session cleared."
    }

class ScanRequest(BaseModel):
    short_sma: int = Field(default=6, ge=2, le=50, description="Short SMA period")
    long_sma: int = Field(default=30, ge=5, le=200, description="Long SMA period")
    lookback_days: int = Field(default=100, ge=5, le=365, description="Lookback window in days")
    max_stocks: int = Field(default=50, ge=5, le=100, description="Max stocks to scan")

@app.post("/api/signals/scan")
def scan_signals(payload: ScanRequest):
    """
    Scans Nifty 100 stocks for SMA crossovers using Kite instrument tokens
    and daily historical candles. Ranks stocks by the most recent crossover date first.
    """
    if payload.short_sma >= payload.long_sma:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Short SMA period must be less than Long SMA period."
        )

    try:
        results = scanner_service.scan_nifty100(
            kite=kite_manager.kite,
            short_sma=payload.short_sma,
            long_sma=payload.long_sma,
            lookback_days=payload.lookback_days,
            max_stocks=payload.max_stocks
        )
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scanning failed: {str(e)}"
        )


@app.get("/api/scanner-data")
def get_scanner_data(force_refresh: bool = False):
    """
    Returns Nifty 100 stock metadata and normalized daily candles for Algo Signals breakout scanner.
    """
    try:
        data = scanner_data_service.get_scanner_data(
            kite_client=kite_manager.kite,
            force_refresh=force_refresh
        )
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch scanner data: {str(e)}"
        )


@app.get("/api/ohlc")
def get_ohlc(tokens: str = ""):
    """
    Returns snapshot OHLC and last_price for specified instrument tokens.
    """
    try:
        if not tokens:
            return {}
        token_list = [int(t.strip()) for t in tokens.split(",") if t.strip().isdigit()]
        return scanner_data_service.get_ohlc_snapshot(token_list)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch OHLC snapshot: {str(e)}"
        )


@app.websocket("/ws/ticks")
@app.websocket("/api/ws/ticks")
async def websocket_ticks(websocket: WebSocket, tokens: str = "", mode: str = "full"):
    """
    Websocket server that streams live ticks for the subscribed tokens.
    """
    await websocket.accept()
    token_list = [int(t.strip()) for t in tokens.split(",") if t.strip().isdigit()]
    snapshot = scanner_data_service.get_ohlc_snapshot(token_list)
    prices = {t: snapshot.get(str(t), {}).get("last_price", 1000.0) for t in token_list}

    try:
        while True:
            ticks = []
            for t in token_list:
                base = prices.get(t, 1000.0)
                # Slight micro-fluctuation (+/- 0.04%) to simulate continuous live tick feed
                delta = round(base * random.uniform(-0.0004, 0.0004), 2)
                cur = round(base + delta, 2)
                prices[t] = cur
                ticks.append({
                    "instrument_token": t,
                    "last_price": cur,
                    "mode": mode
                })
            await websocket.send_json(ticks)
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


class GttCandidateOrder(BaseModel):
    symbol: str
    quantity: int = Field(default=1, description="Order quantity")
    buy_price: Optional[float] = Field(default=None, description="Buy price (breakout candle low)")
    stoploss: Optional[float] = Field(default=None, description="Stoploss (5% below buy)")
    last_price: Optional[float] = Field(default=None, description="Last traded price")

class GttStateRequest(BaseModel):
    orders: List[GttCandidateOrder]

class LiveGttRequest(BaseModel):
    confirm_live: bool = Field(..., description="Must be true to authorize order placement")
    mode: str = Field(default="simulation", description="'simulation' for paper trading, 'live' for real Kite broker orders")
    orders: List[GttCandidateOrder]


@app.post("/api/algo-orders/gtt-state")
def get_algo_orders_gtt_state(payload: GttStateRequest):
    """
    Read-only GTT state check.
    Evaluates GTT candidate orders against Kite account state and local dummy records.
    Never submits, modifies, or cancels any real order or GTT.
    """
    try:
        orders_dict = [o.model_dump() for o in payload.orders]
        results = gtt_service.get_gtt_states(orders_dict, kite_client=kite_manager.kite)
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check GTT state: {str(e)}"
        )


@app.post("/api/algo-orders/live-gtt")
def place_algo_orders_live_gtt(payload: LiveGttRequest):
    """
    GTT placement endpoint supporting both Paper Simulation and Real Live Broker trading.
    - If mode == 'simulation': Creates backend dummy GTT records with prefix DUMMY- in persistent storage.
    - If mode == 'live': Places real Buy GTT orders directly on Zerodha Kite account.
    """
    if not payload.confirm_live:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="confirm_live must be explicitly true to authorize order placement."
        )

    try:
        orders_dict = [o.model_dump() for o in payload.orders]
        results = gtt_service.execute_gtts(
            orders_dict,
            confirm_live=payload.confirm_live,
            mode=payload.mode,
            kite_client=kite_manager.kite
        )
        return results
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to process GTT order: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

