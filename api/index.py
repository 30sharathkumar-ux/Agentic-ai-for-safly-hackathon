"""
AgentShield — Vercel Serverless Function Entry Point.
Exposes the FastAPI application for Vercel Serverless Functions.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure project root is on Python module search path
_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from backend.main import app

# Vercel's Python runtime looks for `app` in this file
__all__ = ["app"]

