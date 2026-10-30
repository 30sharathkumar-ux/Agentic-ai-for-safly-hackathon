"""
AgentShield – FastAPI application entry point.

Run with:
    uvicorn backend.main:app --reload --port 8000

All DPI integrations (Aadhaar, DigiLocker, UPI, ONDC, email) are SIMULATED.
No real external services are called.
"""
from __future__ import annotations

import csv
import io
import json
import os
import uuid
from datetime import datetime
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, col, select

from .models import (
    ActionRecord,
    ActionStatus,
    Agent,
    AuditLog,
    ApprovalRequest,
    RiskLevel,
    ThreatFinding,
    create_db_and_tables,
    get_session,
)
from .policy import evaluate_action
from .demo import (
    PENTEST_SCENARIOS,
    reset_demo_data,
    run_demo_scenario,
    run_pentest,
    seed_agents,
)

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

load_dotenv()

# GEMINI_API_KEY is intentionally NOT forwarded to the frontend or logged.
_GEMINI_KEY: Optional[str] = os.getenv("GEMINI_API_KEY") or None

app = FastAPI(
    title="AgentShield API",
    description=(
        "Security gateway for AI agents interacting with India's Digital Public Infrastructure. "
        "⚠ All DPI integrations are DEMO-ONLY – no real services are contacted."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten for production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ApiPrefixMiddleware(BaseHTTPMiddleware):
    """Ensures endpoints match whether Vercel or a reverse proxy forwards as /api/* or strips to /*."""
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if (
            not path.startswith("/api")
            and not path.startswith("/assets")
            and path not in ("/", "/index.html", "/favicon.ico", "/docs", "/openapi.json", "/redoc")
        ):
            request.scope["path"] = f"/api{path}"
        return await call_next(request)


app.add_middleware(ApiPrefixMiddleware)


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()
    with Session(bind=__import__("backend.models", fromlist=["engine"]).engine) as s:
        seed_agents(s)


# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------

class EvaluateActionRequest(BaseModel):
    agent_id: str
    action_type: str
    action_payload: dict = {}
    document_text: str = ""


class ApprovalDecisionRequest(BaseModel):
    decision: str          # "approved" | "rejected"
    reviewer_note: str = ""
    reviewer: str = "human-operator"


class UpdatePermissionsRequest(BaseModel):
    permissions: list[str]


# ---------------------------------------------------------------------------
# 1. Overview metrics
# ---------------------------------------------------------------------------

@app.get("/api/metrics", tags=["Overview"])
def get_metrics(session: Session = Depends(get_session)) -> dict[str, Any]:
    """Return high-level dashboard metrics."""
    actions = session.exec(select(ActionRecord)).all()
    threats = session.exec(select(ThreatFinding)).all()
    approvals = session.exec(
        select(ApprovalRequest).where(ApprovalRequest.status == "pending")
    ).all()

    total = len(actions)
    blocked = sum(1 for a in actions if a.status == ActionStatus.BLOCKED)
    allowed = sum(1 for a in actions if a.status == ActionStatus.ALLOWED)
    pending_approval = sum(1 for a in actions if a.status == ActionStatus.PENDING_APPROVAL)
    approved = sum(1 for a in actions if a.status == ActionStatus.APPROVED)
    rejected = sum(1 for a in actions if a.status == ActionStatus.REJECTED)

    critical_threats = sum(1 for t in threats if t.severity == RiskLevel.CRITICAL)
    high_threats = sum(1 for t in threats if t.severity == RiskLevel.HIGH)

    return {
        "total_actions": total,
        "allowed": allowed,
        "blocked": blocked,
        "pending_approval": pending_approval,
        "approved": approved,
        "rejected": rejected,
        "block_rate_pct": round(blocked / total * 100, 1) if total else 0,
        "total_threats": len(threats),
        "critical_threats": critical_threats,
        "high_threats": high_threats,
        "open_approvals": len(approvals),
        "gemini_enabled": _GEMINI_KEY is not None,
        "demo_note": "All metrics reflect simulated demo data only.",
    }


# ---------------------------------------------------------------------------
# 2. Agents
# ---------------------------------------------------------------------------

@app.get("/api/agents", tags=["Agents"])
def list_agents(session: Session = Depends(get_session)):
    agents = session.exec(select(Agent)).all()
    result = []
    for ag in agents:
        perms = json.loads(ag.permissions)
        result.append({
            "agent_id": ag.agent_id,
            "name": ag.name,
            "description": ag.description,
            "permissions": perms,
            "trust_level": ag.trust_level,
            "is_active": ag.is_active,
            "created_at": ag.created_at.isoformat(),
        })
    return result


@app.get("/api/agents/{agent_id}", tags=["Agents"])
def get_agent(agent_id: str, session: Session = Depends(get_session)):
    ag = session.exec(select(Agent).where(Agent.agent_id == agent_id)).first()
    if not ag:
        raise HTTPException(status_code=404, detail="Agent not found")
    actions = session.exec(
        select(ActionRecord).where(ActionRecord.agent_id == agent_id)
        .order_by(col(ActionRecord.created_at).desc()).limit(10)
    ).all()
    all_actions = session.exec(
        select(ActionRecord).where(ActionRecord.agent_id == agent_id)
    ).all()
    return {
        "agent_id": ag.agent_id,
        "name": ag.name,
        "description": ag.description,
        "permissions": json.loads(ag.permissions),
        "trust_level": ag.trust_level,
        "is_active": ag.is_active,
        "created_at": ag.created_at.isoformat(),
        "action_stats": {
            "total": len(all_actions),
            "allowed": sum(1 for a in all_actions if a.status == ActionStatus.ALLOWED),
            "blocked": sum(1 for a in all_actions if a.status == ActionStatus.BLOCKED),
            "pending_approval": sum(1 for a in all_actions if a.status == ActionStatus.PENDING_APPROVAL),
        },
        "recent_actions": [_action_to_dict(a) for a in actions],
    }


@app.put("/api/agents/{agent_id}/permissions", tags=["Agents"])
def update_agent_permissions(
    agent_id: str,
    body: UpdatePermissionsRequest,
    session: Session = Depends(get_session),
):
    """Update permissions for a specific agent and record the change in audit log."""
    ag = session.exec(select(Agent).where(Agent.agent_id == agent_id)).first()
    if not ag:
        raise HTTPException(status_code=404, detail="Agent not found")
    old_perms = json.loads(ag.permissions)
    ag.permissions = json.dumps(body.permissions)
    session.add(ag)

    audit = AuditLog(
        log_id=str(uuid.uuid4()),
        event_type="permission_update",
        agent_id=agent_id,
        action_id=None,
        details=(
            f"Permissions updated for '{ag.name}' ({agent_id}): "
            f"{', '.join(body.permissions) if body.permissions else 'none'} "
            "(saved in backend database)."
        ),
        extra=json.dumps({"old_permissions": old_perms, "new_permissions": body.permissions}),
    )
    session.add(audit)
    session.commit()
    session.refresh(ag)
    return {
        "agent_id": ag.agent_id,
        "name": ag.name,
        "permissions": body.permissions,
        "status": "updated",
    }


@app.post("/api/agents/{agent_id}/permissions", tags=["Agents"])
def post_agent_permissions(
    agent_id: str,
    body: UpdatePermissionsRequest,
    session: Session = Depends(get_session),
):
    return update_agent_permissions(agent_id, body, session)


@app.post("/api/agents/{agent_id}/reset-permissions", tags=["Agents"])
def reset_agent_permissions(agent_id: str, session: Session = Depends(get_session)):
    """Reset agent permissions to default configuration."""
    from .demo import DEMO_AGENTS
    default_agent = next((a for a in DEMO_AGENTS if a["agent_id"] == agent_id), None)
    if not default_agent:
        raise HTTPException(status_code=404, detail="Agent not found in default seed list")
    default_perms = json.loads(default_agent["permissions"])
    return update_agent_permissions(
        agent_id, UpdatePermissionsRequest(permissions=default_perms), session
    )


# ---------------------------------------------------------------------------
# 3. Action evaluation (the core security gate)
# ---------------------------------------------------------------------------

@app.post("/api/actions/evaluate", tags=["Actions"])
def evaluate(req: EvaluateActionRequest, session: Session = Depends(get_session)):
    """
    Submit a proposed agent action for security evaluation.
    Returns the decision immediately (allow / block / pending_approval).
    """
    record = evaluate_action(
        session,
        agent_id=req.agent_id,
        action_type=req.action_type,
        action_payload=req.action_payload,
        document_text=req.document_text,
    )
    return _action_to_dict(record)


@app.get("/api/actions", tags=["Actions"])
def list_actions(
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    session: Session = Depends(get_session),
):
    """List action records with optional filters."""
    q = select(ActionRecord)
    if agent_id:
        q = q.where(ActionRecord.agent_id == agent_id)
    if status:
        q = q.where(ActionRecord.status == status)
    q = q.order_by(col(ActionRecord.created_at).desc()).offset(offset).limit(limit)
    records = session.exec(q).all()
    return [_action_to_dict(r) for r in records]


@app.get("/api/actions/{action_id}", tags=["Actions"])
def get_action(action_id: str, session: Session = Depends(get_session)):
    r = session.exec(select(ActionRecord).where(ActionRecord.action_id == action_id)).first()
    if not r:
        raise HTTPException(status_code=404, detail="Action not found")
    return _action_to_dict(r)


def _action_to_dict(r: ActionRecord) -> dict:
    return {
        "action_id": r.action_id,
        "agent_id": r.agent_id,
        "action_type": r.action_type,
        "action_payload": json.loads(r.action_payload),
        "status": r.status,
        "decision_reason": r.decision_reason,
        "risk_level": r.risk_level,
        "requires_approval": r.requires_approval,
        "approved_by": r.approved_by,
        "created_at": r.created_at.isoformat(),
        "decided_at": r.decided_at.isoformat() if r.decided_at else None,
    }


# ---------------------------------------------------------------------------
# 4. Threat findings
# ---------------------------------------------------------------------------

@app.get("/api/threats", tags=["Threats"])
def list_threats(
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    session: Session = Depends(get_session),
):
    q = select(ThreatFinding)
    if severity:
        q = q.where(ThreatFinding.severity == severity)
    if resolved is not None:
        q = q.where(ThreatFinding.is_resolved == resolved)
    q = q.order_by(col(ThreatFinding.created_at).desc())
    findings = session.exec(q).all()
    return [_threat_to_dict(f) for f in findings]


@app.patch("/api/threats/{finding_id}/resolve", tags=["Threats"])
def resolve_threat(finding_id: str, session: Session = Depends(get_session)):
    f = session.exec(select(ThreatFinding).where(ThreatFinding.finding_id == finding_id)).first()
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    f.is_resolved = True
    session.add(f)
    session.commit()
    session.refresh(f)
    return _threat_to_dict(f)


def _threat_to_dict(f: ThreatFinding) -> dict:
    return {
        "finding_id": f.finding_id,
        "action_id": f.action_id,
        "agent_id": f.agent_id,
        "threat_type": f.threat_type,
        "severity": f.severity,
        "title": f.title,
        "description": f.description,
        "evidence": f.evidence,
        "is_resolved": f.is_resolved,
        "created_at": f.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# 5. Approvals
# ---------------------------------------------------------------------------

@app.get("/api/approvals", tags=["Approvals"])
def list_approvals(
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    q = select(ApprovalRequest)
    if status:
        q = q.where(ApprovalRequest.status == status)
    q = q.order_by(col(ApprovalRequest.created_at).desc())
    reqs = session.exec(q).all()
    return [_approval_to_dict(r) for r in reqs]


@app.post("/api/approvals/{request_id}/decide", tags=["Approvals"])
def decide_approval(
    request_id: str,
    body: ApprovalDecisionRequest,
    session: Session = Depends(get_session),
):
    """
    Approve or reject a pending action.
    Updates the ActionRecord status and writes an audit entry.
    No real external action is ever executed.
    """
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be 'approved' or 'rejected'")

    req = session.exec(
        select(ApprovalRequest).where(ApprovalRequest.request_id == request_id)
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail=f"Request already {req.status}")

    now = datetime.utcnow()
    req.status = body.decision
    req.reviewer_note = body.reviewer_note
    req.decided_at = now
    session.add(req)

    # Update the linked ActionRecord
    action = session.exec(
        select(ActionRecord).where(ActionRecord.action_id == req.action_id)
    ).first()
    if action:
        action.status = ActionStatus.APPROVED if body.decision == "approved" else ActionStatus.REJECTED
        action.approved_by = body.reviewer
        action.decided_at = now
        session.add(action)

    # Audit entry
    audit = AuditLog(
        log_id=str(uuid.uuid4()),
        event_type="approval_decision",
        agent_id=req.agent_id,
        action_id=req.action_id,
        details=(
            f"Human reviewer '{body.reviewer}' {body.decision} action '{req.action_id}'. "
            f"Note: {body.reviewer_note or 'none'}. "
            "⚠ No real external action was executed."
        ),
        extra=json.dumps({
            "decision": body.decision,
            "reviewer": body.reviewer,
            "request_id": request_id,
        }),
    )
    session.add(audit)
    session.commit()
    session.refresh(req)
    return _approval_to_dict(req)


def _approval_to_dict(r: ApprovalRequest) -> dict:
    return {
        "request_id": r.request_id,
        "action_id": r.action_id,
        "agent_id": r.agent_id,
        "reason_for_approval": r.reason_for_approval,
        "status": r.status,
        "reviewer_note": r.reviewer_note,
        "created_at": r.created_at.isoformat(),
        "decided_at": r.decided_at.isoformat() if r.decided_at else None,
    }


# ---------------------------------------------------------------------------
# 6. Audit log
# ---------------------------------------------------------------------------

@app.get("/api/audit", tags=["Audit"])
def search_audit(
    agent_id: Optional[str] = None,
    event_type: Optional[str] = None,
    q: Optional[str] = Query(None, description="Free-text search in details"),
    limit: int = Query(100, le=500),
    offset: int = 0,
    session: Session = Depends(get_session),
):
    query = select(AuditLog)
    if agent_id:
        query = query.where(AuditLog.agent_id == agent_id)
    if event_type:
        query = query.where(AuditLog.event_type == event_type)
    query = query.order_by(col(AuditLog.created_at).desc()).offset(offset).limit(limit)
    logs = session.exec(query).all()

    # Simple text filter (SQLite doesn't support FTS out of the box)
    if q:
        q_lower = q.lower()
        logs = [l for l in logs if q_lower in l.details.lower()]

    return [_audit_to_dict(l) for l in logs]


@app.get("/api/audit/export", tags=["Audit"])
def export_audit(session: Session = Depends(get_session)):
    """Download audit log as CSV."""
    logs = session.exec(select(AuditLog).order_by(col(AuditLog.created_at).asc())).all()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "log_id", "event_type", "agent_id", "action_id", "details", "extra", "created_at"
    ])
    writer.writeheader()
    for l in logs:
        writer.writerow({
            "log_id": l.log_id,
            "event_type": l.event_type,
            "agent_id": l.agent_id,
            "action_id": l.action_id or "",
            "details": l.details,
            "extra": l.extra,
            "created_at": l.created_at.isoformat(),
        })
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=agentshield-audit.csv"},
    )


@app.get("/api/audit/export/json", tags=["Audit"])
def export_audit_json(session: Session = Depends(get_session)):
    """Download audit log as JSON."""
    logs = session.exec(select(AuditLog).order_by(col(AuditLog.created_at).asc())).all()
    data = [_audit_to_dict(l) for l in logs]
    content = json.dumps(data, indent=2, default=str)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=agentshield-audit.json"},
    )


def _audit_to_dict(l: AuditLog) -> dict:
    return {
        "log_id": l.log_id,
        "event_type": l.event_type,
        "agent_id": l.agent_id,
        "action_id": l.action_id,
        "details": l.details,
        "metadata": json.loads(l.extra),
        "created_at": l.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# 7. Demo scenario
# ---------------------------------------------------------------------------

@app.post("/api/demo/run", tags=["Demo"])
def run_demo(session: Session = Depends(get_session)):
    """
    Run the full demo scenario.
    Idempotent – safe to call multiple times for a live demo.
    """
    result = run_demo_scenario(session)
    return result


@app.post("/api/demo/reset", tags=["Demo"])
def reset_demo(session: Session = Depends(get_session)):
    """Reset all demo data and re-seed agents."""
    reset_demo_data(session)
    return {"status": "reset_complete", "message": "Demo data reset and agents re-seeded."}


# ---------------------------------------------------------------------------
# 8. Pentest lab
# ---------------------------------------------------------------------------

@app.get("/api/pentest/scenarios", tags=["Pentest Lab"])
def list_pentest_scenarios():
    """List all available local pentest scenarios."""
    return PENTEST_SCENARIOS


@app.post("/api/pentest/run/{scenario_id}", tags=["Pentest Lab"])
def run_pentest_scenario(scenario_id: str, session: Session = Depends(get_session)):
    """
    Execute a local, non-destructive pentest scenario.
    Only exercises AgentShield's mock policy logic.
    No network scanning, real-world exploit code, or external traffic.
    """
    result = run_pentest(session, scenario_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.post("/api/pentest/reset", tags=["Pentest Lab"])
def reset_pentest(session: Session = Depends(get_session)):
    """Remove all pentest-generated records from the audit log."""
    from sqlmodel import delete as sql_delete
    from .models import AuditLog as AL
    pentest_logs = session.exec(
        select(AuditLog).where(AuditLog.event_type == "pentest_run")
    ).all()
    for l in pentest_logs:
        session.delete(l)
    session.commit()
    return {"status": "pentest_reset", "removed_entries": len(pentest_logs)}


# ---------------------------------------------------------------------------
# 9. Health check
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "service": "AgentShield",
        "version": "1.0.0",
        "demo_mode": True,
        "gemini_enabled": _GEMINI_KEY is not None,
        "warning": "All DPI integrations are SIMULATED. No real data is processed.",
    }


# ---------------------------------------------------------------------------
# Static frontend mount (Serves built Vite output from frontend/dist if available)
# ---------------------------------------------------------------------------
from pathlib import Path
from fastapi.staticfiles import StaticFiles

_frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
_dist_dir = _frontend_dir / "dist"
_target_dir = _dist_dir if _dist_dir.exists() else _frontend_dir

if _target_dir.exists():
    app.mount("/", StaticFiles(directory=str(_target_dir), html=True), name="frontend")
