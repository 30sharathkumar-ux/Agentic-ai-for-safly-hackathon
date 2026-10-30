import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AuditLog, Agent } from '../types';
import { DetailDrawer } from '../components/DetailDrawer';
import { Search, Download, RefreshCw, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditPageProps {
  showToast: (msg: string, type: 'success' | 'warn' | 'error' | 'info') => void;
}

export const AuditPage: React.FC<AuditPageProps> = ({ showToast }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog[] | AuditLog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, agentsData] = await Promise.all([
        api.getAuditLogs({
          query: searchQuery,
          eventType: eventTypeFilter,
          agentId: agentFilter,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }),
        api.getAgents(),
      ]);
      setLogs(logsData);
      setAgents(agentsData);
    } catch (err) {
      showToast('Failed to load audit logs: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, eventTypeFilter, agentFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleExportJSON = async () => {
    try {
      const all = await api.getAuditLogs({ limit: 500 });
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'agentshield-audit.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Audit log exported as JSON', 'success');
    } catch (err) {
      showToast('Export failed: ' + (err as Error).message, 'error');
    }
  };

  const currentLog = selectedLog as AuditLog | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-[#e8eaf6]">Audit Log</h1>
          <p className="text-xs text-[#8892b0] mt-0.5">
            Cryptographically structured, searchable log of every policy check, approval decision, and threat
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={api.getUsingFallback() ? '#' : '/api/audit/export'}
            onClick={(e) => {
              if (api.getUsingFallback()) {
                e.preventDefault();
                showToast('CSV export from backend unavailable in offline mode. Use JSON export.', 'warn');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#242740] hover:bg-[#2e3250] text-[#e8eaf6] border border-[#2e3250] rounded-lg text-xs font-medium transition-colors"
          >
            <Download size={14} />
            <span>CSV Export</span>
          </a>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#242740] hover:bg-[#2e3250] text-[#e8eaf6] border border-[#2e3250] rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Download size={14} />
            <span>JSON Export</span>
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#242740] hover:bg-[#2e3250] text-[#e8eaf6] border border-[#2e3250] rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#1a1d2e] p-3 rounded-xl border border-[#2e3250]">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-[#8892b0]" />
          <input
            type="text"
            placeholder="Search details, agent ID, or action ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#242740] border border-[#2e3250] rounded-lg text-xs text-[#e8eaf6] focus:outline-none focus:border-[#6c63ff]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-1.5 bg-[#242740] border border-[#2e3250] rounded-lg text-xs text-[#e8eaf6] focus:outline-none focus:border-[#6c63ff]"
          >
            <option value="">All Event Types</option>
            <option value="action_decided">action_decided</option>
            <option value="approval_decision">approval_decision</option>
            <option value="permission_update">permission_update</option>
            <option value="demo_reset">demo_reset</option>
            <option value="pentest_run">pentest_run</option>
          </select>

          <select
            value={agentFilter}
            onChange={(e) => {
              setAgentFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-1.5 bg-[#242740] border border-[#2e3250] rounded-lg text-xs text-[#e8eaf6] focus:outline-none focus:border-[#6c63ff]"
          >
            <option value="">All Agents</option>
            {agents.map((a) => (
              <option key={a.agent_id} value={a.agent_id}>
                {a.name} ({a.agent_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#1a1d2e] border border-[#2e3250] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#242740] text-[#8892b0] border-b border-[#2e3250] uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 font-semibold">Timestamp</th>
                <th className="p-3 font-semibold">Event Type</th>
                <th className="p-3 font-semibold">Agent</th>
                <th className="p-3 font-semibold">Action ID</th>
                <th className="p-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e3250]">
              {loading && !logs.length ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="p-4">
                      <div className="h-4 rounded skeleton-shimmer" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#8892b0]">
                    <FileText size={28} className="mx-auto mb-2 opacity-40" />
                    <p>No audit log entries match your criteria.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const eventBadgeColor =
                    log.event_type === 'action_decided'
                      ? 'text-[#6c63ff] bg-[#6c63ff]/10'
                      : log.event_type === 'approval_decision'
                      ? 'text-[#2ed573] bg-[#2ed573]/10'
                      : log.event_type === 'permission_update'
                      ? 'text-[#ffa502] bg-[#ffa502]/10'
                      : 'text-[#8892b0] bg-[#242740]';

                  return (
                    <tr
                      key={log.log_id}
                      onClick={() => {
                        setSelectedLog(log);
                        setDrawerOpen(true);
                      }}
                      className="hover:bg-[#242740]/60 cursor-pointer transition-colors"
                    >
                      <td className="p-3 whitespace-nowrap text-[#8892b0] font-mono text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${eventBadgeColor}`}
                        >
                          {log.event_type}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono text-[#00d4aa]">
                        {log.agent_id}
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono text-[#8892b0]">
                        {log.action_id || '—'}
                      </td>
                      <td className="p-3 text-[#e8eaf6] max-w-md truncate">{log.details}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-[#242740]/60 border-t border-[#2e3250] flex items-center justify-between text-xs text-[#8892b0]">
          <span>
            Page {page + 1} · Showing {logs.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded bg-[#242740] hover:bg-[#2e3250] text-[#e8eaf6] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < PAGE_SIZE}
              className="p-1 rounded bg-[#242740] hover:bg-[#2e3250] text-[#e8eaf6] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={drawerOpen}
        title="Audit Log Entry Details"
        onClose={() => setDrawerOpen(false)}
      >
        {currentLog && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">Log ID</span>
              <p className="font-mono text-sm text-[#e8eaf6] mt-0.5">{currentLog.log_id}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-[#242740] rounded-lg border border-[#2e3250]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Event Type</span>
                <p className="font-mono text-xs font-semibold text-[#6c63ff] mt-1">
                  {currentLog.event_type}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Agent</span>
                <p className="font-mono text-xs text-[#00d4aa] mt-1">{currentLog.agent_id}</p>
              </div>
            </div>

            {currentLog.action_id && (
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Action ID</span>
                <p className="font-mono text-xs text-[#e8eaf6] mt-0.5">{currentLog.action_id}</p>
              </div>
            )}

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">Details</span>
              <p className="p-3 bg-[#242740]/60 rounded-lg border border-[#2e3250] text-[#e8eaf6] mt-0.5 leading-relaxed">
                {currentLog.details}
              </p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">
                Raw Metadata Payload
              </span>
              <div className="mt-1 p-3 bg-[#0a0c14] border border-[#2e3250] rounded-lg max-h-56 overflow-y-auto">
                <pre className="font-mono text-[11px] text-[#a5b4fc] whitespace-pre-wrap">
                  {JSON.stringify(currentLog.metadata || currentLog.extra || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">Recorded Time</span>
              <p className="text-xs text-[#8892b0] mt-0.5">
                {new Date(currentLog.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};

