import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { ToastMessage } from './types';
import { Sidebar, PageId } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DemoBanner } from './components/DemoBanner';
import { ToastContainer } from './components/ToastContainer';

import { OverviewPage } from './pages/OverviewPage';
import { AgentsPage } from './pages/AgentsPage';
import { ThreatsPage } from './pages/ThreatsPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { AuditPage } from './pages/AuditPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { EvaluatePage } from './pages/EvaluatePage';
import { PentestPage } from './pages/PentestPage';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [openThreatsCount, setOpenThreatsCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'warn' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const refreshBadges = async () => {
    try {
      const m = await api.getMetrics();
      setOpenThreatsCount(m.total_threats || 0);
      setPendingApprovalsCount(m.open_approvals || 0);
    } catch {
      // Handled by api service fallback
    }
  };

  useEffect(() => {
    // Initial health check
    api.checkHealth().then((isLive) => {
      if (isLive) {
        showToast('Connected to live AgentShield backend (SQLite DB active)', 'success');
      } else {
        showToast('Backend offline — switched to simulated offline demo data', 'warn');
      }
      refreshBadges();
    });

    // Subscribe to fallback status updates
    const unsubscribe = api.subscribeToFallback((val) => {
      setIsFallback(val);
    });

    return () => unsubscribe();
  }, []);

  const pageTitles: Record<PageId, string> = {
    overview: 'Overview',
    agents: 'Agent Monitor',
    threats: 'Threat Detection',
    approvals: 'Approval Center',
    audit: 'Audit Log',
    permissions: 'Permission Center',
    evaluate: 'Evaluate Action',
    pentest: 'Pentest Lab',
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e8eaf6] flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onSelectPage={(page) => setCurrentPage(page)}
        openThreatsCount={openThreatsCount}
        pendingApprovalsCount={pendingApprovalsCount}
        isFallback={isFallback}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen min-w-0">
        {/* Mobile TopBar */}
        <TopBar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          isFallback={isFallback}
          currentPageTitle={pageTitles[currentPage]}
        />

        {/* Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Global Warnings / Banners */}
          <DemoBanner isFallback={isFallback} />

          {/* Active View */}
          {currentPage === 'overview' && (
            <OverviewPage
              onNavigate={(page) => setCurrentPage(page as PageId)}
              showToast={showToast}
            />
          )}
          {currentPage === 'agents' && <AgentsPage showToast={showToast} />}
          {currentPage === 'threats' && (
            <ThreatsPage showToast={showToast} onRefreshMetrics={refreshBadges} />
          )}
          {currentPage === 'approvals' && (
            <ApprovalsPage showToast={showToast} onRefreshMetrics={refreshBadges} />
          )}
          {currentPage === 'audit' && <AuditPage showToast={showToast} />}
          {currentPage === 'permissions' && (
            <PermissionsPage showToast={showToast} onRefreshMetrics={refreshBadges} />
          )}
          {currentPage === 'evaluate' && (
            <EvaluatePage
              showToast={showToast}
              onNavigate={(page) => setCurrentPage(page as PageId)}
            />
          )}
          {currentPage === 'pentest' && (
            <PentestPage showToast={showToast} onRefreshMetrics={refreshBadges} />
          )}
        </main>
      </div>

      {/* Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
};

