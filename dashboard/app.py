import os
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv()

from db.supabase import get_accounts, get_latest_snapshots, get_transactions
from utils.constants import CURRENCIES
from utils.fx import convert

st.set_page_config(page_title="Finance Tracker", layout="wide")


def require_login():
    if st.session_state.get("authenticated"):
        return
    st.title("🔒 Personal Finance Dashboard")
    with st.form("login_form"):
        email = st.text_input("Email")
        password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Log in")
    if submitted:
        if email == os.getenv("DASHBOARD_EMAIL") and password == os.getenv("DASHBOARD_PASSWORD"):
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            st.error("Invalid email or password")
    st.stop()


require_login()

st.title("💰 Personal Finance Dashboard")

# ── Sidebar ───────────────────────────────────────────────
with st.sidebar:
    st.header("Filters")
    end_date = st.date_input("End date", value=date.today())
    start_date = st.date_input("Start date", value=date.today() - timedelta(days=180))
    accounts = get_accounts()
    account_options = ["All"] + [a["name"] for a in accounts]
    selected_account = st.selectbox("Account", account_options)
    display_currency = st.selectbox("Display currency", CURRENCIES)

# ── Load data ─────────────────────────────────────────────
txns = get_transactions(start_date.isoformat(), end_date.isoformat())
df = pd.DataFrame(txns)

if df.empty:
    st.info("No transactions found for this period. Start by sending a screenshot to your bot.")
    st.stop()

df["date"] = pd.to_datetime(df["date"])
df["month"] = df["date"].dt.to_period("M").astype(str)
df["account_name"] = df["accounts"].apply(lambda x: x["name"] if x else "Unknown")

if selected_account != "All":
    df = df[df["account_name"] == selected_account]

income_df = df[df["amount"] > 0]
expense_df = df[df["amount"] < 0].copy()
expense_df["amount"] = expense_df["amount"].abs()

# ── KPI Row ───────────────────────────────────────────────
snapshots = get_latest_snapshots()
total_assets = sum(convert(s["total_value"], s["currency"], display_currency) for s in snapshots)
monthly_income = income_df[income_df["month"] == date.today().strftime("%Y-%m")]["amount"].sum()
monthly_spend = expense_df[expense_df["month"] == date.today().strftime("%Y-%m")]["amount"].sum()
savings_rate = round((monthly_income - monthly_spend) / monthly_income * 100, 1) if monthly_income else 0

col1, col2, col3, col4 = st.columns(4)
col1.metric("Net Worth", f"{display_currency} {total_assets:,.0f}")
col2.metric("Monthly Income", f"SGD {monthly_income:,.0f}")
col3.metric("Monthly Spend", f"SGD {monthly_spend:,.0f}")
col4.metric("Savings Rate", f"{savings_rate}%")

st.divider()

# ── Row 2: Net Worth + Monthly Spend ──────────────────────
col1, col2 = st.columns(2)

with col1:
    st.subheader("Net Worth Over Time")
    snap_df = pd.DataFrame(snapshots)
    if not snap_df.empty:
        snap_df["snapshot_date"] = pd.to_datetime(snap_df["snapshot_date"])
        snap_df["converted_value"] = snap_df.apply(
            lambda r: convert(r["total_value"], r["currency"], display_currency), axis=1
        )
        monthly_snap = snap_df.groupby("snapshot_date")["converted_value"].sum().reset_index()
        fig = px.line(monthly_snap, x="snapshot_date", y="converted_value",
                      labels={"converted_value": display_currency, "snapshot_date": "Date"})
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No asset snapshots yet.")

with col2:
    st.subheader("Monthly Spend by Category")
    monthly_cat = expense_df.groupby(["month", "category"])["amount"].sum().reset_index()
    fig = px.bar(monthly_cat, x="month", y="amount", color="category",
                 labels={"amount": "SGD", "month": "Month"})
    st.plotly_chart(fig, use_container_width=True)

# ── Row 3: Income vs Spend + Savings Rate ─────────────────
col1, col2 = st.columns(2)

with col1:
    st.subheader("Income vs Spend Over Time")
    inc_monthly = income_df.groupby("month")["amount"].sum().reset_index()
    inc_monthly["type"] = "Income"
    exp_monthly = expense_df.groupby("month")["amount"].sum().reset_index()
    exp_monthly["type"] = "Spend"
    combined = pd.concat([inc_monthly, exp_monthly])
    fig = px.line(combined, x="month", y="amount", color="type",
                  labels={"amount": "SGD", "month": "Month"})
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Savings Rate Over Time (%)")
    inc_m = income_df.groupby("month")["amount"].sum()
    exp_m = expense_df.groupby("month")["amount"].sum()
    rate_df = ((inc_m - exp_m) / inc_m * 100).reset_index()
    rate_df.columns = ["month", "savings_rate"]
    fig = px.line(rate_df, x="month", y="savings_rate",
                  labels={"savings_rate": "%", "month": "Month"})
    fig.add_hline(y=50, line_dash="dot", line_color="green",
                  annotation_text="50% target")
    st.plotly_chart(fig, use_container_width=True)

# ── Row 4: Donut Charts ───────────────────────────────────
col1, col2 = st.columns(2)

with col1:
    st.subheader("Spend by Category")
    cat_totals = expense_df.groupby("category")["amount"].sum().reset_index()
    fig = px.pie(cat_totals, names="category", values="amount", hole=0.4)
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Asset Allocation")
    if snapshots:
        alloc = [
            {
                "region": s["accounts"]["name"],
                "value": convert(s["total_value"], s["currency"], display_currency),
            }
            for s in snapshots
        ]
        alloc_df = pd.DataFrame(alloc)
        fig = px.pie(alloc_df, names="region", values="value", hole=0.4)
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No asset snapshots yet.")

st.divider()

# ── Row 5: Recent Transactions ────────────────────────────
st.subheader("Recent Transactions")
display_cols = ["date", "description", "amount", "category", "account_name"]
display_df = df[display_cols].sort_values("date", ascending=False)
st.dataframe(display_df, use_container_width=True, height=400)
