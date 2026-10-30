import React, { useState, useEffect } from 'react';
import { api, ALL_PERMISSIONS, SENSITIVE_PERMISSIONS } from '../services/api';
import { Agent } from '../types';
import { Badge } from '../components/Badge';
import { RefreshCw, RotateCcw, ShieldCheck, AlertCircle } from 'lucide-react';

interface PermissionsPageProps {
  showToast: (msg: string, type: 'success' | 'warn' | 'error' | 'info') => void;
  onRefreshMetrics?: () => void;
}

export const PermissionsPage: React.FC<PermissionsPageProps> = ({
  showToast,
  onRefreshMetrics,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await api.getAgents();
      setAgents(data);
    } catch (err) {
      showToast('Failed to load agent permissions: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleToggle = async (agentId: string, perm: string, enabled: boolean) => {
    const agent = agents.find((a) => a.agent_id === agentId);
    if (!agent) return;

    let updatedPerms = [...agent.permissions];
    if (enabled) {
      if (!updatedPerms.includes(perm)) updatedPerms.push(perm);
    } else {
      updatedPerms = updatedPerms.filter((p) => p !== perm);
    }

    // Optimistic UI update
    setAgents((prev) =>
      prev.map((a) => (a.agent_id === agentId ? { ...a, permissions: updatedPerms } : a))
    );

    setUpdatingAgentId(agentId);
    try {
      await api.updateAgentPermissions(agentId, updatedPerms);
      showToast(
        `Permission '${perm}' ${enabled ? 'granted' : 'revoked'} for ${agentId}`,
        'success'
      );
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err) {
      showToast('Failed to update permissions: ' + (err as Error).message, 'error');
      // Revert
      await loadAgents();
    } finally {
      setUpdatingAgentId(null);
    }
  };

  const handleReset = async (agentId: string) => {
    setUpdatingAgentId(agentId);
    try {
      const res = await api.resetAgentPermissions(agentId);
      setAgents((prev) =>
        prev.map((a) => (a.agent_id === agentId ? { ...a, permissions: res.permissions } : a))
      );
      showToast(`Permissions reset to defaults for ${agentId}`, 'info');
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err) {
      showToast('Reset failed: ' + (err as Error).message, 'error');
    } finally {
      setUpdatingAgentId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="text-2xl font-bold text-[#e8eaf6]">Permission Center</h1>
          <p className="text-xs text-[#8892b0] mt-0.5">
            Configure authoritative granular action rights and sensitive capabilities for each registered agent
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

      {/* Agents Permission Cards */}
      <div className="space-y-6">
        {loading && !agents.length ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl border border-[#2e3250] skeleton-shimmer" />
          ))
        ) : (
          agents.map((agent) => (
            <div
              key={agent.agent_id}
              className="bg-[#1a1d2e] border border-[#2e3250] rounded-xl p-5 space-y-4"
            >
              {/* Agent Title & Trust Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#2e3250]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-[#e8eaf6]">{agent.name}</h3>
                    <Badge value={`${agent.trust_level} trust`} />
                  </div>
                  <p className="text-xs font-mono text-[#8892b0] mt-0.5">{agent.agent_id}</p>
                </div>

                <button
                  onClick={() => handleReset(agent.agent_id)}
                  disabled={updatingAgentId === agent.agent_id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#242740] hover:bg-[#2e3250] text-[#8892b0] hover:text-[#e8eaf6] border border-[#2e3250] rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={12} />
                  <span>Reset to Defaults</span>
                </button>
              </div>

              {/* Permission Toggles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {ALL_PERMISSIONS.map((perm) => {
                  const isChecked = agent.permissions.includes(perm);
                  const isSensitive = SENSITIVE_PERMISSIONS.has(perm);

                  return (
                    <div
                      key={perm}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        isChecked
                          ? isSensitive
                            ? 'bg-[#2e2000]/40 border-[#ffa502]/40'
                            : 'bg-[#0a2e1a]/40 border-[#2ed573]/30'
                          : 'bg-[#242740]/40 border-[#2e3250]'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-mono font-medium text-[#e8eaf6] block truncate">
                          {perm}
                        </span>
                        {isSensitive && (
                          <span className="text-[10px] text-[#ffa502] font-semibold flex items-center gap-1 mt-0.5">
                            <AlertCircle size={10} /> Sensitive
                          </span>
                        )}
                      </div>

                      {/* Custom Switch Toggle */}
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleToggle(agent.agent_id, perm, e.target.checked)}
                          disabled={updatingAgentId === agent.agent_id}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-[#2e3250] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#6c63ff]" />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

