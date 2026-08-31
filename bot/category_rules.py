"""Deterministic category-rule matching, shared by the save-time enforcement pass
(bot/handlers.py::save_extraction), the LLM extraction prompt's hints block
(bot/extractor.py), and the re-file/backfill action (db/supabase.py::apply_rule_backfill).
Pure functions, no I/O — callers fetch rules via db.supabase.get_category_rules()
and pass them in."""


def matches_transaction(transaction: dict, rule: dict) -> bool:
    if rule["match_type"] == "description_contains":
        description = (transaction.get("description") or "").lower()
        return rule["pattern"].lower() in description
    if rule["match_type"] == "amount_equals":
        amount = transaction.get("amount")
        if amount is None:
            return False
        try:
            target = float(rule["pattern"])
        except (TypeError, ValueError):
            return False
        return round(abs(amount), 2) == round(abs(target), 2)
    return False


def apply_rules(transactions: list[dict], rules: list[dict]) -> set[str]:
    """Mutates each transaction's category in place on its first matching rule.
    `rules` must already be created_at-ascending (db.supabase.get_category_rules()'s
    order) — ties are resolved oldest-rule-wins, since that's the one deterministic
    order every caller can agree on without extra bookkeeping. Returns the set of
    rule ids that matched at least one transaction, for the caller to increment
    hit_count on."""
    matched_rule_ids: set[str] = set()
    for t in transactions:
        for rule in rules:
            if matches_transaction(t, rule):
                t["category"] = rule["category"]
                matched_rule_ids.add(rule["id"])
                break
    return matched_rule_ids


def format_rules_for_prompt(rules: list[dict]) -> str:
    """Renders active rules as a short hints block for the LLM extraction prompt —
    a strong signal, not an authoritative one, since apply_rules() enforces the same
    rules deterministically afterward regardless of what the model guesses here."""
    if not rules:
        return ""
    lines = []
    for rule in rules:
        if rule["match_type"] == "description_contains":
            lines.append(f'- if description contains "{rule["pattern"]}", category is usually {rule["category"]}')
        elif rule["match_type"] == "amount_equals":
            lines.append(f'- if amount is {rule["pattern"]}, category is usually {rule["category"]}')
    return "\n".join(lines)
