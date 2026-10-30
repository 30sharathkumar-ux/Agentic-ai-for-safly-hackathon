"""
Comprehensive verification test for AgentShield backend, permissions, approvals,
audit logs, demo scenario, and frontend static assets.
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')

from starlette.testclient import TestClient
from backend.main import app
from sqlmodel import Session, select
from backend.models import engine, Agent, ActionRecord, ThreatFinding, ApprovalRequest, AuditLog

client = TestClient(app)

print("\n" + "="*60)
print("  AgentShield Full Stack & Flow Verification")
print("="*60 + "\n")

results = []
def check(label, cond, extra=""):
    status = "[PASS]" if cond else "[FAIL]"
    results.append(cond)
    print(f"  {status} {label} {('(' + str(extra) + ')') if extra else ''}")
    return cond

# 1. Health Endpoint
r = client.get("/api/health")
check("GET /api/health", r.status_code == 200, r.json().get("service"))

# 2. Frontend served at root
r = client.get("/")
check("GET / (Frontend index.html served)", r.status_code == 200 and "AgentShield" in r.text, f"{len(r.text)} bytes")

# Check bundle script if Vite app, or inline HTML if legacy
import re
js_text = r.text
js_match = re.search(r'src="(/assets/[^"]+\.js)"', r.text)
if js_match:
    r_js = client.get(js_match.group(1))
    if r_js.status_code == 200:
        js_text = r_js.text

check("Frontend contains /api config", "/api" in js_text)
check("Frontend contains live/offline connection badge", ("Live Backend" in js_text or "conn-status-badge" in js_text))
check("Frontend contains permission update handler", ("permissions" in js_text and "agents" in js_text))

# 3. Overview Metrics
r = client.get("/api/metrics")
m = r.json()
check("GET /api/metrics", r.status_code == 200 and "total_actions" in m, f"total_actions={m.get('total_actions')}")

# 4. Agents List
r = client.get("/api/agents")
agents = r.json()
check("GET /api/agents returns >= 5 agents", len(agents) >= 5, f"{len(agents)} agents")
analytics_agent = next((a for a in agents if a["agent_id"] == "analytics-agent"), None)
check("analytics-agent registered", analytics_agent is not None)

# 5. Permission Center Backend Flow
print("\n--- Testing Permission Center Live Backend Update ---")
# Currently analytics-agent has ['read_financial_data', 'generate_report', 'read_document']
# It does NOT have 'upi_transfer'
r_eval1 = client.post("/api/actions/evaluate", json={
    "agent_id": "analytics-agent",
    "action_type": "upi_transfer",
    "action_payload": {"amount": 500}
})
check("Before grant: upi_transfer is BLOCKED", r_eval1.json()["status"] == "blocked")

# Now update permissions via PUT /api/agents/{agent_id}/permissions to grant upi_transfer
new_perms = ["read_financial_data", "generate_report", "read_document", "upi_transfer"]
r_perm = client.put("/api/agents/analytics-agent/permissions", json={"permissions": new_perms})
check("PUT /api/agents/analytics-agent/permissions succeeds", r_perm.status_code == 200 and r_perm.json()["status"] == "updated")

# Now evaluate again: because it now has upi_transfer (sensitive action), it should be routed to PENDING_APPROVAL!
r_eval2 = client.post("/api/actions/evaluate", json={
    "agent_id": "analytics-agent",
    "action_type": "upi_transfer",
    "action_payload": {"amount": 500, "to_vpa": "partner@upi"}
})
check("After grant: upi_transfer is PENDING_APPROVAL (sensitive)", r_eval2.json()["status"] == "pending_approval")

# Check Audit Log recorded the permission update
r_audit_perm = client.get("/api/audit?event_type=permission_update")
check("Audit log recorded permission_update event", len(r_audit_perm.json()) >= 1, f"{len(r_audit_perm.json())} entries")

# Reset permissions back to default via reset endpoint
r_reset_perm = client.post("/api/agents/analytics-agent/reset-permissions")
check("POST /api/agents/analytics-agent/reset-permissions succeeds", r_reset_perm.status_code == 200)

# Verify permissions are reset
r_eval3 = client.post("/api/actions/evaluate", json={
    "agent_id": "analytics-agent",
    "action_type": "upi_transfer",
    "action_payload": {"amount": 500}
})
check("After reset: upi_transfer is BLOCKED again", r_eval3.json()["status"] == "blocked")

# 6. Main Demo Scenario Flow
print("\n--- Testing Main Demo Scenario Live Backend Flow ---")
# Reset demo data first
client.post("/api/demo/reset")
r_demo = client.post("/api/demo/run")
demo_data = r_demo.json()
check("POST /api/demo/run returns 5 steps", len(demo_data.get("steps", [])) == 5)
steps_map = {s["step"]: s["status"] for s in demo_data.get("steps", [])}
check("Step A (safe read) ALLOWED", steps_map.get("A") == "allowed")
check("Step B (safe summarise) ALLOWED", steps_map.get("B") == "allowed")
check("Step C (malicious injection doc) BLOCKED", steps_map.get("C") == "blocked")
check("Step D (UPI transfer) PENDING_APPROVAL", steps_map.get("D") == "pending_approval")
check("Step E (unpermitted email) BLOCKED", steps_map.get("E") == "blocked")

# Verify Threat Finding created by Step C
r_threats = client.get("/api/threats?resolved=false")
threats = r_threats.json()
check("Threats list contains prompt_injection from Step C", any(t["threat_type"] == "prompt_injection" for t in threats))

# 7. Approval Center Flow
print("\n--- Testing Approval Center Live Backend Flow ---")
r_appr = client.get("/api/approvals?status=pending")
pending = r_appr.json()
check("GET /api/approvals returns pending approval from Step D", len(pending) >= 1)

if pending:
    target_req = pending[0]
    req_id = target_req["request_id"]
    action_id = target_req["action_id"]

    # Decide approval
    r_decide = client.post(f"/api/approvals/{req_id}/decide", json={
        "decision": "approved",
        "reviewer_note": "Verified vendor invoice for demo",
        "reviewer": "chief-security-officer"
    })
    check("POST /api/approvals/{id}/decide succeeds", r_decide.status_code == 200 and r_decide.json()["status"] == "approved")

    # Verify linked action record status in DB changed to APPROVED
    r_act = client.get(f"/api/actions/{action_id}")
    check("Linked ActionRecord updated to APPROVED in DB", r_act.status_code == 200 and r_act.json()["status"] == "approved")

    # Verify approval decision appears in audit log
    r_audit_appr = client.get("/api/audit?event_type=approval_decision")
    check("Audit log contains approval_decision entry", len(r_audit_appr.json()) >= 1)

# 8. Audit Log Search and Export
print("\n--- Testing Audit Log Search and Export ---")
r_audit_all = client.get("/api/audit")
check("GET /api/audit returns audit records", len(r_audit_all.json()) >= 5, f"{len(r_audit_all.json())} entries")

r_audit_q = client.get("/api/audit?q=BLOCKED")
check("GET /api/audit with free-text filter ?q=BLOCKED works", len(r_audit_q.json()) >= 1)

r_csv = client.get("/api/audit/export")
check("GET /api/audit/export returns CSV content", r_csv.status_code == 200 and "log_id,event_type" in r_csv.text)

r_json = client.get("/api/audit/export/json")
check("GET /api/audit/export/json returns valid JSON array", r_json.status_code == 200 and isinstance(r_json.json(), list))

# 9. Pentest Scenarios
print("\n--- Testing Pentest Scenarios Execution ---")
r_pt_list = client.get("/api/pentest/scenarios")
check("GET /api/pentest/scenarios returns 6 scenarios", len(r_pt_list.json()) == 6)

all_pt_pass = True
for sid in ["pt-01", "pt-02", "pt-03", "pt-04", "pt-05", "pt-06"]:
    r_pt = client.post(f"/api/pentest/run/{sid}")
    res = r_pt.json()
    all_pt_pass &= res.get("pass", False)
check("All 6 Pentest scenarios PASS against backend policy engine", all_pt_pass)

# Summary
total = len(results)
passed = sum(1 for r in results if r)
failed = total - passed
print("\n" + "="*60)
print(f"  VERIFICATION RESULT: {passed}/{total} CHECKS PASSED ({failed} failed)")
print("="*60 + "\n")

sys.exit(0 if failed == 0 else 1)

