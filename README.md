# AgentShield 🛡️

**AgentShield** is a hackathon prototype for safer AI agents interacting with India's Digital Public Infrastructure (DPI).

> ⚠️ **DEMO ONLY** — All Aadhaar, DigiLocker, UPI, ONDC, and email integrations are fully **simulated**. No real external services are contacted. Simulated data is clearly labelled `[DEMO]`.

---

## What It Does

AgentShield acts as a **security gateway** that intercepts proposed AI-agent actions before they execute:

| Capability | Details |
|---|---|
| **Permission enforcement** | Each agent has an explicit permission list; unlisted actions are blocked |
| **Prompt injection detection** | Document text is treated as untrusted; embedded instructions cannot grant new permissions |
| **Exfiltration blocking** | Known bad domains in action payloads trigger an immediate block |
| **Sensitive action approval** | UPI transfers, Aadhaar lookups, DigiLocker shares → human approval queue |
| **Threat findings** | Every anomaly creates a labelled security finding with evidence |
| **Audit log** | Immutable record of every decision with reason, timestamp, agent, and action |
| **Demo scenario** | Repeatable script showing an injection attack blocked + safe summary allowed + UPI sent for approval |
| **Safe Pentest Lab** | Local, non-destructive tests of the policy engine |

---

## Project Structure

```
agentshield/
├── backend/
│   ├── __init__.py
│   ├── models.py          # SQLModel + SQLite schema
│   ├── policy.py          # Authoritative security decision engine
│   ├── demo.py            # Seed data, demo scenario, pentest runners
│   └── main.py            # FastAPI application + all API endpoints + static mount
├── frontend/              # Modern React + Vite + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/    # Reusable UI (Sidebar, TopBar, DemoBanner, DetailDrawer, Badge, Toast)
│   │   ├── pages/         # Overview, Agents, Threats, Approvals, Audit, Permissions, Evaluate, Pentest
│   │   ├── services/      # Authoritative API service layer with resilient offline fallback
│   │   ├── types/         # TypeScript interfaces and domain models
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css      # Tailwind styles and custom dark-theme variables
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts     # Configured with proxy to http://127.0.0.1:8000
│   └── index.html
├── serve.py               # Serves FastAPI API + built React frontend on port 8000
├── package.json           # Root scripts for npm run dev / npm run build
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

---

## Quick Start & Workflows

### 1. Install Dependencies

**Backend:**
```bash
pip install -r requirements.txt
```

**Frontend:**
```bash
npm install --prefix frontend
# or: npm run install:frontend
```

### 2. (Optional) Enable Gemini

Only needed for AI-assisted document summarisation. The application works completely without it using deterministic local policy rules.

```bash
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=<your-key>
```

---

### Workflow A: Production / Built App (Single Port 8000)

Build the React frontend into static assets and serve everything together through FastAPI:

```bash
# 1. Build the frontend into frontend/dist
npm run build

# 2. Start the unified server
python serve.py
```

Open **http://localhost:8000** in your browser. FastAPI automatically serves the built React app at `/` and the security API endpoints at `/api/*`.

---

### Workflow B: Development Mode (Vite HMR + Proxy)

Run the backend and Vite dev server concurrently with Hot Module Replacement and proxying:

```bash
# Terminal 1: Start the FastAPI backend
python serve.py
# (or: uvicorn backend.main:app --reload --port 8000)

# Terminal 2: Start Vite development server
npm run dev
```

Open **http://localhost:5173** in your browser. Vite proxies all `/api/*` calls directly to `http://127.0.0.1:8000`.

Interactive API documentation remains accessible at: **http://localhost:8000/docs**

---

## Live Demo Flow

1. Open **Demo Scenario** tab and click **▶ Run Demo Scenario**.
2. Watch the 5 steps: two safe reads allowed, one injection attack blocked, one UPI transfer sent to approval, one unpermitted email blocked.
3. Go to **Threat Findings** to see the injection evidence.
4. Go to **Approval Queue** and approve or reject the UPI transfer.
5. Check the **Audit Log** for the complete decision trail.
6. Use **Evaluate Action** to test custom agent actions interactively.
7. Use **Pentest Lab** to run each security scenario individually.

---

## API Reference

Base URL: `http://localhost:8000/api`

Full interactive docs at `/docs`.

### Overview

| Method | Path | Description |
|---|---|---|
| `GET` | `/metrics` | Dashboard metrics (totals, block rate, threats) |
| `GET` | `/health` | Service health check |

### Agents & Permissions

| Method | Path | Description |
|---|---|---|
| `GET` | `/agents` | List all registered agents with permissions |
| `GET` | `/agents/{agent_id}` | Agent details + action statistics & recent history |
| `PUT` | `/agents/{agent_id}/permissions` | Update agent permissions (persists to DB & audits) |
| `POST` | `/agents/{agent_id}/reset-permissions` | Reset agent permissions to default seed profile |

### Actions

| Method | Path | Description |
|---|---|---|
| `POST` | `/actions/evaluate` | **Core gate** – evaluate a proposed action |
| `GET` | `/actions` | List actions (filter by `agent_id`, `status`) |
| `GET` | `/actions/{action_id}` | Single action record |

**Evaluate request body:**
```json
{
  "agent_id": "fin-report-agent",
  "action_type": "read_document",
  "action_payload": { "document_id": "DOC-001" },
  "document_text": "Optional document content scanned for injection"
}
```

**Response:** `ActionRecord` with `status` = `allowed` | `blocked` | `pending_approval`.

### Threats

| Method | Path | Description |
|---|---|---|
| `GET` | `/threats` | List findings (filter by `severity`, `resolved`) |
| `PATCH` | `/threats/{finding_id}/resolve` | Mark a finding resolved |

### Approvals

| Method | Path | Description |
|---|---|---|
| `GET` | `/approvals` | List approval requests (filter by `status`) |
| `POST` | `/approvals/{request_id}/decide` | Approve or reject |

**Decision body:**
```json
{ "decision": "approved", "reviewer_note": "Verified vendor", "reviewer": "alice" }
```

### Audit Log

| Method | Path | Description |
|---|---|---|
| `GET` | `/audit` | Search log (query params: `q`, `event_type`, `agent_id`) |
| `GET` | `/audit/export` | Download as CSV |
| `GET` | `/audit/export/json` | Download as JSON |

### Demo

| Method | Path | Description |
|---|---|---|
| `POST` | `/demo/run` | Run the main demo scenario |
| `POST` | `/demo/reset` | Reset all data and re-seed agents |

### Pentest Lab

| Method | Path | Description |
|---|---|---|
| `GET` | `/pentest/scenarios` | List available scenarios |
| `POST` | `/pentest/run/{scenario_id}` | Run a scenario (pt-01 … pt-06) |
| `POST` | `/pentest/reset` | Clear pentest audit entries |

---

## Security Decision Rules (Policy Engine)

The policy engine in `backend/policy.py` applies these rules in order:

1. **Agent existence** – unknown or inactive agents are always blocked.
2. **Always-blocked actions** – `delete_all_records`, `grant_permissions`, `modify_policy`, `access_raw_passwords` are unconditionally refused, regardless of permissions.
3. **Prompt injection scan** – document text is scanned for 10+ injection patterns; a match blocks the action and creates a critical threat finding.
4. **Exfiltration domain scan** – action payloads containing known bad domains are blocked.
5. **Permission check** – action type must appear in the agent's explicit permission list.
6. **Sensitive-action approval** – permitted sensitive actions (`upi_transfer`, `aadhaar_lookup`, `digilocker_share`, `send_email_external`, `bulk_data_export`, `ondc_order_place`) are routed to the human approval queue, never executed automatically.
7. **Allow** – low-risk permitted actions are allowed and logged.

> An AI/LLM may assist with content summarisation but **never** makes the allow/block decision and **never** overrides policy.

---

## Simulated Integrations

All integrations below are **mock-only** and clearly labelled in the UI:

| DPI Service | Simulation |
|---|---|
| **Aadhaar** | Mock lookup payloads; `aadhaar_lookup` action type triggers approval flow |
| **DigiLocker** | Mock document share; routed to approval |
| **UPI** | Fake VPAs and amounts; `upi_transfer` routed to approval |
| **ONDC** | Mock order placement; `ondc_order_place` routed to approval |
| **Email** | No email is ever sent; `send_email_external` is blocked without permission |

---

## Limitations (Hackathon Scope)

- **No authentication** – any caller can hit the API. Add OAuth/JWT before any real deployment.
- **SQLite** – fine for demos; replace with PostgreSQL for production.
- **No real AI** – Gemini key is optional and only toggles a summarisation hint; all security decisions are deterministic code.
- **No persistent approval workflow** – approvals live in the local DB session only.
- **Single-process** – no queue or background workers; all evaluation is synchronous.

