from fastapi import FastAPI, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from kite_service import kite_manager
from scanner_service import scanner_service

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

