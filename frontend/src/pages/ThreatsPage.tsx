import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ThreatFinding } from '../types';
import { Badge } from '../components/Badge';
import { DetailDrawer } from '../components/DetailDrawer';
import { RefreshCw, Search, CheckCircle, ShieldAlert, FileCode2 } from 'lucide-react';

interface ThreatsPageProps {
  showToast: (msg: string, type: 'success' | 'warn' | 'error' | 'info') => void;
  onRefreshMetrics?: () => void;
}

export const ThreatsPage: React.FC<ThreatsPageProps> = ({ showToast, onRefreshMetrics }) => {
  const [threats, setThreats] = useState<ThreatFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [selectedThreat, setSelectedThreat] = useState<ThreatFinding | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadThreats = async () => {
    setLoading(true);
    try {
      const data = await api.getThreats();
      setThreats(data);
    } catch (err) {
      showToast('Failed to load threats: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreats();
  }, []);

  const handleResolve = async (findingId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.resolveThreat(findingId);
      setThreats((prev) =>
        prev.map((t) => (t.finding_id === findingId ? { ...t, is_resolved: true } : t))
      );
      if (selectedThreat?.finding_id === findingId) {
        setSelectedThreat((prev) => (prev ? { ...prev, is_resolved: true } : null));
      }
      showToast('Threat marked as resolved', 'success');
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err) {
      showToast('Failed to resolve threat: ' + (err as Error).message, 'error');
    }
  };

  // Filter threats
  const filteredThreats = threats.filter((t) => {
    if (severityFilter && t.severity !== severityFilter) return false;
    if (resolvedFilter === 'false' && t.is_resolved) return false;
    if (resolvedFilter === 'true' && !t.is_resolved) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.agent_id.toLowerCase().includes(q) ||
        t.threat_type.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="text-2xl font-bold text-[#e8eaf6]">Threat Detection</h1>
          <p className="text-xs text-[#8892b0] mt-0.5">
            Real-time interception of prompt injections, policy circumventions, and unauthorized exfiltration
          </p>
        </div>
        <button
          onClick={loadThreats}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#242740] hover:bg-[#2e3250] text-[#e8eaf6] border border-[#2e3250] rounded-lg text-xs font-medium transition-colors cursor-pointer"
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#1a1d2e] p-3 rounded-xl border border-[#2e3250]">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-[#8892b0]" />
          <input
            type="text"
            placeholder="Search threats, agents, or indicators…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#242740] border border-[#2e3250] rounded-lg text-xs text-[#e8eaf6] focus:outline-none focus:border-[#6c63ff]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#242740] border border-[#2e3250] rounded-lg text-xs text-[#e8eaf6] focus:outline-none focus:border-[#6c63ff]"
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#242740] border border-[#2e3250] rounded-lg text-xs text-[#e8eaf6] focus:outline-none focus:border-[#6c63ff]"
          >
            <option value="">All statuses</option>
            <option value="false">Open Only</option>
            <option value="true">Resolved Only</option>
          </select>
        </div>
      </div>

      {/* Threats List */}
      <div className="space-y-3">
        {loading && !threats.length ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-[#2e3250] skeleton-shimmer" />
          ))
        ) : filteredThreats.length === 0 ? (
          <div className="p-12 text-center text-[#8892b0] bg-[#1a1d2e] border border-[#2e3250] rounded-xl">
            <ShieldAlert size={32} className="mx-auto mb-2 opacity-40 text-[#2ed573]" />
            <h3 className="text-sm font-semibold text-[#e8eaf6]">No threats found</h3>
            <p className="text-xs mt-1">
              {searchQuery || severityFilter || resolvedFilter
                ? 'Try adjusting your search filters.'
                : 'No suspicious security findings have been recorded.'}
            </p>
          </div>
        ) : (
          filteredThreats.map((t) => {
            const isResolved = t.is_resolved;
            const borderCol =
              t.severity === 'critical'
                ? 'border-l-4 border-l-[#ff4757]'
                : t.severity === 'high'
                ? 'border-l-4 border-l-[#ff8c00]'
                : t.severity === 'medium'
                ? 'border-l-4 border-l-[#ffa502]'
                : 'border-l-4 border-l-[#2ed573]';

            return (
              <div
                key={t.finding_id}
                onClick={() => {
                  setSelectedThreat(t);
                  setDrawerOpen(true);
                }}
                className={`bg-[#1a1d2e] border border-[#2e3250] ${borderCol} p-4 rounded-xl cursor-pointer hover:border-r-[#6c63ff] hover:border-y-[#6c63ff] transition-all space-y-2`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-[#e8eaf6]">{t.title}</h3>
                      {isResolved && (
                        <span className="text-[10px] bg-[#0a2e1a] text-[#2ed573] border border-[#2ed573]/30 px-2 py-0.5 rounded-full font-semibold">
                          ✓ Resolved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge value={t.severity} />
                      <span className="text-[10px] font-mono bg-[#242740] text-[#8892b0] px-2 py-0.5 rounded border border-[#2e3250]">
                        {t.threat_type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isResolved && (
                      <button
                        onClick={(e) => handleResolve(t.finding_id, e)}
                        className="px-2.5 py-1 bg-[#0a2e1a] hover:bg-[#0f4426] text-[#2ed573] border border-[#2ed573]/40 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle size={12} />
                        <span>Resolve</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#8892b0] leading-relaxed">{t.description}</p>

                {t.evidence && (
                  <div className="mt-2 p-2 bg-[#0a0c14] border border-[#2e3250] rounded-lg max-h-24 overflow-y-auto">
                    <pre className="text-[11px] font-mono text-[#a5b4fc] whitespace-pre-wrap break-all">
                      {t.evidence}
                    </pre>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-[#8892b0] pt-1">
                  <span className="font-mono">
                    Agent: <span className="text-[#e8eaf6]">{t.agent_id}</span>
                  </span>
                  <span>{new Date(t.created_at).toLocaleString()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Threat Detail Drawer */}
      <DetailDrawer
        isOpen={drawerOpen}
        title="Security Finding Details"
        onClose={() => setDrawerOpen(false)}
      >
        {selectedThreat && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">Finding Title</span>
              <h3 className="text-sm font-bold text-[#e8eaf6] mt-0.5">{selectedThreat.title}</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-[#242740] rounded-lg border border-[#2e3250]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Severity</span>
                <div className="mt-1">
                  <Badge value={selectedThreat.severity} />
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">Classification</span>
                <p className="font-mono text-[11px] text-[#e8eaf6] mt-1">
                  {selectedThreat.threat_type}
                </p>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">Affected Agent</span>
              <p className="font-mono text-sm text-[#00d4aa] mt-0.5">{selectedThreat.agent_id}</p>
            </div>

            {selectedThreat.action_id && (
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8892b0]">
                  Trigger Action ID
                </span>
                <p className="font-mono text-xs text-[#e8eaf6] mt-0.5">
                  {selectedThreat.action_id}
                </p>
              </div>
            )}

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">Description</span>
              <p className="text-xs text-[#e8eaf6] mt-0.5 leading-relaxed bg-[#242740]/40 p-3 rounded-lg border border-[#2e3250]">
                {selectedThreat.description}
              </p>
            </div>

            {selectedThreat.evidence && (
              <div>
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-[#8892b0] mb-1">
                  <FileCode2 size={12} />
                  <span>Captured Payload / Evidence</span>
                </div>
                <div className="p-3 bg-[#0a0c14] border border-[#2e3250] rounded-lg max-h-48 overflow-y-auto">
                  <pre className="font-mono text-[11px] text-[#e8eaf6] whitespace-pre-wrap break-all">
                    {selectedThreat.evidence}
                  </pre>
                </div>
              </div>
            )}

            <div>
              <span className="text-[10px] uppercase font-bold text-[#8892b0]">Detected At</span>
              <p className="text-xs text-[#8892b0] mt-0.5">
                {new Date(selectedThreat.created_at).toLocaleString()}
              </p>
            </div>

            {!selectedThreat.is_resolved && (
              <div className="pt-2">
                <button
                  onClick={() => handleResolve(selectedThreat.finding_id)}
                  className="w-full py-2.5 bg-[#0a2e1a] hover:bg-[#0f4426] text-[#2ed573] border border-[#2ed573] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  ✓ Mark Finding as Resolved
                </button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};

