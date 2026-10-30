import React from 'react';
import { AlertCircle, Radio } from 'lucide-react';

interface DemoBannerProps {
  isFallback: boolean;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ isFallback }) => {
  return (
    <div className="space-y-2 mb-6">
      {/* DPI Simulation Notice */}
      <div className="flex items-center gap-2.5 bg-[#1e1500] border border-[#ffa502] text-[#ffa502] px-3.5 py-2.5 rounded-lg text-xs leading-relaxed">
        <AlertCircle size={16} className="shrink-0 text-[#ffa502]" />
        <span>
          <strong>DEMO ENVIRONMENT</strong> — All Aadhaar, DigiLocker, UPI, ONDC, and email
          integrations are fully simulated. No real financial or personal data is processed or transmitted.
        </span>
      </div>

      {/* Backend Offline Notice */}
      {isFallback && (
        <div className="flex items-center gap-2.5 bg-[#2a1300] border border-[#ff8c00] text-[#ff8c00] px-3.5 py-2.5 rounded-lg text-xs leading-relaxed animate-fade-in">
          <Radio size={16} className="shrink-0 text-[#ff8c00] animate-pulse" />
          <span>
            <strong>Backend offline</strong> — Currently displaying embedded demo data. Start the backend with{' '}
            <code className="bg-[#1a1d2e] px-1.5 py-0.5 rounded text-[#e8eaf6] font-mono">
              python serve.py
            </code>{' '}
            for live interactive database persistence.
          </span>
        </div>
      )}
    </div>
  );
};

