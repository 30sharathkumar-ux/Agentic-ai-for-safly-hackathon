"""
AgentShield – Core Security Policy Engine.

Rules (in order):
  1. Agent must exist and be active.
  2. Action type must be in the agent's permission list.
  3. Document/prompt text is untrusted – embedded instructions cannot grant permissions.
  4. Actions flagged as sensitive require human approval even when permitted.
  5. Actions attempting data exfiltration or containing injection patterns are BLOCKED
     and generate a ThreatFinding.
  6. Low-risk permitted actions are ALLOWED directly.
  7. Every decision is recorded in the AuditLog.

An AI/LLM may assist with summarising content but NEVER makes the allow/block decision.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from .models import (
    ActionRecord,
    ActionStatus,
    Agent,
    AuditLog,
    ApprovalRequest,
    RiskLevel,
    ThreatFinding,
    ThreatType,
)

# ---------------------------------------------------------------------------
# Patterns that indicate embedded prompt-injection or exfiltration attempts
# ---------------------------------------------------------------------------

INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"ignore\s+(previous|all|prior)\s+instruction", re.I),
    re.compile(r"new\s+instruction\s*:", re.I),
    re.compile(r"system\s+prompt\s*:", re.I),
    re.compile(r"you\s+are\s+now\s+a", re.I),
    re.compile(r"disregard\s+your\s+previous", re.I),
    re.compile(r"override\s+(policy|permissions?|rules?)", re.I),
    re.compile(r"send\s+(all|the|this|private|confidential|user)\s+\w+\s+to\b", re.I),
    re.compile(r"forward\s+.{0,40}\s+to\s+[\w.@]+", re.I),
    re.compile(r"exfiltrate", re.I),
    re.compile(r"leak\s+(data|records?|information)", re.I),
    re.compile(r"email\s+.{0,60}external", re.I),
]

EXFILTRATION_DOMAINS = {"evil.com", "attacker.io", "exfil.net", "malicious.org"}

# Actions in this set always require human approval (even when permitted)
SENSITIVE_ACTIONS = {
    "upi_transfer",
    "aadhaar_lookup",
    "digilocker_share",
    "send_email_external",
    "bulk_data_export",
    "ondc_order_place",
}

# Actions that are always blocked regardless of permissions
ALWAYS_BLOCKED_ACTIONS = {
    "delete_all_records",
    "grant_permissions",
    "modify_policy",
    "access_raw_passwords",
}


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _new_uuid() -> str:
    return str(uuid.uuid4())


def _detect_injection(text: str) -> Optional[re.Match]:
    for pattern in INJECTION_PATTERNS:
        m = pattern.search(text)
        if m:
            return m
    return None


def _detect_exfiltration_domain(payload: dict) -> Optional[str]:
    payload_str = json.dumps(payload).lower()
    for domain in EXFILTRATION_DOMAINS:
        if domain in payload_str:
            return domain
    return None


def _audit(session: Session, event_type: str, agent_id: str,
           action_id: Optional[str], details: str, metadata: dict = None) -> None:
    entry = AuditLog(
        log_id=_new_uuid(),
        event_type=event_type,
        agent_id=agent_id,
        action_id=action_id,
        details=details,
        extra=json.dumps(metadata or {}),
    )
    session.add(entry)


def _create_threat(session: Session, agent_id: str, action_id: str,
                   threat_type: ThreatType, severity: RiskLevel,
                   title: str, description: str, evidence: str = "") -> ThreatFinding:
    finding = ThreatFinding(
        finding_id=_new_uuid(),
        action_id=action_id,
        agent_id=agent_id,
        threat_type=threat_type,
        severity=severity,
        title=title,
        description=description,
        evidence=evidence[:500],   # cap evidence length
    )
    session.add(finding)
    return finding


# ---------------------------------------------------------------------------
# Main policy evaluation function
# ---------------------------------------------------------------------------

def evaluate_action(
    session: Session,
    agent_id: str,
    action_type: str,
    action_payload: dict,
    document_text: str = "",
) -> ActionRecord:
    """
    Evaluate a proposed agent action against AgentShield's security policy.
    Returns the persisted ActionRecord with a final status set.
    """
    action_id = _new_uuid()
    payload_json = json.dumps(action_payload)
    now = datetime.utcnow()

    # --- Step 1: Resolve agent -------------------------------------------
    agent: Optional[Agent] = session.exec(
        select(Agent).where(Agent.agent_id == agent_id, Agent.is_active == True)
    ).first()

    if agent is None:
        record = ActionRecord(
            action_id=action_id,
            agent_id=agent_id,
            action_type=action_type,
            action_payload=payload_json,
            status=ActionStatus.BLOCKED,
            decision_reason="Agent does not exist or is not active.",
            risk_level=RiskLevel.HIGH,
            decided_at=now,
        )
        session.add(record)
        _audit(session, "action_decided", agent_id, action_id,
               f"BLOCKED – unknown agent '{agent_id}' attempted '{action_type}'.")
        session.commit()
        session.refresh(record)
        return record

    agent_permissions: list[str] = json.loads(agent.permissions)

    # --- Step 2: Always-blocked actions ----------------------------------
    if action_type in ALWAYS_BLOCKED_ACTIONS:
        record = ActionRecord(
            action_id=action_id,
            agent_id=agent_id,
            action_type=action_type,
            action_payload=payload_json,
            status=ActionStatus.BLOCKED,
            decision_reason=f"Action '{action_type}' is unconditionally prohibited by policy.",
            risk_level=RiskLevel.CRITICAL,
            decided_at=now,
        )
        session.add(record)
        _create_threat(session, agent_id, action_id,
                       ThreatType.POLICY_OVERRIDE, RiskLevel.CRITICAL,
                       "Attempted policy-prohibited action",
                       f"Agent '{agent_id}' tried to perform '{action_type}' which is always blocked.",
                       action_type)
        _audit(session, "action_decided", agent_id, action_id,
               f"BLOCKED – '{action_type}' is unconditionally prohibited.")
        session.commit()
        session.refresh(record)
        return record

    # --- Step 3: Scan document_text for prompt injection ----------------
    injection_hit = _detect_injection(document_text) if document_text else None
    if injection_hit:
        evidence = document_text[max(0, injection_hit.start() - 40): injection_hit.end() + 80]
        record = ActionRecord(
            action_id=action_id,
            agent_id=agent_id,
            action_type=action_type,
            action_payload=payload_json,
            status=ActionStatus.BLOCKED,
            decision_reason=(
                "Prompt injection detected in document content. "
                "Embedded instructions cannot override policy or grant permissions."
            ),
            risk_level=RiskLevel.CRITICAL,
            decided_at=now,
        )
        session.add(record)
        _create_threat(session, agent_id, action_id,
                       ThreatType.PROMPT_INJECTION, RiskLevel.CRITICAL,
                       "Prompt injection in document",
                       "A document processed by the agent contained instructions "
                       "attempting to override AgentShield policy.",
                       evidence)
        _audit(session, "action_decided", agent_id, action_id,
               f"BLOCKED – prompt injection detected during '{action_type}'.",
               {"pattern": injection_hit.group(0)})
        session.commit()
        session.refresh(record)
        return record

    # --- Step 4: Scan payload for exfiltration domain -------------------
    exfil_domain = _detect_exfiltration_domain(action_payload)
    if exfil_domain:
        record = ActionRecord(
            action_id=action_id,
            agent_id=agent_id,
            action_type=action_type,
            action_payload=payload_json,
            status=ActionStatus.BLOCKED,
            decision_reason=(
                f"Data exfiltration attempt detected: target domain '{exfil_domain}' "
                "is on the blocked-domain list."
            ),
            risk_level=RiskLevel.CRITICAL,
            decided_at=now,
        )
        session.add(record)
        _create_threat(session, agent_id, action_id,
                       ThreatType.DATA_EXFILTRATION, RiskLevel.CRITICAL,
                       "Exfiltration domain detected",
                       f"Action payload references blocked domain '{exfil_domain}'.",
                       json.dumps(action_payload)[:300])
        _audit(session, "action_decided", agent_id, action_id,
               f"BLOCKED – exfiltration domain '{exfil_domain}' in payload.")
        session.commit()
        session.refresh(record)
        return record

    # --- Step 5: Check permissions --------------------------------------
    if action_type not in agent_permissions:
        record = ActionRecord(
            action_id=action_id,
            agent_id=agent_id,
            action_type=action_type,
            action_payload=payload_json,
            status=ActionStatus.BLOCKED,
            decision_reason=(
                f"Agent '{agent_id}' does not have permission for action '{action_type}'. "
                f"Permitted actions: {', '.join(agent_permissions)}."
            ),
            risk_level=RiskLevel.HIGH,
            decided_at=now,
        )
        session.add(record)
        _create_threat(session, agent_id, action_id,
                       ThreatType.PERMISSION_VIOLATION, RiskLevel.HIGH,
                       "Unauthorized action attempted",
                       f"Agent attempted '{action_type}' without the required permission.",
                       action_type)
        _audit(session, "action_decided", agent_id, action_id,
               f"BLOCKED – '{agent_id}' lacks permission for '{action_type}'.")
        session.commit()
        session.refresh(record)
        return record

    # --- Step 6: Sensitive actions → approval queue ---------------------
    if action_type in SENSITIVE_ACTIONS:
        record = ActionRecord(
            action_id=action_id,
            agent_id=agent_id,
            action_type=action_type,
            action_payload=payload_json,
            status=ActionStatus.PENDING_APPROVAL,
            decision_reason=(
                f"Action '{action_type}' is sensitive and requires human approval "
                "before execution."
            ),
            risk_level=RiskLevel.MEDIUM,
            requires_approval=True,
            decided_at=now,
        )
        session.add(record)
        approval = ApprovalRequest(
            request_id=_new_uuid(),
            action_id=action_id,
            agent_id=agent_id,
            reason_for_approval=(
                f"Agent '{agent.name}' wants to perform '{action_type}'. "
                "This action is classified as sensitive and requires explicit human approval."
            ),
        )
        session.add(approval)
        _audit(session, "action_decided", agent_id, action_id,
               f"PENDING_APPROVAL – '{action_type}' routed to human review.")
        session.commit()
        session.refresh(record)
        return record

    # --- Step 7: Allow low/medium-risk permitted actions ----------------
    risk = RiskLevel.LOW if action_type not in SENSITIVE_ACTIONS else RiskLevel.MEDIUM
    record = ActionRecord(
        action_id=action_id,
        agent_id=agent_id,
        action_type=action_type,
        action_payload=payload_json,
        status=ActionStatus.ALLOWED,
        decision_reason=f"Action permitted. Agent has the '{action_type}' permission.",
        risk_level=risk,
        decided_at=now,
    )
    session.add(record)
    _audit(session, "action_decided", agent_id, action_id,
           f"ALLOWED – '{agent_id}' performed '{action_type}'.")
    session.commit()
    session.refresh(record)
    return record
