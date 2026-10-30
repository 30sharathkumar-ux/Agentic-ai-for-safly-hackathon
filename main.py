"""
AgentShield — FastAPI Application Entry Point for Vercel Services.
Exposes the FastAPI instance for the 'app' service.
"""
from backend.main import app

__all__ = ["app"]
