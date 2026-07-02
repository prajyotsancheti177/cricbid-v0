"""Kite Connect auth. Access tokens expire daily (~6am IST), so this flow is a
morning ritual: GET /login-url, log in on Zerodha, get redirected back with a
request_token, which the callback exchanges and stores."""
import hashlib
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..engine.runtime import runtime

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

try:
    from kiteconnect import KiteConnect
except ImportError:
    KiteConnect = None


@router.get("/status")
def auth_status():
    return {
        "kite_configured": bool(settings.kite_api_key and settings.kite_api_secret),
        "kite_connected": runtime.kite_connected,
        "live_trading_enabled": settings.live_trading_enabled,
        "feed": runtime.feed.name,
    }


@router.get("/kite/login-url")
def kite_login_url():
    if not settings.kite_api_key:
        raise HTTPException(400, "TRADING_KITE_API_KEY is not configured")
    if KiteConnect is None:
        raise HTTPException(500, "kiteconnect is not installed")
    return {"login_url": KiteConnect(api_key=settings.kite_api_key).login_url()}


class TokenExchange(BaseModel):
    request_token: str


@router.get("/kite/callback")
def kite_callback(request_token: str = "", status: str = ""):
    """Zerodha redirects here after login with ?request_token=...&status=success."""
    if status and status != "success":
        raise HTTPException(400, f"kite login failed: {status}")
    return _exchange(request_token)


@router.post("/kite/token")
def kite_token(body: TokenExchange):
    """Manual alternative: paste the request_token from the redirect URL."""
    return _exchange(body.request_token)


def _exchange(request_token: str):
    if not request_token:
        raise HTTPException(400, "request_token is required")
    if not (settings.kite_api_key and settings.kite_api_secret):
        raise HTTPException(400, "kite api key/secret not configured")
    kite = KiteConnect(api_key=settings.kite_api_key)
    try:
        session = kite.generate_session(request_token, api_secret=settings.kite_api_secret)
    except Exception as e:
        log.exception("kite token exchange failed")
        raise HTTPException(400, f"token exchange failed: {e}")
    ok = runtime.set_kite_token(session["access_token"])
    return {"connected": ok, "user_id": session.get("user_id", "")}
