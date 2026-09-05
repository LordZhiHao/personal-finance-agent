"""backend/blocks.py — Rich-Reply Agent Envelope schema (Phase 6).

bot/finance_agent.py::answer_question() returns an AgentReply(text, blocks, actions).
As of Sub-phase 2, `blocks` is populated for two tools (get_spending_summary ->
BreakdownBlock, get_month_comparison -> ComparisonBlock) via bot/finance_agent.py's
_evidence_to_block() — either deterministically (no present() call this turn) or
model-selected (via the present tool). Every other block-producing tool mapping,
plus consumers (web BlockRenderer, Telegram chart/chip rendering), are later
sub-phases' work.

Field shapes for the remaining unused block variants are still this session's design
(no parent-plan document exists in-repo with byte-exact shapes) — safe to keep
adjusting as real producers are added for each one.
"""
import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class MetricBlock(BaseModel):
    type: Literal["metric"] = "metric"
    label: str
    value: str
    delta: str | None = None
    delta_direction: Literal["up", "down", "flat"] | None = None
    currency: str | None = None


class ComparisonRow(BaseModel):
    label: str  # e.g. a category name
    values: list[float]  # aligned positionally to ComparisonBlock.series


class ComparisonBlock(BaseModel):
    type: Literal["comparison"] = "comparison"
    label: str
    currency: str | None = None
    series: list[str]  # e.g. ["This month", "Last month", "A year ago"]
    rows: list[ComparisonRow] = []


class BreakdownItem(BaseModel):
    label: str
    value: float
    pct: float | None = None


class BreakdownBlock(BaseModel):
    type: Literal["breakdown"] = "breakdown"
    label: str
    currency: str | None = None
    items: list[BreakdownItem] = []


class TimeseriesPoint(BaseModel):
    date: str  # ISO date, e.g. "2026-08-01"
    value: float


class TimeseriesBlock(BaseModel):
    type: Literal["timeseries"] = "timeseries"
    label: str
    currency: str | None = None
    points: list[TimeseriesPoint] = []


class TxnListItem(BaseModel):
    id: str
    date: str
    description: str
    amount: float
    currency: str
    category: str | None = None


class TxnListBlock(BaseModel):
    type: Literal["txn_list"] = "txn_list"
    label: str
    items: list[TxnListItem] = []


class ReceiptDraftBlock(BaseModel):
    type: Literal["receipt_draft"] = "receipt_draft"
    data: dict  # same shape as save_extraction()'s `data` arg (bot/handlers.py)
    candidates: list[dict] = []


Block = Annotated[
    MetricBlock
    | ComparisonBlock
    | BreakdownBlock
    | TimeseriesBlock
    | TxnListBlock
    | ReceiptDraftBlock,
    Field(discriminator="type"),
]


class Action(BaseModel):
    """Flat model — valid `kind` values are TBD in a later sub-phase (action
    executor whitelist); kept a plain str now since there are no consumers yet."""
    id: str
    label: str
    kind: str


class AgentReply(BaseModel):
    reply_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    blocks: list[Block] = []
    actions: list[Action] = []
