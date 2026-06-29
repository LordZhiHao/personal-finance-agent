def format_money(amount: float, currency: str) -> str:
    return f"{currency} {amount:,.2f}"


def format_pct(value: float) -> str:
    return f"{value:+.1f}%"
