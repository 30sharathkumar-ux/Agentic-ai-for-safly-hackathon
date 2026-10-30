import React, { useState, useEffect } from 'react';
import { api, ACTION_INFO } from '../services/api';
import { ApprovalRequest } from '../types';
import { Badge } from '../components/Badge';
import { RefreshCw, CheckCircle2, XCircle, Clock, Check, X, ShieldAlert } from 'lucide-react';

interface ApprovalsPageProps {
  showToast: (msg: string, type: 'success' | 'warn' | 'error' | 'info') => void;
  onRefreshMetrics?: () => void;
}

export const ApprovalsPage: React.FC<ApprovalsPageProps> = ({ showToast, onRefreshMetrics }) => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'decided'>('pending');
  const [reviewerNotes, setReviewerNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const data = await api.getApprovals();
      setApprovals(data);
    } catch (err) {
      showToast('Failed to load approvals: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleDecision = async (requestId: string, decision: 'approved' | 'rejected') => {
    setProcessingId(requestId);
    const note = reviewerNotes[requestId] || '';
    try {
      await api.decideApproval(requestId, decision, note);
      showToast(
        `Action ${decision}.${
          decision === 'approved'
            ? ' Note: all executed operations are mock DPI actions for demo purposes.'
            : ''
        }`,
        decision === 'approved' ? 'success' : 'warn'
      );
      await loadApprovals();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err) {
      showToast(`Decision failed: ${(err as Error).message}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingList = approvals.filter((a) => a.status === 'pending');
  const decidedList = approvals.filter((a) => a.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="text-2xl font-bold text-[#e8eaf6]">Approval Center</h1>
          <p className="text-xs text-[#8892b0] mt-0.5">
            Sensitive actions gated by policy requiring explicit human verification before execution
          </p>
        </div>
        <button
          onClick={loadApprovals}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#242740] hover:bg-[#2e3250] text-[#e8eaf6] border border-[#2e3250] rounded-lg text-xs font-medium transition-colors cursor-pointer"
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2e3250]">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'border-[#6c63ff] text-[#e8eaf6]'
              : 'border-transparent text-[#8892b0] hover:text-[#e8eaf6]'
          }`}
        >
          <span>Pending Review</span>
          {pendingList.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ffa502] text-black">
              {pendingList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('decided')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'decided'
              ? 'border-[#6c63ff] text-[#e8eaf6]'
              : 'border-transparent text-[#8892b0] hover:text-[#e8eaf6]'
          }`}
        >
          <span>Decided History</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#242740] text-[#8892b0]">
            {decidedList.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'pending' ? (
        <div className="space-y-4">
          {loading && !approvals.length ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl border border-[#2e3250] skeleton-shimmer" />
            ))
          ) : pendingList.length === 0 ? (
            <div className="p-12 text-center text-[#8892b0] bg-[#1a1d2e] border border-[#2e3250] rounded-xl">
              <CheckCircle2 size={32} className="mx-auto mb-2 opacity-40 text-[#2ed573]" />
              <h3 className="text-sm font-semibold text-[#e8eaf6]">Queue Clear</h3>
              <p className="text-xs mt-1">There are no sensitive actions awaiting human approval.</p>
            </div>
          ) : (
            pendingList.map((req) => {
              const info = req.action_type ? ACTION_INFO[req.action_type] : null;

              return (
                <div
                  key={req.request_id}
                  className="bg-[#1a1d2e] border border-[#ffa502]/60 rounded-xl p-5 space-y-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 bg-[#242740] rounded-lg">
                        {info?.icon || '⚠️'}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-[#e8eaf6]">
                          {info?.what || 'Sensitive Action Verification'}
                        </h3>
                        <p className="text-xs text-[#8892b0] font-mono">
                          Agent: <span className="text-[#00d4aa]">{req.agent_id}</span> · Action ID:{' '}
                          <span className="text-[#e8eaf6]">{req.action_id}</span>
                        </p>
                      </div>
                    </div>
                    <Badge value="pending_approval" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-[#242740]/60 rounded-lg border border-[#2e3250]">
                      <span className="text-[10px] uppercase font-bold text-[#8892b0]">
                        Proposed Action Details
                      </span>
                      <p className="text-[#e8eaf6] mt-1 leading-relaxed">
                        {info?.detail || req.reason_for_approval}
                      </p>
                    </div>

                    <div className="p-3 bg-[#2e2000]/60 rounded-lg border border-[#ffa502]/30">
                      <span className="text-[10px] uppercase font-bold text-[#ffa502]">
                        Why Approval is Mandated
                      </span>
                      <p className="text-[#ffa502] mt-1 leading-relaxed">
                        {info?.why ||
                          'Sensitive operations carry elevated risk and require authoritative human verification.'}
                      </p>
                    </div>
                  </div>

                  {/* Reviewer Note Input & Action Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t border-[#2e3250]">
                    <input
                      type="text"
                      placeholder="Optional reviewer note (e.g., 'Verified customer authorization')..."
                      value={reviewerNotes[req.request_id] || ''}
                      onChange={(e) =>
                        setReviewerNotes({
                          ...reviewerNotes,
                          [req.request_id]: e.target.value,
                        })
                      }
                      className="flex-1 px-3 py-1.5 bg-[#242740] border border-[#2e3250] rounded-lg text-xs text-[#e8eaf6] focus:outline-none focus:border-[#6c63ff]"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDecision(req.request_id, 'approved')}
                        disabled={processingId === req.request_id}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1a7a45] hover:bg-[#229957] text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Check size={14} />
                        <span>Approve</span>
                      </button>

                      <button
                        onClick={() => handleDecision(req.request_id, 'rejected')}
                        disabled={processingId === req.request_id}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-[#ff4757] hover:bg-[#e03d4c] text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <X size={14} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Decided History Tab */
        <div className="space-y-3">
          {decidedList.length === 0 ? (
            <div className="p-12 text-center text-[#8892b0] bg-[#1a1d2e] border border-[#2e3250] rounded-xl">
              <Clock size={32} className="mx-auto mb-2 opacity-40" />
              <h3 className="text-sm font-semibold text-[#e8eaf6]">No history yet</h3>
              <p className="text-xs mt-1">Actions decided by human reviewers will be logged here.</p>
            </div>
          ) : (
            decidedList.map((req) => (
              <div
                key={req.request_id}
                className="bg-[#1a1d2e] border border-[#2e3250] p-4 rounded-xl flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[#e8eaf6]">
                      {req.action_type || 'Action'}
                    </span>
                    <Badge value={req.status} />
                  </div>
                  <p className="text-xs text-[#8892b0] font-mono">
                    Agent: <span className="text-[#e8eaf6]">{req.agent_id}</span> · Action ID:{' '}
                    <span>{req.action_id}</span>
                  </p>
                  {req.reviewer_note && (
                    <p className="text-xs text-[#a5b4fc] italic">
                      Reviewer note: "{req.reviewer_note}"
                    </p>
                  )}
                </div>

                <div className="text-right text-[11px] text-[#8892b0]">
                  <span>Decided: </span>
                  <span className="text-[#e8eaf6]">
                    {req.decided_at ? new Date(req.decided_at).toLocaleString() : '—'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

