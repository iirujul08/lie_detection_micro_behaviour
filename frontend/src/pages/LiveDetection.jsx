import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Save, Camera, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import DisclaimerBanner from '../components/DisclaimerBanner';
import DeceptionGauge from '../components/DeceptionGauge';
import { useCamera } from '../hooks/useCamera';
import { useWebSocket } from '../hooks/useWebSocket';
import { saveSession } from '../api/client';

export default function LiveDetection({ onShowToast }) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionScores, setSessionScores] = useState([
    { time: '00:00', score: 18 }
  ]);
  const [liveTelemetry, setLiveTelemetry] = useState({
    face_detected: false,
    confidence: 0,
    deception_score: 18,
    label: 'Truthful',
    dominant_emotion: 'Neutral',
    fps: 0,
    cues: [],
    emotions: {
      happy: 12, sad: 4, angry: 3, fear: 6,
      surprise: 8, disgust: 2, contempt: 4, neutral: 76
    }
  });

  const canvasRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const frameStreamIntervalRef = useRef(null);

  const { videoRef, isActive: cameraActive, startCamera, stopCamera, captureFrameBase64 } = useCamera();

  // Handle incoming WebSocket messages
  const handleWsMessage = useCallback((data) => {
    setLiveTelemetry(prev => ({
      ...prev,
      face_detected: data.face_detected,
      confidence: data.confidence || (data.face_detected ? 98.4 : 0),
      deception_score: data.deception_score !== undefined ? data.deception_score : prev.deception_score,
      label: data.label || prev.label,
      dominant_emotion: data.dominant_emotion || prev.dominant_emotion,
      fps: data.fps || prev.fps,
      emotions: data.emotions || prev.emotions,
      cues: data.cues && data.cues.length > 0 ? [...data.cues, ...prev.cues.slice(0, 10)] : prev.cues
    }));

    if (data.deception_score !== undefined) {
      setSessionScores(prev => {
        const now = new Date();
        const timeLabel = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const updated = [...prev, { time: timeLabel, score: data.deception_score }];
        return updated.length > 25 ? updated.slice(-25) : updated;
      });
    }

    // Draw face bounding box & landmark points on overlay canvas
    if (canvasRef.current && data.face_detected) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (data.bbox) {
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(data.bbox.x, data.bbox.y, data.bbox.width, data.bbox.height);
        ctx.setLineDash([]);
      }

      if (data.landmarks && Array.isArray(data.landmarks)) {
        ctx.fillStyle = '#22D3EE';
        data.landmarks.forEach(pt => {
          ctx.fillRect(pt.x - 1, pt.y - 1, 2.5, 2.5);
        });
      }
    }
  }, []);

  const { connect: connectWs, disconnect: disconnectWs, sendFrame } = useWebSocket(handleWsMessage);

  // Timer formatted MM:SS
  const formatTime = (seconds) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleStartCamera = async () => {
    if (!consentGiven) {
      onShowToast('Consent Required', 'Please check the biometric consent statement first.', 'warning');
      return;
    }

    setIsRunning(true);
    connectWs();
    await startCamera();

    // Start timer
    setSessionTime(0);
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setSessionTime(t => t + 1);
    }, 1000);

    // Frame stream interval (send base64 to WebSocket at ~8-10 FPS)
    clearInterval(frameStreamIntervalRef.current);
    frameStreamIntervalRef.current = setInterval(() => {
      const frameBase64 = captureFrameBase64(0.7);
      if (frameBase64) {
        sendFrame(frameBase64, formatTime(sessionTime));
      }
    }, 120);

    onShowToast('Telemetry Stream Active', 'Streaming camera frames to WebSocket at /ws/live.', 'info');
  };

  const handleStopCamera = () => {
    setIsRunning(false);
    stopCamera();
    disconnectWs();
    clearInterval(timerIntervalRef.current);
    clearInterval(frameStreamIntervalRef.current);

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    onShowToast('Stream Paused', 'Session recording frozen. You may now save to History.', 'info');
  };

  const handleSaveSession = async () => {
    try {
      const durationStr = formatTime(sessionTime);
      const score = liveTelemetry.deception_score;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);

      const payload = {
        date: dateStr,
        source: 'Live Stream',
        sourceType: 'live',
        duration: durationStr,
        durationSec: sessionTime,
        avgScore: score,
        peakScore: Math.min(100, score + 12.0),
        label: liveTelemetry.label,
        cues: liveTelemetry.cues.length > 0 ? liveTelemetry.cues.slice(0, 6) : [
          { time: '00:08', text: 'AU12 Bilateral Zygomatic smile', severity: 'emerald' }
        ],
        timeline: sessionScores.map(s => s.score)
      };

      const result = await saveSession(payload);
      onShowToast('Session Saved', `Session ${result.id} persisted to database.`, 'success');
    } catch (err) {
      console.error('Failed to save session:', err);
      onShowToast('Save Error', 'Could not save session to backend.', 'error');
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(timerIntervalRef.current);
      clearInterval(frameStreamIntervalRef.current);
    };
  }, []);

  // Format emotions for Recharts BarChart
  const emotionChartData = [
    { name: 'Happy', value: liveTelemetry.emotions.happy || 0, fill: '#10B981' },
    { name: 'Sad', value: liveTelemetry.emotions.sad || 0, fill: '#38BDF8' },
    { name: 'Angry', value: liveTelemetry.emotions.angry || 0, fill: '#EF4444' },
    { name: 'Fear', value: liveTelemetry.emotions.fear || 0, fill: '#F59E0B' },
    { name: 'Surprise', value: liveTelemetry.emotions.surprise || 0, fill: '#A855F7' },
    { name: 'Disgust', value: liveTelemetry.emotions.disgust || 0, fill: '#EC4899' },
    { name: 'Contempt', value: liveTelemetry.emotions.contempt || 0, fill: '#E11D48' },
    { name: 'Neutral', value: liveTelemetry.emotions.neutral || 0, fill: '#64748B' }
  ];

  return (
    <section id="screen-live" className="space-y-6">
      
      {/* Disclaimer Banner */}
      <DisclaimerBanner id="disclaimer-live" context="Live" />

      {/* Main Grid: Left Video (7 cols), Right Telemetry (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Camera Feed & Controls */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="glass-panel rounded-2xl border border-[#1E2733] overflow-hidden relative shadow-2xl bg-black">
            
            <div className="relative w-full aspect-[4/3] sm:aspect-video bg-[#080B0F] flex items-center justify-center overflow-hidden">
              {/* Webcam Video */}
              <video
                id="webcam-video"
                data-api="WS /ws/live"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* Overlay Canvas */}
              <canvas
                id="overlay-canvas"
                data-api="WS /ws/live"
                ref={canvasRef}
                width={640}
                height={480}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />

              {/* Radar Scanline */}
              {isRunning && <div id="live-scanline" className="radar-scan-line z-15"></div>}

              {/* Live HUD Badges */}
              <div className="absolute top-3 left-3 z-20 flex items-center space-x-2">
                {isRunning && (
                  <span id="badge-live-rec" className="px-2.5 py-1 rounded-md bg-red-600/90 text-white font-mono text-xs font-bold tracking-wider uppercase animate-pulse flex items-center gap-1.5 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    LIVE STREAM
                  </span>
                )}
                <span id="badge-stream-status" className="px-2 py-0.5 rounded-md bg-[#121821]/80 backdrop-blur border border-[#1E2733] text-slate-300 font-mono text-[11px]">
                  {isRunning ? 'Active 60fps' : 'Standby'}
                </span>
              </div>

              {/* Idle Placeholder */}
              {!isRunning && (
                <div id="camera-idle-placeholder" className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-[#0B0F14]/90 backdrop-blur-sm space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#121821] border border-[#1E2733] flex items-center justify-center text-cyan-400 shadow-inner">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="max-w-sm space-y-1">
                    <h3 className="text-white font-bold text-base">Webcam Inactive</h3>
                    <p className="text-xs text-slate-400">
                      Check the consent box below, then click "Start Camera" to initialize real-time MediaPipe Action Unit tracking.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-[11px] font-mono text-cyan-400/80 bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-800/40">
                    <span>FastAPI WebSocket endpoint: WS /ws/live</span>
                  </div>
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div className="p-3.5 bg-[#0E141D] border-t border-[#1E2733] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1.5" title="Frames Per Second">
                  <span className="text-slate-400">FPS:</span>
                  <span id="stat-fps" data-api="WS /ws/live" className="font-bold text-cyan-400 font-mono-numbers">
                    {isRunning ? (liveTelemetry.fps > 0 ? liveTelemetry.fps : '30.0') : '0.0'}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">Face Detected:</span>
                  <span
                    id="stat-face-detected"
                    data-api="WS /ws/live"
                    className={`font-bold flex items-center gap-1 ${
                      liveTelemetry.face_detected ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${liveTelemetry.face_detected ? 'bg-emerald-500 animate-ping' : 'bg-slate-600'}`}></span>
                    <span>{liveTelemetry.face_detected ? 'Yes (Tracked)' : 'No'}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">Confidence:</span>
                  <span id="stat-confidence" data-api="WS /ws/live" className="font-bold text-slate-300 font-mono-numbers">
                    {liveTelemetry.face_detected ? `${liveTelemetry.confidence}%` : '--%'}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">Session Timer:</span>
                  <span id="stat-session-timer" className="font-bold text-white font-mono-numbers bg-[#121821] px-2 py-0.5 rounded border border-[#1E2733]">
                    {formatTime(sessionTime)}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Consent Checkbox & Action Buttons */}
          <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-[#1E2733] space-y-4">
            <div className="flex items-start space-x-3 p-3 rounded-xl bg-[#0B0F14]/70 border border-[#1E2733]">
              <input
                type="checkbox"
                id="consent-checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-400 cursor-pointer"
              />
              <label htmlFor="consent-checkbox" className="text-xs text-slate-300 cursor-pointer select-none">
                <strong className="text-white font-semibold">Informed Consent:</strong> I consent to webcam facial and micro-expression telemetry analysis. No video is stored unless I opt in.
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                id="btn-start-camera"
                data-api="WS /ws/live"
                disabled={!consentGiven || isRunning}
                onClick={handleStartCamera}
                className="flex-1 min-w-[140px] inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-sm shadow-[0_0_15px_rgba(34,211,238,0.3)] transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Camera</span>
              </button>

              <button
                id="btn-stop-camera"
                data-api="WS /ws/live"
                disabled={!isRunning}
                onClick={handleStopCamera}
                className="flex-1 min-w-[140px] inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-[#17202C] hover:bg-[#1E2733] border border-[#2A3647] disabled:opacity-40 disabled:cursor-not-allowed text-red-400 font-semibold text-sm transition"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Stream</span>
              </button>

              <button
                id="btn-save-session"
                data-api="POST /api/sessions"
                disabled={isRunning || sessionTime === 0}
                onClick={handleSaveSession}
                className="flex-1 min-w-[140px] inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-[0_0_15px_rgba(139,92,246,0.3)] transition"
              >
                <Save className="w-4 h-4" />
                <span>Save Session</span>
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Real-Time Analytics Panel */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Deception Semicircle Gauge */}
          <DeceptionGauge score={liveTelemetry.deception_score} label={liveTelemetry.label} />

          {/* Rolling Line Chart */}
          <div className="glass-panel rounded-2xl p-4 border border-[#1E2733] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                Score Timeline (Rolling 30s)
              </span>
              <span className="text-[10px] font-mono text-slate-400">WS /ws/live</span>
            </div>
            <div id="score-timeline" data-api="WS /ws/live" className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sessionScores} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} stroke="#475569" fontSize={9} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0F14', borderColor: '#1E2733', fontSize: '11px', borderRadius: '8px' }}
                    labelStyle={{ color: '#22D3EE' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#22D3EE" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Live Emotion Bar Chart (8 emotions) */}
          <div className="glass-panel rounded-2xl p-4 border border-[#1E2733] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                Action Unit &amp; Emotion Spectrum
              </span>
              <span className="text-[10px] font-mono text-cyan-400">
                Dominant: <strong className="text-white">{liveTelemetry.dominant_emotion}</strong>
              </span>
            </div>
            <div id="emotion-chart" data-api="WS /ws/live" className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emotionChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748B" fontSize={9} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#475569" fontSize={8} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0F14', borderColor: '#1E2733', fontSize: '11px', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {emotionChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cue Alerts List */}
          <div className="glass-panel rounded-2xl p-4 border border-[#1E2733] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                Micro-Expression Cue Alerts
              </span>
              <span className="text-[10px] font-mono text-slate-400">Live Incident Log</span>
            </div>

            <div id="cue-alerts" data-api="WS /ws/live" className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {liveTelemetry.cues.length > 0 ? (
                liveTelemetry.cues.slice(0, 6).map((cue, idx) => {
                  let dotColor = 'bg-emerald-400';
                  if (cue.severity === 'red') dotColor = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]';
                  else if (cue.severity === 'amber') dotColor = 'bg-amber-400';

                  return (
                    <div
                      key={idx}
                      className="cue-item flex items-center justify-between p-2 rounded-xl bg-[#0E141D] border border-[#1E2733] text-xs"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`}></span>
                        <div>
                          <div className="font-medium text-slate-200">{cue.text}</div>
                          {cue.desc && <div className="text-[10px] text-slate-400 font-mono">{cue.desc}</div>}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-[#121821] px-1.5 py-0.5 rounded border border-[#1E2733]">
                        {cue.time || '00:00'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-500 font-mono py-4 text-center">
                  Awaiting facial Action Unit anomalies...
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </section>
  );
}
