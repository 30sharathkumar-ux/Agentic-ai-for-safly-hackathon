import React from 'react';

interface BadgeProps {
  type?: 'status' | 'risk' | 'trust';
  value: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ value, className = '' }) => {
  const v = value.toLowerCase();

  const styles: Record<string, string> = {
    // Action Statuses
    allowed: 'bg-[#0a2e1a] text-[#2ed573] border border-[#2ed573]/30',
    ok: 'bg-[#0a2e1a] text-[#2ed573] border border-[#2ed573]/30',
    blocked: 'bg-[#3d0a0a] text-[#ff4757] border border-[#ff4757]/30',
    pending_approval: 'bg-[#2e2000] text-[#ffa502] border border-[#ffa502]/30',
    pending: 'bg-[#2e2000] text-[#ffa502] border border-[#ffa502]/30',
    approved: 'bg-[#0a2020] text-[#00d4aa] border border-[#00d4aa]/30',
    rejected: 'bg-[#1e0a1e] text-[#c084fc] border border-[#c084fc]/30',

    // Severities
    critical: 'bg-[#3d0a0a] text-[#ff4757] border border-[#ff4757]/40 font-bold',
    high: 'bg-[#2e1a00] text-[#ff8c00] border border-[#ff8c00]/40 font-semibold',
    medium: 'bg-[#2e2000] text-[#ffa502] border border-[#ffa502]/40',
    low: 'bg-[#0a2e1a] text-[#2ed573] border border-[#2ed573]/40',

    // Trust levels
    'high trust': 'bg-[#0a2e1a] text-[#2ed573] border border-[#2ed573]/30',
    'medium trust': 'bg-[#2e2000] text-[#ffa502] border border-[#ffa502]/30',
    'low trust': 'bg-[#1e1e2e] text-[#8892b0] border border-[#8892b0]/30',

    // Threat state
    resolved: 'bg-[#0a2e1a] text-[#2ed573] border border-[#2ed573]/30',
    open: 'bg-[#3d0a0a] text-[#ff4757] border border-[#ff4757]/30',
  };

  const labelMap: Record<string, string> = {
    pending_approval: 'pending approval',
  };

  const appliedClass = styles[v] || 'bg-[#242740] text-[#e8eaf6] border border-[#2e3250]';
  const label = labelMap[v] || value;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide ${appliedClass} ${className}`}
    >
      {label}
    </span>
  );
};

