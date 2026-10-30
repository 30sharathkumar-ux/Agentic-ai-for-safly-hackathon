import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Agent } from '../types';
import { Badge } from '../components/Badge';
import { DetailDrawer } from '../components/DetailDrawer';
import { RefreshCw, Bot, Shield, Activity } from 'lucide-react';

interface AgentsPageProps {
  showToast: (msg: string, type: 'success' | 'warn' | 'error' | 'info') => void;
}

export const AgentsPage: React.FC<AgentsPageProps> = ({ showToast }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agentDetailLoading, setAgentDetailLoading] = useState(false);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await api.getAgents();
      setAgents(data);
    } catch (err) {
      showToast('Failed to load agents: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleOpenDetail = async (agent: Agent) => {
    setSelectedAgent(agent);
    setDrawerOpen(true);
    setAgentDetailLoading(true);
    try {
      const detail = await api.getAgent(agent.agent_id);
      if (detail) setSelectedAgent(detail);
    } catch (err) {
      console.warn('Could not load detailed stats for agent:', err);
    } finally {
      setAgentDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="text-2xl font-bold text-[#e8eaf6]">Agent Monitor</h1>
          <p className="text-xs text-[#8892b0] mt-0.5">
            Registered agents, current privileges, trust tier, and historical enforcement records
          </p>
        </div>
        <button
          onClick={loadAgents}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#242740] hover:bg-[#2e3250] text-[#e8eaf6] border border-[#2e3250] rounded-lg text-xs font-medium transition-colors cursor-pointer"
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && !agents.length ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl border border-[#2e3250] skeleton-shimmer" />
          ))
        ) : agents.length === 0 ? (
          <div className="col-span-full p-12 text-center text-[#8892b0] bg-[#1a1d2e] border border-[#2e3250] rounded-xl">
            <Bot size={32} className="mx-auto mb-2 opacity-40" />
            <h3 className="text-sm font-semibold text-[#e8eaf6]">No agents found</h3>
            <p className="text-xs mt-1">There are currently no active agents registered in the database.</p>
          </div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.agent_id}
              onClick={() => handleOpenDetail(agent)}
              className="bg-[#1a1d2e] border border-[#2e3250] hover:border-[#6c63ff] p-5 rounded-xl cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#e8eaf6] group-hover:text-[#6c63ff] transition-colors">
                      {agent.name}
                    </h3>
                    <span className="text-xs font-mono text-[#8892b0]">{agent.agent_id}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        agent.is_active
                          ? 'bg-[#0a2e1a] text-[#2ed573] border border-[#2ed573]/30'
                          : 'bg-[#3d0a0a] text-[#ff4757] border border-[#ff4757]/30'
                      }`}
                    >
                      {agent.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <Badge value={`${agent.trust_level} trust`} />
                  </div>
                </div>

                <p className="text-xs text-[#8892b0] mt-3 line-clamp-2 leading-relaxed">
                  {agent.description}
                </p>

                {/* Permissions pills */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {agent.permissions.slice(0, 4).map((p) => (
                    <span
                      key={p}
                      className="text-[10px] bg-[#242740] text-[#e8eaf6] px-2 py-0.5 rounded border border-[#2e3250]"
                    >
                      {p}
                    </span>
                  ))}
                  {agent.permissions.length > 4 && (
                    <span className="text-[10px] text-[#8892b0] px-1 py-0.5">
                      +{agent.permissions.length - 4} more
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#2e3250]/80 flex items-center justify-between text-[11px] text-[#8892b0]">
                <span>Click to inspect actions</span>
                <span className="text-[#6c63ff] group-hover:translate-x-0.5 transition-transform">
                  View →
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Agent Detail Drawer */}
      <DetailDrawer
        isOpen={drawerOpen}
        title={selectedAgent?.name || 'Agent Details'}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedAgent && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">Agent ID</span>
              <p className="font-mono text-sm text-[#e8eaf6] mt-0.5">{selectedAgent.agent_id}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">Description</span>
              <p className="text-xs text-[#e8eaf6] mt-0.5 leading-relaxed">
                {selectedAgent.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-[#242740] rounded-lg border border-[#2e3250]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Trust Tier</span>
                <div className="mt-1">
                  <Badge value={`${selectedAgent.trust_level} trust`} />
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Status</span>
                <div className="mt-1">
                  <Badge value={selectedAgent.is_active ? 'allowed' : 'blocked'} />
                </div>
              </div>
            </div>

            {/* Permission List */}
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">
                Authorized Permissions ({selectedAgent.permissions.length})
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selectedAgent.permissions.map((p) => (
                  <span
                    key={p}
                    className="text-[11px] font-mono bg-[#0f1117] text-[#00d4aa] px-2 py-1 rounded border border-[#2e3250]"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats Breakdown Bar */}
            {selectedAgent.action_stats && (
              <div className="p-3 bg-[#242740] rounded-lg border border-[#2e3250] space-y-2">
                <div className="flex justify-between items-center text-[11px] font-semibold">
                  <span className="text-[#8892b0]">Security Decisions Ratio</span>
                  <span className="text-[#e8eaf6]">{selectedAgent.action_stats.total} total</span>
                </div>
                <div className="h-2 w-full bg-[#0f1117] rounded-full overflow-hidden flex gap-0.5">
                  <div
                    style={{
                      width: `${(selectedAgent.action_stats.allowed / (selectedAgent.action_stats.total || 1)) * 100}%`,
                    }}
                    className="bg-[#2ed573] h-full"
                    title="Allowed"
                  />
                  <div
                    style={{
                      width: `${(selectedAgent.action_stats.blocked / (selectedAgent.action_stats.total || 1)) * 100}%`,
                    }}
                    className="bg-[#ff4757] h-full"
                    title="Blocked"
                  />
                  <div
                    style={{
                      width: `${(selectedAgent.action_stats.pending_approval / (selectedAgent.action_stats.total || 1)) * 100}%`,
                    }}
                    className="bg-[#ffa502] h-full"
                    title="Pending"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#8892b0]">
                  <span className="text-[#2ed573]">
                    {selectedAgent.action_stats.allowed} allowed
                  </span>
                  <span className="text-[#ff4757]">
                    {selectedAgent.action_stats.blocked} blocked
                  </span>
                  <span className="text-[#ffa502]">
                    {selectedAgent.action_stats.pending_approval} pending
                  </span>
                </div>
              </div>
            )}

            {/* Recent Actions */}
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">
                Recent Agent Actions
              </span>
              <div className="mt-2 border border-[#2e3250] rounded-lg overflow-hidden bg-[#0f1117]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#242740] text-[#8892b0] border-b border-[#2e3250]">
                    <tr>
                      <th className="p-2 font-medium">Type</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e3250]">
                    {agentDetailLoading ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-[#8892b0]">
                          Loading records…
                        </td>
                      </tr>
                    ) : selectedAgent.recent_actions && selectedAgent.recent_actions.length > 0 ? (
                      selectedAgent.recent_actions.map((act) => (
                        <tr key={act.action_id} className="hover:bg-[#1a1d2e]">
                          <td className="p-2 font-mono text-[11px] text-[#e8eaf6]">
                            {act.action_type}
                          </td>
                          <td className="p-2">
                            <Badge value={act.status} />
                          </td>
                          <td className="p-2 text-[10px] text-[#8892b0]">
                            {act.created_at ? new Date(act.created_at).toLocaleTimeString() : '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-[#8892b0]">
                          No logged actions for this agent yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};

