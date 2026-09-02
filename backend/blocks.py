"""backend/blocks.py — Rich-Reply Agent Envelope schema (Phase 6, Sub-phase 1).

bot/finance_agent.py::answer_question() always returns AgentReply(text=..., blocks=[],
actions=[]) as of this sub-phase — nothing populates blocks/actions yet. Later
sub-phases add producers (evidence-capture from tool results, a `present` tool) and
consumers (web BlockRenderer, Telegram chart/chip rendering).

Field shapes for the 6 block variants are this session's design (no parent-plan
document exists in-repo with byte-exact shapes) — safe to adjust before Sub-phase 2
starts producing real instances, since blocks is always [] until then.
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


class ComparisonBlock(BaseModel):
    type: Literal["comparison"] = "comparison"
    label: str
    left_label: str
    left_value: str
    right_label: str
    right_value: str
    currency: str | None = None


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
