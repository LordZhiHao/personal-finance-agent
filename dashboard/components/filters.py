from datetime import date, timedelta

import streamlit as st

from db.supabase import get_accounts
from utils.constants import CURRENCIES


def render_sidebar_filters(key_prefix: str, account_types: list[str], show_currency: bool = False) -> dict:
    """Sidebar filter form scoped to one page. Widget changes only take effect
    once "Apply Filters" is submitted; the last-applied values persist in
    st.session_state under f"{key_prefix}_filters" across reruns/page switches."""
    state_key = f"{key_prefix}_filters"
    defaults = {
        "start_date": date.today() - timedelta(days=180),
        "end_date": date.today(),
        "account": "All",
    }
    if show_currency:
        defaults["currency"] = CURRENCIES[0]
    applied = st.session_state.get(state_key, defaults)

    accounts = get_accounts(account_type=account_types)
    account_options = ["All"] + [a["name"] for a in accounts]
    account_index = account_options.index(applied["account"]) if applied["account"] in account_options else 0

    with st.sidebar.form(f"{key_prefix}_filters_form"):
        st.header("Filters")
        end_date = st.date_input("End date", value=applied["end_date"])
        start_date = st.date_input("Start date", value=applied["start_date"])
        selected_account = st.selectbox("Account", account_options, index=account_index)
        if show_currency:
            currency_index = CURRENCIES.index(applied["currency"])
            display_currency = st.selectbox("Display currency", CURRENCIES, index=currency_index)
        submitted = st.form_submit_button("Apply Filters")

    if submitted:
        applied = {
            "start_date": start_date,
            "end_date": end_date,
            "account": selected_account,
        }
        if show_currency:
            applied["currency"] = display_currency
        st.session_state[state_key] = applied

    return applied
