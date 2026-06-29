import logging

_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


def get_logger(name: str) -> logging.Logger:
    """Module-level logger writing to stdout. Railway (bot/scheduler process)
    and Streamlit Community Cloud (dashboard process) both capture and display
    stdout in their own log viewers, so no extra log storage/rotation is needed."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(_FORMAT))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger
