import React from 'react';
import { X } from 'lucide-react';

interface DetailDrawerProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  isOpen,
  title,
  onClose,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="fixed top-0 right-0 h-screen w-full max-w-md bg-[#1a1d2e] border-l border-[#2e3250] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2e3250]">
          <h2 className="text-base font-bold text-[#e8eaf6]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8892b0] hover:text-[#e8eaf6] hover:bg-[#242740] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {children}
        </div>
      </aside>
    </>
  );
};

