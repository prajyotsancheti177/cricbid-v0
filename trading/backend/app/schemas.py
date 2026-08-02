"""Pydantic schemas.

`StrategyConfigSchema` is the full, layered parameter tree every strategy instance carries.
Every layer (universe, data, filters, sizing, risk, execution) is independently overridable,
and `params` holds the strategy-type-specific knobs described by that type's param schema.
"""
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ----------------------------------------------------------------------------- config layers
class UniverseConfig(BaseModel):
    exchange: str = "NSE"
    symbols: list[str] = Field(default_factory=lambda: ["RELIANCE", "TCS", "HDFCBANK"])
    max_symbols: int = 50


class DataConfig(BaseModel):
    timeframe: Literal[
        "minute", "3minute", "5minute", "10minute", "15minute", "30minute", "60minute", "day"
    ] = "5minute"
    lookback_candles: int = Field(200, ge=20, le=2000)   # history window given to the strategy
    use_ticks: bool = False                              # also deliver raw ticks (live/paper)


class TimeFilterConfig(BaseModel):
    trade_start: str = "09:20"       # no entries before (IST, HH:MM)
    trade_end: str = "15:00"         # no new entries after
    square_off: str = "15:15"        # force-exit intraday positions at
    days: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])  # 0=Mon .. 4=Fri


class FiltersConfig(BaseModel):
    time: TimeFilterConfig = Field(default_factory=TimeFilterConfig)
    max_trades_per_day: int = Field(10, ge=1)
    min_price: float = 20.0          # skip penny/circuit-prone stocks
    max_price: float = 100000.0
    min_volume: int = 0              # min last-candle volume to allow entry
    extra_entry_rule: str = ""       # optional declarative rule ANDed with strategy entries


class SizingConfig(BaseModel):
    method: Literal["fixed_quantity", "fixed_value", "percent_capital", "risk_based"] = "fixed_value"
    # fixed_quantity: value = shares; fixed_value: value = INR notional per trade;
    # percent_capital: value = % of equity; risk_based: value = % of equity risked to stop-loss
    value: float = 25000.0
    max_quantity: int = 10000


class RiskConfig(BaseModel):
    stop_loss_pct: float = Field(1.0, ge=0)        # 0 disables
    take_profit_pct: float = Field(2.0, ge=0)
    trailing_stop_pct: float = Field(0.0, ge=0)
    max_positions: int = Field(5, ge=1)
    max_loss_per_day: float = Field(5000.0, ge=0)  # strategy-level kill switch (INR); 0 disables
    max_position_value: float = 200000.0           # notional cap per position


class ExecutionConfig(BaseModel):
    product: Literal["MIS", "CNC", "NRML"] = "MIS"
    order_type: Literal["MARKET", "LIMIT"] = "MARKET"
    limit_offset_pct: float = 0.05     # LIMIT orders priced this % through the touch
    variety: str = "regular"
    slippage_pct: Optional[float] = None  # paper-fill slippage override; None = global default
    allow_short: bool = True           # shorts are intraday-only (MIS) on NSE cash


class StrategyConfigSchema(BaseModel):
    universe: UniverseConfig = Field(default_factory=UniverseConfig)
    data: DataConfig = Field(default_factory=DataConfig)
    filters: FiltersConfig = Field(default_factory=FiltersConfig)
    sizing: SizingConfig = Field(default_factory=SizingConfig)
    risk: RiskConfig = Field(default_factory=RiskConfig)
    execution: ExecutionConfig = Field(default_factory=ExecutionConfig)
    params: dict[str, Any] = Field(default_factory=dict)  # strategy-type-specific


# ----------------------------------------------------------------------------- API payloads
class StrategyCreate(BaseModel):
    name: str
    strategy_type: str
    mode: Literal["paper", "live"] = "paper"
    config: StrategyConfigSchema = Field(default_factory=StrategyConfigSchema)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    mode: Optional[Literal["paper", "live"]] = None
    config: Optional[StrategyConfigSchema] = None


class StrategyOut(BaseModel):
    id: int
    name: str
    strategy_type: str
    mode: str
    status: str
    config: dict
    config_version: int
    error_message: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    strategy_id: Optional[int]
    broker_order_id: str
    mode: str
    exchange: str
    symbol: str
    transaction_type: str
    quantity: int
    filled_quantity: int
    order_type: str
    product: str
    price: float
    average_price: float
    status: str
    status_message: str
    tag: str
    placed_at: datetime

    model_config = {"from_attributes": True}


class TradeOut(BaseModel):
    id: int
    strategy_id: Optional[int]
    mode: str
    symbol: str
    transaction_type: str
    quantity: int
    price: float
    charges: float
    executed_at: datetime

    model_config = {"from_attributes": True}


class PositionOut(BaseModel):
    id: int
    strategy_id: Optional[int]
    mode: str
    exchange: str
    symbol: str
    product: str
    quantity: int
    average_price: float
    last_price: float
    realized_pnl: float
    stop_loss: float
    take_profit: float

    model_config = {"from_attributes": True}


class BacktestRequest(BaseModel):
    strategy_type: str
    config: StrategyConfigSchema = Field(default_factory=StrategyConfigSchema)
    from_date: str  # YYYY-MM-DD
    to_date: str
    starting_cash: float = 1_000_000.0
