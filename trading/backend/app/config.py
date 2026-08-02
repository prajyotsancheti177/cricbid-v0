"""Application settings, loaded from environment / .env file."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_prefix="TRADING_", extra="ignore")

    database_url: str = f"sqlite:///{BASE_DIR / 'trading.db'}"

    # Zerodha Kite Connect credentials (leave empty to run in simulation/paper mode)
    kite_api_key: str = ""
    kite_api_secret: str = ""
    # Where Kite redirects after login; must match the app's redirect URL on kite.trade
    kite_redirect_path: str = "/api/auth/kite/callback"

    # Global safety rails for LIVE trading (paper mode is unrestricted by these)
    live_trading_enabled: bool = False          # master switch; must be true to place real orders
    live_max_orders_per_day: int = 50
    live_max_order_value: float = 100_000.0     # max notional per order, INR
    live_max_daily_loss: float = 10_000.0       # portfolio kill-switch, INR

    # Paper trading defaults
    paper_starting_cash: float = 1_000_000.0
    paper_slippage_pct: float = 0.02            # simulated fill slippage, percent of price

    # Market hours (IST)
    market_open: str = "09:15"
    market_close: str = "15:30"

    cors_origins: str = "http://localhost:5173,http://localhost:3000"


settings = Settings()
