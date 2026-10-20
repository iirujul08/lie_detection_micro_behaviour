import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      id="toast-container"
      className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 pointer-events-none max-w-md w-full"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        let borderClass = 'border-[#1E2733] bg-[#121821]/95 text-white';
        let Icon = Info;
        let iconColor = 'text-cyan-400';

        if (toast.type === 'success') {
          borderClass = 'border-emerald-500/50 bg-emerald-950/90 text-emerald-100';
          Icon = CheckCircle2;
          iconColor = 'text-emerald-400';
        } else if (toast.type === 'warning') {
          borderClass = 'border-amber-500/50 bg-amber-950/90 text-amber-100';
          Icon = AlertTriangle;
          iconColor = 'text-amber-400';
        } else if (toast.type === 'error') {
          borderClass = 'border-red-500/50 bg-red-950/90 text-red-100';
          Icon = AlertCircle;
          iconColor = 'text-red-400';
        }

        return (
          <div
            key={toast.id}
            className={`p-4 rounded-xl border pointer-events-auto transform transition-all duration-300 shadow-xl backdrop-blur-md flex items-start space-x-3 text-xs sm:text-sm animate-fade-in ${borderClass}`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
            <div className="flex-1 space-y-0.5">
              <div className="font-bold text-white">{toast.title}</div>
              <div className="text-xs opacity-90">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white transition ml-2"
              aria-label="Close toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
