"""
AgentShield – Database models and SQLite setup (SQLModel/SQLAlchemy).
All data is demo-only; no real DPI services are connected.
"""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

import os
from sqlmodel import Field, Session, SQLModel, create_engine, select

# ---------------------------------------------------------------------------
# Database URL and Engine Setup
# Supports both persistent hosted PostgreSQL (e.g., Neon / Supabase) and local SQLite
# ---------------------------------------------------------------------------
RAW_DB_URL = os.getenv("DATABASE_URL")

if RAW_DB_URL:
    # Normalize postgres:// to postgresql:// for SQLAlchemy 1.4+ / 2.0 compatibility
    if RAW_DB_URL.startswith("postgres://"):
        DATABASE_URL = RAW_DB_URL.replace("postgres://", "postgresql://", 1)
    else:
        DATABASE_URL = RAW_DB_URL
else:
    # If running in serverless (e.g. Vercel) without DATABASE_URL, use /tmp as temporary fallback
    if os.getenv("VERCEL") == "1":
        DATABASE_URL = "sqlite:////tmp/agentshield.db"
    else:
        DATABASE_URL = "sqlite:///./agentshield.db"

# Engine creation with dialect-specific connection options
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )
else:
    # Hosted PostgreSQL (Neon, Supabase, Vercel Postgres)
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        pool_pre_ping=True,      # verify connections before use (vital for serverless cold starts)
        pool_recycle=300,        # recycle connections every 5 min
    )


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class ActionStatus(str, enum.Enum):
    PENDING    = "pending"
    ALLOWED    = "allowed"
    BLOCKED    = "blocked"
    PENDING_APPROVAL = "pending_approval"
    APPROVED   = "approved"
    REJECTED   = "rejected"


class RiskLevel(str, enum.Enum):
    LOW    = "low"
    MEDIUM = "medium"
    HIGH   = "high"
    CRITICAL = "critical"


class ThreatType(str, enum.Enum):
    PROMPT_INJECTION   = "prompt_injection"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    DATA_EXFILTRATION  = "data_exfiltration"
    PERMISSION_VIOLATION = "permission_violation"
    POLICY_OVERRIDE    = "policy_override"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Agent(SQLModel, table=True):
    """A registered AI agent with a defined permission set."""
    id: Optional[int] = Field(default=None, primary_key=True)
    agent_id: str = Field(unique=True, index=True)
    name: str
    description: str = ""
    permissions: str  # JSON-encoded list of permitted action types
    trust_level: str = "low"   # low | medium | high
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ActionRecord(SQLModel, table=True):
    """Every proposed agent action and its security decision."""
    id: Optional[int] = Field(default=None, primary_key=True)
    action_id: str = Field(unique=True, index=True)
    agent_id: str = Field(index=True)
    action_type: str          # e.g. "send_email", "read_document", "upi_transfer"
    action_payload: str       # JSON-encoded action details
    status: ActionStatus = ActionStatus.PENDING
    decision_reason: str = ""
    risk_level: RiskLevel = RiskLevel.LOW
    requires_approval: bool = False
    approved_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decided_at: Optional[datetime] = None


class ThreatFinding(SQLModel, table=True):
    """Security threat detected during action evaluation."""
    id: Optional[int] = Field(default=None, primary_key=True)
    finding_id: str = Field(unique=True, index=True)
    action_id: Optional[str] = None
    agent_id: str
    threat_type: ThreatType
    severity: RiskLevel
    title: str
    description: str
    evidence: str = ""    # snippet or payload excerpt that triggered the finding
    is_resolved: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AuditLog(SQLModel, table=True):
    """Immutable audit trail entry for every significant event."""
    id: Optional[int] = Field(default=None, primary_key=True)
    log_id: str = Field(unique=True, index=True)
    event_type: str         # action_decided | approval_decision | demo_reset | pentest_run
    agent_id: str
    action_id: Optional[str] = None
    details: str            # human-readable summary
    extra: str = "{}"       # JSON-encoded extra context (renamed from metadata – reserved by SQLAlchemy)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ApprovalRequest(SQLModel, table=True):
    """Sensitive actions waiting for human approval."""
    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: str = Field(unique=True, index=True)
    action_id: str = Field(index=True)
    agent_id: str
    reason_for_approval: str
    status: str = "pending"   # pending | approved | rejected
    reviewer_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decided_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# DB initialisation
# ---------------------------------------------------------------------------
_db_initialized = False

def create_db_and_tables() -> None:
    global _db_initialized
    SQLModel.metadata.create_all(engine)
    _db_initialized = True
    try:
        from .demo import seed_agents
        with Session(engine) as s:
            seed_agents(s)
    except Exception:
        pass


def get_session():
    global _db_initialized
    if not _db_initialized:
        create_db_and_tables()
    with Session(engine) as session:
        yield session
