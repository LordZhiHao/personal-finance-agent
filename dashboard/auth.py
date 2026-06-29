import os

import streamlit as st

from utils.logger import get_logger

logger = get_logger(__name__)


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
            logger.info("require_login: successful login for %s", email)
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            logger.warning("require_login: failed login attempt for %s", email)
            st.error("Invalid email or password")
    st.stop()
