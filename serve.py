"""Serve the AgentShield frontend (static HTML) alongside the API."""
import os
import sys
from pathlib import Path

# Make sure the project root is on the path
sys.path.insert(0, str(Path(__file__).parent))

from backend.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=[str(Path(__file__).parent / "backend"), str(Path(__file__).parent / "frontend")],
    )

