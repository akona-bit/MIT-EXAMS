import logging
import os
import time
import threading
from pathlib import Path
from logging.handlers import RotatingFileHandler

LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "app_error.log"


def get_error_logger(name: str = "app_error") -> logging.Logger:
    """Return a logger that writes errors to logs/app_error.log with rotation."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.ERROR)
    handler = RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger


_error_logger = get_error_logger()


def log_error(message: str, exc_info=True):
    """Log an error to file."""
    _error_logger.error(message, exc_info=exc_info)


class ErrorLogCleanup:
    """Background thread that deletes log files older than `max_age_seconds`."""

    def __init__(self, log_path: Path = LOG_FILE, max_age_seconds: int = 600):
        self.log_path = log_path
        self.max_age = max_age_seconds
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self._thread.start()

    def stop(self):
        self._stop.set()

    def _run(self):
        while not self._stop.is_set():
            self._stop.wait(self.max_age)
            if self._stop.is_set():
                break
            self._cleanup()

    def _cleanup(self):
        try:
            if self.log_path.exists():
                age = time.time() - self.log_path.stat().st_mtime
                if age > self.max_age:
                    # Truncate instead of delete to avoid file handle issues
                    with open(self.log_path, "w", encoding="utf-8") as f:
                        f.write("")
        except Exception:
            pass


# Auto-start cleanup when module is imported
_cleanup_thread = ErrorLogCleanup()
_cleanup_thread.start()
