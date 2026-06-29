import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
load_dotenv()

from dashboard.auth import require_login
from dashboard.components.filters import render_sidebar_filters
from db.supabase import get_latest_snapshots, get_portfolio_events
from utils.fx import convert

require_login()

st.title("📈 Investments")

filters = render_sidebar_filters("investments", account_types=["brokerage"], show_currency=True)
display_currency = filters["currency"]

snapshots = get_latest_snapshots()
if filters["account"] != "All":
    snapshots = [s for s in snapshots if s["accounts"]["name"] == filters["account"]]

# ── KPI Row ───────────────────────────────────────────────
total_assets = sum(convert(s["total_value"], s["currency"], display_currency) for s in snapshots)
st.metric("Net Worth", f"{display_currency} {total_assets:,.0f}")

st.divider()

# ── Row 2: Net Worth + Asset Allocation ───────────────────
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
    st.subheader("Asset Allocation")
    if snapshots:
        alloc_df = pd.DataFrame([
            {
                "account": s["accounts"]["name"],
                "value": convert(s["total_value"], s["currency"], display_currency),
            }
            for s in snapshots
        ])
        fig = px.pie(alloc_df, names="account", values="value", hole=0.4)
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No asset snapshots yet.")

st.divider()

# ── Row 3: Trade History ──────────────────────────────────
st.subheader("Trade History")
events = get_portfolio_events(filters["start_date"].isoformat(), filters["end_date"].isoformat())
events_df = pd.DataFrame(events)

if events_df.empty:
    st.info("No trades found for this period.")
else:
    events_df["account_name"] = events_df["accounts"].apply(lambda x: x["name"] if x else "Unknown")
    if filters["account"] != "All":
        events_df = events_df[events_df["account_name"] == filters["account"]]
    display_cols = ["date", "ticker", "action", "quantity", "price", "currency", "fees", "account_name"]
    display_df = events_df[display_cols].sort_values("date", ascending=False)
    st.dataframe(display_df, use_container_width=True, height=400)
