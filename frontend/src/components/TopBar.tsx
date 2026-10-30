import React from 'react';
import { Menu } from 'lucide-react';

interface TopBarProps {
  onToggleSidebar: () => void;
  isFallback: boolean;
  currentPageTitle: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleSidebar,
  isFallback,
  currentPageTitle,
}) => {
  return (
    <header className="sticky top-0 z-30 lg:hidden flex items-center justify-between px-4 py-3 bg-[#1a1d2e] border-b border-[#2e3250]">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-[#242740] text-[#e8eaf6] transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <span className="font-bold text-[#6c63ff] text-base">AgentShield</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8892b0] hidden sm:inline">{currentPageTitle}</span>
        <div
          className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            isFallback
              ? 'bg-[#ffa502]/15 text-[#ffa502] border border-[#ffa502]/40'
              : 'bg-[#2ed573]/15 text-[#2ed573] border border-[#2ed573]/40'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isFallback ? 'bg-[#ffa502]' : 'bg-[#2ed573]'
            }`}
          />
          <span>{isFallback ? 'Offline' : 'Live'}</span>
        </div>
      </div>
    </header>
  );
};

