import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-[#1E2733] bg-[#080B0F] py-6 z-10 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 font-mono">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span className="text-slate-300 font-semibold">TruthLens AI</span>
          <span>&bull;</span>
          <span>Facial Micro-Expression Biometric Analytics</span>
        </div>
        <div className="flex items-center space-x-4 font-mono text-[11px]">
          <span>FastAPI REST &amp; WebSocket (Port 8000)</span>
          <span>&bull;</span>
          <span className="text-cyan-400">React + Vite + Recharts (Port 5173)</span>
        </div>
      </div>
    </footer>
  );
}
