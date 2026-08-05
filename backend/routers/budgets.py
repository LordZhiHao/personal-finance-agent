from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_user
from backend.schemas import BudgetCreate, BudgetUpdate, GoalContribute, GoalCreate, GoalUpdate
from db.supabase import (
    contribute_to_goal,
    create_user_budget,
    create_user_goal,
    delete_user_budget,
    delete_user_goal,
    get_category_classifications_for_user,
    get_transactions,
    get_user_budgets,
    get_user_goals,
    update_user_budget,
    update_user_goal,
)
from scheduler.report_builder import budget_status
from utils.period import parse_period

router = APIRouter(prefix="/api/budgets", tags=["budgets"])
goals_router = APIRouter(prefix="/api/goals", tags=["goals"])


def _require_expense_category(category: str, user_id: str) -> None:
    """Budgets are a spending-discipline feature — reject a category that isn't
    classified "expense" (e.g. Investment), same rule enforced by the finance
    agent's create_budget tool."""
    classification = get_category_classifications_for_user(user_id).get(category, "expense")
    if classification != "expense":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"'{category}' is classified as {classification}, not an expense category — "
            "budgets can only be set on spending categories.",
        )


@router.get("")
def list_budgets(user_id: str = Depends(get_current_user)):
    return get_user_budgets(user_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_budget_route(payload: BudgetCreate, user_id: str = Depends(get_current_user)):
    _require_expense_category(payload.category, user_id)
    return create_user_budget(user_id, payload.category, payload.monthly_limit, payload.currency)


@router.patch("/{budget_id}")
def patch_budget(budget_id: str, fields: BudgetUpdate, user_id: str = Depends(get_current_user)):
    updates = fields.model_dump(exclude_unset=True)
    if "category" in updates:
        _require_expense_category(updates["category"], user_id)
    return update_user_budget(budget_id, updates, user_id)


@router.delete("/{budget_id}")
def delete_budget_route(budget_id: str, user_id: str = Depends(get_current_user)):
    delete_user_budget(budget_id, user_id)
    return {"ok": True}


@router.get("/status")
def get_budgets_status(user_id: str = Depends(get_current_user)):
    """Month-to-date spend vs. each budgeted category's monthly_limit — same computation
    the finance agent's get_budget_status tool and scheduler/user_budgets.py use."""
    budgets = get_user_budgets(user_id)
    if not budgets:
        return []
    start, end, _ = parse_period("month_to_date")
    txns = get_transactions(start.isoformat(), end.isoformat(), user_id)
    return budget_status(txns, budgets, get_category_classifications_for_user(user_id))


@goals_router.get("")
def list_goals(user_id: str = Depends(get_current_user)):
    return get_user_goals(user_id)


@goals_router.post("", status_code=status.HTTP_201_CREATED)
def create_goal_route(payload: GoalCreate, user_id: str = Depends(get_current_user)):
    target_date = payload.target_date.isoformat() if payload.target_date else None
    return create_user_goal(user_id, payload.name, payload.target_amount, payload.currency, target_date)


@goals_router.patch("/{goal_id}")
def patch_goal(goal_id: str, fields: GoalUpdate, user_id: str = Depends(get_current_user)):
    data = fields.model_dump(exclude_unset=True)
    if "target_date" in data and data["target_date"] is not None:
        data["target_date"] = data["target_date"].isoformat()
    return update_user_goal(goal_id, data, user_id)


@goals_router.delete("/{goal_id}")
def delete_goal_route(goal_id: str, user_id: str = Depends(get_current_user)):
    delete_user_goal(goal_id, user_id)
    return {"ok": True}


@goals_router.post("/{goal_id}/contribute")
def contribute_goal_route(goal_id: str, payload: GoalContribute, user_id: str = Depends(get_current_user)):
    return contribute_to_goal(goal_id, payload.amount, user_id)
