export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionStatus = 'allowed' | 'blocked' | 'pending_approval' | 'approved' | 'rejected';
export type TrustLevel = 'low' | 'medium' | 'high';

export interface Agent {
  agent_id: string;
  name: string;
  description: string;
  permissions: string[];
  trust_level: TrustLevel;
  is_active: boolean;
  created_at: string;
  action_stats?: {
    total: number;
    allowed: number;
    blocked: number;
    pending_approval: number;
  };
  recent_actions?: ActionRecord[];
}

export interface ActionRecord {
  id?: number;
  action_id: string;
  agent_id: string;
  action_type: string;
  status: ActionStatus;
  risk_level: RiskLevel;
  requires_approval: boolean;
  decision_reason: string;
  payload?: Record<string, unknown> | null;
  document_text?: string | null;
  created_at?: string;
}

export interface ThreatFinding {
  finding_id: string;
  action_id?: string;
  agent_id: string;
  threat_type: string;
  severity: RiskLevel;
  title: string;
  description: string;
  evidence?: string | null;
  is_resolved: boolean;
  created_at: string;
}

export interface ApprovalRequest {
  request_id: string;
  action_id: string;
  agent_id: string;
  reason_for_approval: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_note?: string | null;
  created_at: string;
  decided_at?: string | null;
  action_type?: string;
}

export interface AuditLog {
  log_id: string;
  event_type: string;
  agent_id: string;
  action_id?: string | null;
  details: string;
  metadata?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  created_at: string;
}

export interface Metrics {
  total_actions: number;
  allowed: number;
  blocked: number;
  pending_approval: number;
  approved: number;
  rejected: number;
  block_rate_pct: number;
  total_threats: number;
  critical_threats: number;
  high_threats: number;
  open_approvals: number;
  gemini_enabled?: boolean;
  demo_mode?: boolean;
  demo_note?: string;
}

export interface PentestScenario {
  id: string;
  name: string;
  description: string;
  expected_result: string;
}

export interface PentestResult {
  scenario: PentestScenario;
  actual_status: string;
  decision_reason: string;
  action_id: string;
  pass: boolean;
}

export interface DemoScenarioStep {
  step: string;
  description: string;
  action_id: string;
  status: ActionStatus;
}

export interface DemoScenarioResponse {
  scenario: string;
  steps: DemoScenarioStep[];
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'warn' | 'error' | 'info';
}

