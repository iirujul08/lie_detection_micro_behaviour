import React from 'react';
import { Play, Upload, Zap, Activity, Clock, ArrowRight } from 'lucide-react';

export default function Home({ onNavigate }) {
  return (
    <section id="screen-home" className="space-y-16 py-4">
      
      {/* Hero Section */}
      <div className="relative rounded-3xl p-8 sm:p-14 lg:p-16 border border-[#1E2733] bg-gradient-to-b from-[#121821] via-[#0E141D] to-[#0B0F14] overflow-hidden shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-3xl space-y-6 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Next-Gen Micro-Expression & FACS Synthesis</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
            Unmask Subtle Deception with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22D3EE] via-teal-300 to-[#8B5CF6]">
              Sub-Second Facial Cues
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 font-normal leading-relaxed max-w-2xl">
            Detect involuntary facial micro-tremors, asymmetric Action Unit bursts, and subtle gaze aversion in real time using deep neural networks trained on high-speed temporal FACS benchmarks.
          </p>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-wrap gap-4 items-center">
            <button
              id="btn-start-live"
              data-api="WS /ws/live"
              onClick={() => onNavigate('live')}
              className="inline-flex items-center justify-center space-x-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] hover:from-[#38bdf8] hover:to-[#a78bfa] text-slate-950 font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] transition duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Live Detection</span>
            </button>

            <button
              id="btn-upload"
              data-api="POST /api/analyze/image"
              onClick={() => onNavigate('upload')}
              className="inline-flex items-center justify-center space-x-2.5 px-6 py-3.5 rounded-2xl bg-[#17202C] hover:bg-[#1E2733] border border-[#2A3647] hover:border-cyan-500/40 text-slate-200 hover:text-white font-semibold text-sm transition duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Upload className="w-5 h-5 text-cyan-400" />
              <span>Upload Image/Video</span>
            </button>
          </div>

          {/* Quick Telemetry Badges */}
          <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-400 font-mono">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>468 3D Mesh Landmarks</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
              <span>40ms Micro-Expression Resolution</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>FACS Action Units (AU1, AU4, AU12, AU15)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Three Core Feature Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400"></span>
            Forensic AI Telemetry Suite
          </h2>
          <span className="text-xs text-slate-400 font-mono">Real-time Biometric Inference</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Micro-expressions */}
          <div className="glass-panel rounded-2xl p-6 space-y-4 border border-[#1E2733] hover:border-cyan-500/40 transition duration-300 group hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition">
              Micro-Expressions Engine
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Captures fleeting involuntary muscle twitches lasting between 1/25th and 1/5th of a second. Isolates true emotional leaks before deliberate cortical masking occurs.
            </p>
            <div className="text-xs font-mono text-cyan-400/80 pt-2 flex items-center gap-1">
              <span>Sub-second optical flow</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: Real-time scoring */}
          <div className="glass-panel rounded-2xl p-6 space-y-4 border border-[#1E2733] hover:border-violet-500/40 transition duration-300 group hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition">
              Real-Time Scoring
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Continuous WebSocket streaming evaluates cumulative cognitive load, 8-dimensional emotion vectors, gaze shifts, and provides probabilistic truthfulness percentage.
            </p>
            <div className="text-xs font-mono text-violet-400/80 pt-2 flex items-center gap-1">
              <span>WS /ws/live streaming</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: Session history */}
          <div className="glass-panel rounded-2xl p-6 space-y-4 border border-[#1E2733] hover:border-emerald-500/40 transition duration-300 group hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition">
              Forensic Session History
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Deep archival database stores every interrogation run with full timeline scrubs, Action Unit incident logs, peak score markers, and structured export capabilities.
            </p>
            <div className="text-xs font-mono text-emerald-400/80 pt-2 flex items-center gap-1">
              <span>Persistent audit trail</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Short "How it works" 4-step strip */}
      <div className="glass-panel rounded-2xl p-8 border border-[#1E2733] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2733] pb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">How TruthLens Operates</h2>
            <p className="text-xs text-slate-400">From raw photon capture to probabilistic cognitive evaluation</p>
          </div>
          <div className="text-xs font-mono text-slate-400 bg-[#0B0F14] px-3 py-1 rounded-lg border border-[#1E2733]">
            Pipeline Latency: ~18ms
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Step 1 */}
          <div className="space-y-2 relative">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-mono font-bold text-sm flex items-center justify-center">
                01
              </div>
              <h4 className="font-bold text-white text-sm">Capture</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pl-11">
              Continuous 60 FPS video input stream from browser webcam or uploaded high-definition recorded interview files.
            </p>
          </div>

          {/* Step 2 */}
          <div className="space-y-2 relative">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-mono font-bold text-sm flex items-center justify-center">
                02
              </div>
              <h4 className="font-bold text-white text-sm">Detect Face</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pl-11">
              Extracts 468 3D facial landmarks, head pose yaw/pitch/roll angles, and isolates primary regions of emotional interest.
            </p>
          </div>

          {/* Step 3 */}
          <div className="space-y-2 relative">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-400 font-mono font-bold text-sm flex items-center justify-center">
                03
              </div>
              <h4 className="font-bold text-white text-sm">Analyze Cues</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pl-11">
              Temporal convolutional networks track Action Unit triggers (AU4 brow furrow, AU12 lip pull, AU15 lip depressor, blink rate).
            </p>
          </div>

          {/* Step 4 */}
          <div className="space-y-2 relative">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono font-bold text-sm flex items-center justify-center">
                04
              </div>
              <h4 className="font-bold text-white text-sm">Score</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pl-11">
              Synthesizes an ensemble deception likelihood index with confidence intervals, highlighting suspicious peak anomalies.
            </p>
          </div>
        </div>
      </div>

    </section>
  );
}
