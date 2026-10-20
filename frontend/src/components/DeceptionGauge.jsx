import React from 'react';

export default function DeceptionGauge({ score = 18, label = "Truthful" }) {
  // Arc length is 251.2 for radius 80
  const maxDash = 251.2;
  const progressOffset = maxDash - (maxDash * (Math.min(100, Math.max(0, score)) / 100));
  // Needle angle: -90deg is 0%, 90deg is 100%
  const needleAngle = -90 + (score * 1.8);

  let labelClass = 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400';
  let scoreClass = 'text-emerald-400';

  if (score >= 70 || label === 'Likely Deceptive') {
    labelClass = 'bg-red-950/80 border-red-500/50 text-red-400 animate-pulse';
    scoreClass = 'text-red-400';
  } else if (score >= 40 || label === 'Suspicious') {
    labelClass = 'bg-amber-950/80 border-amber-500/50 text-amber-400';
    scoreClass = 'text-amber-400';
  }

  return (
    <div className="glass-panel rounded-2xl p-5 border border-[#1E2733] space-y-3 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          Deception Likelihood Gauge
        </h3>
        <span
          id="deception-label"
          data-api="WS /ws/live"
          className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border tracking-wider ${labelClass}`}
        >
          {label.toUpperCase()}
        </span>
      </div>

      <div className="relative flex flex-col items-center justify-center pt-2">
        <div id="deception-gauge" data-api="WS /ws/live" className="relative w-52 h-28 flex items-center justify-center">
          <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
            </defs>
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#1E2733"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              id="gauge-progress-path"
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#gauge-gradient)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray="251.2"
              strokeDashoffset={progressOffset}
              className="transition-all duration-500 ease-out"
            />
            <g
              id="gauge-needle-group"
              className="gauge-needle"
              style={{ transform: `rotate(${needleAngle}deg)` }}
            >
              <line
                x1="100"
                y1="95"
                x2="100"
                y2="28"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinecap="round"
                filter="drop-shadow(0 0 4px rgba(255,255,255,0.8))"
              />
              <circle cx="100" cy="95" r="6" fill="#22D3EE" stroke="#0B0F14" strokeWidth="2" />
            </g>
          </svg>

          <div className="absolute bottom-0 text-center flex flex-col items-center">
            <span
              id="gauge-score-value"
              data-api="WS /ws/live"
              className={`text-3xl font-extrabold font-mono tracking-tight ${scoreClass}`}
            >
              {score}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
              Cognitive Load
            </span>
          </div>
        </div>

        <div className="w-full max-w-xs flex justify-between text-[10px] font-mono text-slate-400 px-2 pt-1 border-t border-[#1E2733]/50">
          <span className="text-emerald-400 font-semibold">0% Truth</span>
          <span className="text-amber-400 font-semibold">50% Suspicious</span>
          <span className="text-red-400 font-semibold">100% Deceptive</span>
        </div>
      </div>
    </div>
  );
}
