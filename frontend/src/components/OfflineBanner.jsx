import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

export default function OfflineBanner({ isOffline, onRetry, onDismiss }) {
  if (!isOffline) return null;

  return (
    <aside
      id="offline-banner"
      className="bg-gradient-to-r from-red-950/90 via-red-900/80 to-red-950/90 border-b border-red-500/40 text-red-200 px-4 py-2.5 text-xs sm:text-sm font-medium z-40 relative backdrop-blur-md shadow-lg"
      data-api="GET /api/health"
      role="alert"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <span className="font-semibold text-white">Backend Offline:</span>
          <span>
            Cannot reach FastAPI server (<code className="font-mono bg-red-950 px-1.5 py-0.5 rounded text-red-300">http://localhost:8000/api/health</code>). Telemetry operating in client simulation mode.
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            id="btn-reconnect-backend"
            data-api="GET /api/health"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-800/80 hover:bg-red-700 text-white text-xs font-semibold transition border border-red-600/50"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Ping</span>
          </button>
          <button
            id="btn-dismiss-offline-banner"
            onClick={onDismiss}
            className="text-red-300 hover:text-white transition"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
