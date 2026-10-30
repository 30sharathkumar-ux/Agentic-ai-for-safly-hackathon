import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Metrics, AuditLog, DemoScenarioStep } from '../types';
import { Badge } from '../components/Badge';
import {
  Play,
  RotateCcw,
  RefreshCw,
  Bot,
  Zap,
  CheckCircle2,
  Ban,
  Clock,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react';

interface OverviewPageProps {
  onNavigate: (page: string) => void;
  showToast: (msg: string, type: 'success' | 'warn' | 'error' | 'info') => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate, showToast }) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [agentsCount, setAgentsCount] = useState<number>(5);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningDemo, setRunningDemo] = useState(false);
  const [demoSteps, setDemoSteps] = useState<DemoScenarioStep[]>([]);
  const [demoDone, setDemoDone] = useState(false);
  const [extraChart, setExtraChart] = useState<{ allowed: number; blocked: number }>({
    allowed: 0,
    blocked: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, agents, logs] = await Promise.all([
        api.getMetrics(),
        api.getAgents(),
        api.getAuditLogs({ limit: 6 }),
      ]);
      setMetrics(m);
      if (Array.isArray(agents)) setAgentsCount(agents.length);
      setRecentLogs(logs || []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load metrics: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunDemo = async () => {
    setRunningDemo(true);
    setDemoSteps([]);
    setDemoDone(false);

    try {
      const res = await api.runDemoScenario();
      // Step by step visual reveal
      for (let i = 0; i < res.steps.length; i++) {
        await new Promise((r) => setTimeout(r, 350));
        setDemoSteps((prev) => [...prev, res.steps[i]]);
      }
      setDemoDone(true);
      showToast('Demo scenario complete!', 'success');
      setExtraChart({ allowed: 2, blocked: 1 });
      await loadData();
    } catch (err) {
      showToast('Demo scenario failed: ' + (err as Error).message, 'error');
    } finally {
      setRunningDemo(false);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all demo data and re-seed default agents?')) return;
    try {
      await api.resetDemo();
      setDemoSteps([]);
      setDemoDone(false);
      setExtraChart({ allowed: 0, blocked: 0 });
      showToast('Demo data reset. Agents re-seeded.', 'success');
      await loadData();
    } catch (err) {
      showToast('Reset failed: ' + (err as Error).message, 'error');
    }
  };

  // Risk computation
  const blockRate = metrics?.block_rate_pct ?? 0;
  const riskLevel =
    blockRate > 40 ? 'CRITICAL' : blockRate > 25 ? 'HIGH' : blockRate > 10 ? 'MEDIUM' : 'LOW';
  const riskBorderColor = {
    CRITICAL: 'border-[#ff4757]',
    HIGH: 'border-[#ff8c00]',
    MEDIUM: 'border-[#ffa502]',
    LOW: 'border-[#2ed573]',
  }[riskLevel];
  const riskTextColor = {
    CRITICAL: 'text-[#ff4757]',
    HIGH: 'text-[#ff8c00]',
    MEDIUM: 'text-[#ffa502]',
    LOW: 'text-[#2ed573]',
  }[riskLevel];

  // SVG Chart data
  const allowedDays = [8, 12, 6, 15, 9, 11, 15 + extraChart.allowed];
  const blockedDays = [2, 3, 4, 2, 5, 3, 6 + extraChart.blocked];
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxDayVal = Math.max(...allowedDays.map((a, i) => a + blockedDays[i])) + 2;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-[#e8eaf6]">Dashboard Overview</h1>
          <p className="text-xs text-[#8892b0] mt-0.5">
            Real-time security metrics and DPI policy enforcement across all agents
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRunDemo}
            disabled={runningDemo}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#6c63ff] hover:bg-[#5b52e0] text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {runningDemo ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Play size={14} className="fill-current" />
            )}
            <span>{runningDemo ? 'Running…' : 'Run Demo Scenario'}</span>
          </button>
          <button
            onClick={handleResetDemo}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#242740] hover:bg-[#2e3250] text-[#e8eaf6] border border-[#2e3250] rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#242740] hover:bg-[#2e3250] text-[#e8eaf6] border border-[#2e3250] rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
        {loading && !metrics ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-[#2e3250] skeleton-shimmer" />
          ))
        ) : (
          <>
            {/* Active Agents */}
            <div className="bg-[#1a1d2e] border border-[#6c63ff]/40 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#6c63ff]">
                <Bot size={20} />
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Agents</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-[#e8eaf6]">{agentsCount}</div>
                <div className="text-[11px] text-[#8892b0]">Registered</div>
              </div>
            </div>

            {/* Total Actions */}
            <div className="bg-[#1a1d2e] border border-[#6c63ff]/40 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#6c63ff]">
                <Zap size={20} />
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Inspected</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-[#e8eaf6]">{metrics?.total_actions ?? 0}</div>
                <div className="text-[11px] text-[#8892b0]">All time</div>
              </div>
            </div>

            {/* Actions Allowed */}
            <div className="bg-[#1a1d2e] border border-[#2ed573]/30 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#2ed573]">
                <CheckCircle2 size={20} />
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Allowed</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-[#2ed573]">{metrics?.allowed ?? 0}</div>
                <div className="text-[11px] text-[#8892b0]">Permitted</div>
              </div>
            </div>

            {/* Threats Blocked */}
            <div className="bg-[#1a1d2e] border border-[#ff4757]/40 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#ff4757]">
                <Ban size={20} />
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Blocked</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-[#ff4757]">{metrics?.blocked ?? 0}</div>
                <div className="text-[11px] text-[#8892b0]">Rate: {metrics?.block_rate_pct ?? 0}%</div>
              </div>
            </div>

            {/* Pending Approvals */}
            <div className="bg-[#1a1d2e] border border-[#ffa502]/40 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#ffa502]">
                <Clock size={20} />
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Pending</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-[#ffa502]">{metrics?.open_approvals ?? 0}</div>
                <div className="text-[11px] text-[#8892b0]">Human review</div>
              </div>
            </div>

            {/* Critical Threats */}
            <div className="bg-[#1a1d2e] border border-[#ff4757]/40 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#ff4757]">
                <AlertOctagon size={20} />
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Critical</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-[#ff4757]">{metrics?.critical_threats ?? 0}</div>
                <div className="text-[11px] text-[#8892b0]">Severity: High</div>
              </div>
            </div>

            {/* System Risk */}
            <div className={`bg-[#1a1d2e] border ${riskBorderColor} p-4 rounded-xl flex flex-col justify-between`}>
              <div className="flex items-center justify-between text-[#8892b0]">
                <ShieldAlert size={20} />
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">System Risk</span>
              </div>
              <div className="mt-2">
                <div className={`text-xl font-bold tracking-tight ${riskTextColor}`}>{riskLevel}</div>
                <div className="text-[11px] text-[#8892b0]">From block rate</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Grid: Chart + Demo Results on Left, Activity Feed on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chart Card */}
          <div className="bg-[#1a1d2e] border border-[#2e3250] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-[#8892b0] uppercase tracking-wider">
                Activity Trends — Last 7 Days
              </h2>
              <div className="flex items-center gap-4 text-xs text-[#8892b0]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#2ed573]" />
                  <span>Allowed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#ff4757]" />
                  <span>Blocked</span>
                </div>
              </div>
            </div>

            {/* Responsive SVG Bar Chart */}
            <div className="w-full h-44">
              <svg viewBox="0 0 500 160" className="w-full h-full overflow-visible">
                {/* Grid horizontal lines */}
                {[0, 5, 10, 15, 20].map((val) => {
                  const y = 140 - (val / maxDayVal) * 110;
                  return (
                    <g key={val}>
                      <line x1="30" y1={y} x2="490" y2={y} stroke="#2e3250" strokeWidth="1" />
                      <text x="25" y={y + 3} textAnchor="end" fontSize="9" fill="#8892b0">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Day bars */}
                {dayLabels.map((day, i) => {
                  const x = 50 + i * 62;
                  const bw = 32;
                  const aVal = allowedDays[i];
                  const bVal = blockedDays[i];
                  const aHeight = (aVal / maxDayVal) * 110;
                  const bHeight = (bVal / maxDayVal) * 110;
                  const baseY = 140;

                  return (
                    <g key={day} className="hover:opacity-90 transition-opacity">
                      {/* Allowed Bar (Bottom) */}
                      <rect
                        x={x}
                        y={baseY - aHeight}
                        width={bw}
                        height={aHeight}
                        fill="#2ed573"
                        rx="2"
                        opacity="0.9"
                      >
                        <title>{`${day} Allowed: ${aVal}`}</title>
                      </rect>
                      {/* Blocked Bar (Stacked on top) */}
                      <rect
                        x={x}
                        y={baseY - aHeight - bHeight}
                        width={bw}
                        height={bHeight}
                        fill="#ff4757"
                        rx="2"
                        opacity="0.9"
                      >
                        <title>{`${day} Blocked: ${bVal}`}</title>
                      </rect>
                      {/* Day Label */}
                      <text x={x + bw / 2} y={154} textAnchor="middle" fontSize="10" fill="#8892b0">
                        {day}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Demo Scenario Results Panel */}
          {demoSteps.length > 0 && (
            <div className="bg-[#1a1d2e] border border-[#6c63ff]/40 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#2e3250]">
                <h2 className="text-sm font-bold text-[#e8eaf6]">Demo Scenario Execution Log</h2>
                <span className="text-xs text-[#6c63ff]">
                  {demoDone ? '✓ Completed' : 'Running steps…'}
                </span>
              </div>

              <div className="space-y-2.5">
                {demoSteps.map((step, idx) => {
                  const isBlocked = step.status === 'blocked';
                  const isPending = step.status === 'pending_approval';

                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-[#242740]/60 border border-[#2e3250] rounded-lg animate-in fade-in duration-200"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isBlocked
                            ? 'bg-[#3d0a0a] text-[#ff4757]'
                            : isPending
                            ? 'bg-[#2e2000] text-[#ffa502]'
                            : 'bg-[#0a2e1a] text-[#2ed573]'
                        }`}
                      >
                        {step.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-semibold text-[#e8eaf6] truncate">
                            {step.description}
                          </h4>
                          <Badge value={step.status} />
                        </div>
                        <p className="text-[11px] text-[#8892b0] font-mono mt-0.5">
                          Action ID: {step.action_id}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {demoDone && (
                <div className="p-3 bg-[#0f1835] border border-[#6c63ff]/40 rounded-lg text-xs text-[#a5b4fc] flex items-center justify-between">
                  <span>
                    Scenario finished. Blocked malicious exfiltration & queued sensitive action for review.
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onNavigate('threats')}
                      className="underline font-semibold hover:text-white cursor-pointer"
                    >
                      View Threats
                    </button>
                    <span>·</span>
                    <button
                      onClick={() => onNavigate('approvals')}
                      className="underline font-semibold hover:text-white cursor-pointer"
                    >
                      View Approvals
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Activity Feed */}
        <div className="bg-[#1a1d2e] border border-[#2e3250] rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2e3250]">
            <h2 className="text-xs font-bold text-[#8892b0] uppercase tracking-wider">
              Recent Security Audit Activity
            </h2>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs text-[#6c63ff] hover:underline"
            >
              Full Log →
            </button>
          </div>

          <div className="flex-1 space-y-3">
            {loading && !recentLogs.length ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg skeleton-shimmer" />
              ))
            ) : recentLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8892b0]">
                No recent activity. Run the demo scenario to generate audit records.
              </div>
            ) : (
              recentLogs.map((log) => {
                const dotColor =
                  log.event_type === 'action_decided'
                    ? 'bg-[#6c63ff]'
                    : log.event_type === 'approval_decision'
                    ? 'bg-[#2ed573]'
                    : log.event_type === 'permission_update'
                    ? 'bg-[#ffa502]'
                    : 'bg-[#8892b0]';

                return (
                  <div
                    key={log.log_id}
                    className="p-2.5 rounded-lg bg-[#242740]/40 border border-[#2e3250]/60 flex items-start gap-2.5"
                  >
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#e8eaf6] font-medium leading-snug line-clamp-2">
                        {log.details}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[#8892b0] mt-1 font-mono">
                        <span>{log.agent_id}</span>
                        <span>·</span>
                        <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

