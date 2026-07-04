import sys
from datetime import date
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
load_dotenv()

from dashboard.auth import require_login
from dashboard.components.filters import render_sidebar_filters
from db.supabase import get_transactions, update_transaction
from utils.constants import CATEGORIES

require_login()

st.title("💸 Spending")

filters = render_sidebar_filters("spending", account_types=["bank", "ewallet"])

txns = get_transactions(filters["start_date"].isoformat(), filters["end_date"].isoformat())
df = pd.DataFrame(txns)

if df.empty:
    st.info("No transactions found for this period. Start by sending a screenshot to your bot.")
    st.stop()

df["date"] = pd.to_datetime(df["date"])
df["month"] = df["date"].dt.to_period("M").astype(str)
df["month_date"] = df["date"].dt.to_period("M").dt.to_timestamp()
df["account_name"] = df["accounts"].apply(lambda x: x["name"] if x else "Unknown")

if filters["account"] != "All":
    df = df[df["account_name"] == filters["account"]]

income_df = df[df["amount"] > 0]
expense_df = df[df["amount"] < 0].copy()
expense_df["amount"] = expense_df["amount"].abs()

# ── KPI Row ───────────────────────────────────────────────
latest_month = df["month"].max()
monthly_income = income_df[income_df["month"] == latest_month]["amount"].sum()
monthly_spend = expense_df[expense_df["month"] == latest_month]["amount"].sum()
savings_rate = round((monthly_income - monthly_spend) / monthly_income * 100, 2) if monthly_income else 0

col1, col2, col3 = st.columns(3)
col1.metric("Monthly Income", f"SGD {monthly_income:,.2f}")
col2.metric("Monthly Spend", f"SGD {monthly_spend:,.2f}")
col3.metric("Savings Rate", f"{savings_rate}%")

st.divider()

# ── Row 2: Spend by Category ──────────────────────────────
col1, col2 = st.columns(2)

with col1:
    st.subheader("Monthly Spend by Category")
    monthly_cat = expense_df.groupby(["month", "category"])["amount"].sum().reset_index()
    fig = px.bar(monthly_cat, x="month", y="amount", color="category",
                 labels={"amount": "SGD", "month": "Month"})
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Spend by Category")
    cat_totals = expense_df.groupby("category")["amount"].sum().reset_index()
    fig = px.pie(cat_totals, names="category", values="amount", hole=0.4)
    st.plotly_chart(fig, use_container_width=True)

# ── Row 3: Income vs Spend + Savings Rate ─────────────────
col1, col2 = st.columns(2)

with col1:
    st.subheader("Income vs Spend Over Time")
    inc_monthly = income_df.groupby("month_date")["amount"].sum().reset_index()
    inc_monthly["type"] = "Income"
    exp_monthly = expense_df.groupby("month_date")["amount"].sum().reset_index()
    exp_monthly["type"] = "Spend"
    combined = pd.concat([inc_monthly, exp_monthly])
    fig = px.line(combined, x="month_date", y="amount", color="type",
                  markers=True, labels={"amount": "SGD", "month_date": "Month"})
    fig.update_xaxes(dtick="M1", tickformat="%b %Y")
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Savings Rate Over Time (%)")
    inc_m = income_df.groupby("month_date")["amount"].sum()
    exp_m = expense_df.groupby("month_date")["amount"].sum()
    rate_df = ((inc_m - exp_m) / inc_m * 100).reset_index()
    rate_df.columns = ["month_date", "savings_rate"]
    fig = px.line(rate_df, x="month_date", y="savings_rate",
                  markers=True, labels={"savings_rate": "%", "month_date": "Month"})
    fig.update_xaxes(dtick="M1", tickformat="%b %Y")
    fig.add_hline(y=50, line_dash="dot", line_color="green",
                  annotation_text="50% target")
    st.plotly_chart(fig, use_container_width=True)

st.divider()

# ── Row 4: Transactions ────────────────────────────────────
col_title, col_btn = st.columns([4, 1])
with col_title:
    st.subheader("Recent Transactions")
with col_btn:
    st.write("")  # vertical alignment
    if st.button("🔄 Refresh", use_container_width=True):
        st.rerun()
display_cols = ["date", "description", "amount", "category", "account_name"]
display_df = df[display_cols].sort_values("date", ascending=False)

edited_df = st.data_editor(
    display_df,
    column_config={
        "date": st.column_config.DatetimeColumn("Date", disabled=True),
        "description": st.column_config.TextColumn("Description"),
        "amount": st.column_config.NumberColumn("Amount", disabled=True, format="%.2f"),
        "account_name": st.column_config.TextColumn("Account", disabled=True),
        "category": st.column_config.SelectboxColumn("Category", options=CATEGORIES, required=True),
    },
    use_container_width=True,
    height=400,
    hide_index=True,
)

changed_mask = (edited_df["category"] != display_df["category"]) | (edited_df["description"] != display_df["description"])
if changed_mask.any():
    if st.button(f"Save {changed_mask.sum()} change(s)"):
        for idx in edited_df[changed_mask].index:
            fields = {}
            if edited_df.loc[idx, "category"] != display_df.loc[idx, "category"]:
                fields["category"] = edited_df.loc[idx, "category"]
            if edited_df.loc[idx, "description"] != display_df.loc[idx, "description"]:
                fields["description"] = edited_df.loc[idx, "description"]
            update_transaction(df.loc[idx, "id"], fields)
        st.success("Transactions updated.")
        st.rerun()
