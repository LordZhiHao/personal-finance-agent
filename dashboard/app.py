import sys
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv()

from dashboard.auth import require_login

st.set_page_config(page_title="Finance Tracker", layout="wide")

require_login()

pg = st.navigation([
    st.Page("views/spending.py", title="Spending", icon="💸", default=True),
    st.Page("views/investments.py", title="Investments", icon="📈"),
])
pg.run()
