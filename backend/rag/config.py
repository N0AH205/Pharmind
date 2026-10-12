"""Runtime configuration. Pharmer always permits online source access."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

# Kept as a compatibility constant for modules that still import it. Offline
# mode has been retired; source lookups and configured cloud providers stay on.
OFFLINE_MODE = False


def require_network_allowed(operation: str) -> None:
    """Compatibility no-op: online source access is always enabled."""
    return None
