import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from kiteconnect import KiteConnect

# Path to session cache file and credentials file
BASE_DIR = Path(__file__).resolve().parent
SESSION_FILE = BASE_DIR / "session.json"
CREDENTIALS_FILE = BASE_DIR.parent / "credentials.txt"

class KiteSessionManager:
    def __init__(self):
        self.kite: Optional[KiteConnect] = None
        self.api_key: Optional[str] = None
        self._load_saved_session()

    def _read_credentials_file(self) -> Dict[str, str]:
        """Reads default credentials from credentials.txt if available."""
        creds = {}
        if CREDENTIALS_FILE.exists():
            try:
                with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if "=" in line and not line.startswith("#"):
                            k, v = line.split("=", 1)
                            creds[k.strip()] = v.strip()
            except Exception as e:
                print(f"[Warning] Failed reading credentials.txt: {e}")
        return creds

    def get_initial_credentials(self) -> Dict[str, str]:
        """Returns API key and secret from credentials.txt or saved session."""
        creds = self._read_credentials_file()
        api_key = creds.get("api_key", "")
        api_secret = creds.get("api_secret", "")

        # Fallback to saved session api_key if credentials.txt is empty
        if not api_key and SESSION_FILE.exists():
            try:
                with open(SESSION_FILE, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    api_key = saved.get("api_key", "")
            except Exception:
                pass

        return {
            "api_key": api_key,
            "api_secret": api_secret,
            "request_token": creds.get("request_token", "")
        }

    def _load_saved_session(self):
        """Attempts to load and initialize KiteConnect from saved session.json."""
        if not SESSION_FILE.exists():
            return

        try:
            with open(SESSION_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)

            api_key = data.get("api_key")
            access_token = data.get("access_token")

            if api_key and access_token:
                self.api_key = api_key
                self.kite = KiteConnect(api_key=api_key)
                self.kite.set_access_token(access_token)
                print(f"[KiteManager] Loaded saved session for API Key: {api_key}")
        except Exception as e:
            print(f"[KiteManager] Could not load saved session: {e}")
            self.kite = None

    def save_session(self, api_key: str, access_token: str, session_data: Dict[str, Any]):
        """Persists access token securely on the backend server."""
        payload = {
            "api_key": api_key,
            "access_token": access_token,
            "user_id": session_data.get("user_id"),
            "user_name": session_data.get("user_name"),
            "login_time": str(session_data.get("login_time", "")),
            "broker": session_data.get("broker")
        }
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        self.api_key = api_key
        self.kite = KiteConnect(api_key=api_key)
        self.kite.set_access_token(access_token)
        print("[KiteManager] Access token securely persisted to backend storage.")

    def generate_session(self, api_key: str, api_secret: str, request_token: str) -> Dict[str, Any]:
        """
        Generates access token using KiteConnect SDK and saves it locally.
        NEVER returns the access_token back to the browser.
        """
        api_key = api_key.strip()
        api_secret = api_secret.strip()
        request_token = request_token.strip()

        kite_client = KiteConnect(api_key=api_key)
        session_data = kite_client.generate_session(request_token=request_token, api_secret=api_secret)

        access_token = session_data.get("access_token")
        if not access_token:
            raise ValueError("Kite Connect did not return an access token.")

        # Persist on server
        self.save_session(api_key=api_key, access_token=access_token, session_data=session_data)

        # Return sanitized info for frontend (EXCLUDING access_token and secret)
        return {
            "user_id": session_data.get("user_id"),
            "user_name": session_data.get("user_name"),
            "email": session_data.get("email"),
            "broker": session_data.get("broker"),
            "products": session_data.get("products", []),
            "exchanges": session_data.get("exchanges", []),
            "login_time": str(session_data.get("login_time", "")),
        }

    def get_auth_status(self) -> Dict[str, Any]:
        """
        Validates if current KiteConnect instance has an active valid session.
        If valid, returns user details without re-logging in.
        """
        if not self.kite:
            return {"authenticated": False, "message": "No active session"}

        try:
            profile = self.kite.profile()
            return {
                "authenticated": True,
                "user_id": profile.get("user_id"),
                "user_name": profile.get("user_name"),
                "email": profile.get("email"),
                "broker": profile.get("broker"),
                "message": "Session is active and valid"
            }
        except Exception as e:
            # Token might be expired (Zerodha tokens expire daily at 6 AM)
            print(f"[KiteManager] Stored session validation failed: {e}")
            self.kite = None
            return {"authenticated": False, "message": f"Token expired or invalid: {str(e)}"}

    def get_user_profile(self) -> Dict[str, Any]:
        """
        Fetches the complete user profile from Zerodha API.
        Sanitizes and returns data (user name, id, products, exchanges, etc.).
        """
        if not self.kite:
            raise RuntimeError("Not authenticated. Please log in first.")

        profile = self.kite.profile()
        return {
            "user_name": profile.get("user_name"),
            "user_id": profile.get("user_id"),
            "user_shortname": profile.get("user_shortname"),
            "email": profile.get("email"),
            "broker": profile.get("broker"),
            "user_type": profile.get("user_type"),
            "products": profile.get("products", []),
            "exchanges": profile.get("exchanges", []),
            "order_types": profile.get("order_types", []),
            "avatar_url": profile.get("avatar_url")
        }

    def logout(self):
        """Clears local session file and resets KiteConnect."""
        self.kite = None
        self.api_key = None
        if SESSION_FILE.exists():
            try:
                os.remove(SESSION_FILE)
            except Exception as e:
                print(f"[Warning] Failed removing session file: {e}")

kite_manager = KiteSessionManager()

