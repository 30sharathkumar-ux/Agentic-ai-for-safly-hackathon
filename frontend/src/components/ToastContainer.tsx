import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 size={18} className="text-[#2ed573] shrink-0" />,
          warn: <AlertTriangle size={18} className="text-[#ffa502] shrink-0" />,
          error: <XCircle size={18} className="text-[#ff4757] shrink-0" />,
          info: <Info size={18} className="text-[#6c63ff] shrink-0" />,
        };

        const borders = {
          success: 'border-[#2ed573]/40 bg-[#0a2e1a] text-[#2ed573]',
          warn: 'border-[#ffa502]/40 bg-[#2e2000] text-[#ffa502]',
          error: 'border-[#ff4757]/40 bg-[#3d0a0a] text-[#ff4757]',
          info: 'border-[#6c63ff]/40 bg-[#0f1835] text-[#a5b4fc]',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3 rounded-lg border shadow-lg transition-all duration-300 ${
              borders[toast.type]
            }`}
          >
            <div className="flex items-start gap-2.5">
              {icons[toast.type]}
              <span className="text-xs text-[#e8eaf6] font-medium leading-tight">
                {toast.message}
              </span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[#8892b0] hover:text-[#e8eaf6] p-0.5 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

