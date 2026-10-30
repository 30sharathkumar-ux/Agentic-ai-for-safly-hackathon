import React from 'react';
import {
  LayoutDashboard,
  Bot,
  AlertTriangle,
  CheckSquare,
  FileText,
  Key,
  ShieldCheck,
  FlaskConical,
  Radio,
} from 'lucide-react';

export type PageId =
  | 'overview'
  | 'agents'
  | 'threats'
  | 'approvals'
  | 'audit'
  | 'permissions'
  | 'evaluate'
  | 'pentest';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  openThreatsCount: number;
  pendingApprovalsCount: number;
  isFallback: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  openThreatsCount,
  pendingApprovalsCount,
  isFallback,
  isOpen,
  onClose,
}) => {
  const navItems: Array<{
    id: PageId;
    label: string;
    icon: React.ReactNode;
    section?: string;
    badge?: number;
    badgeColor?: string;
  }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} />, section: 'Monitor' },
    { id: 'agents', label: 'Agents', icon: <Bot size={16} /> },
    {
      id: 'threats',
      label: 'Threats',
      icon: <AlertTriangle size={16} />,
      badge: openThreatsCount,
      badgeColor: 'bg-[#ff4757]',
    },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: <CheckSquare size={16} />,
      badge: pendingApprovalsCount,
      badgeColor: 'bg-[#ffa502] text-black',
    },
    { id: 'audit', label: 'Audit Log', icon: <FileText size={16} /> },
    { id: 'permissions', label: 'Permissions', icon: <Key size={16} />, section: 'Configure' },
    { id: 'evaluate', label: 'Evaluate Action', icon: <ShieldCheck size={16} />, section: 'Tools' },
    { id: 'pentest', label: 'Pentest Lab', icon: <FlaskConical size={16} /> },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 h-screen w-64 bg-[#1a1d2e] border-r border-[#2e3250] flex flex-col z-50 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header / Logo */}
        <div className="p-5 border-b border-[#2e3250]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <div>
              <h1 className="text-lg font-bold text-[#6c63ff] leading-none tracking-tight">
                AgentShield
              </h1>
              <span className="text-[10px] uppercase tracking-wider text-[#8892b0]">
                AI Security Gateway
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 bg-[#2e1a00] border border-[#ffa502] text-[#ffa502] text-[10px] font-bold px-2 py-0.5 rounded">
              ⚠ DEMO MODE
            </span>
            <div
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                isFallback
                  ? 'bg-[#ffa502]/15 text-[#ffa502] border border-[#ffa502]/40'
                  : 'bg-[#2ed573]/15 text-[#2ed573] border border-[#2ed573]/40'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isFallback ? 'bg-[#ffa502] animate-pulse' : 'bg-[#2ed573] shadow-[0_0_8px_#2ed573]'
                }`}
              />
              <span>{isFallback ? 'Offline Fallback' : 'Live Backend'}</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <React.Fragment key={item.id}>
                {item.section && (
                  <div className="text-[10px] font-semibold text-[#8892b0] uppercase tracking-wider px-3 pt-4 pb-1">
                    {item.section}
                  </div>
                )}
                <button
                  onClick={() => {
                    onSelectPage(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#242740] text-white border-l-4 border-[#6c63ff] shadow-sm'
                      : 'text-[#8892b0] hover:text-[#e8eaf6] hover:bg-[#242740]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-[#6c63ff]' : 'text-[#8892b0]'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center ${
                        item.badgeColor || 'bg-[#ff4757] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-[#2e3250] text-xs text-[#8892b0] flex items-center justify-between">
          <span>DPI Guard v1.0</span>
          <span className="flex items-center gap-1 text-[11px] text-[#2ed573]">
            <Radio size={12} className="animate-pulse" /> Active
          </span>
        </div>
      </aside>
    </>
  );
};

