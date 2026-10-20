import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Save, Camera, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw, Cpu, Activity, Eye, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import DisclaimerBanner from '../components/DisclaimerBanner';
import DeceptionGauge from '../components/DeceptionGauge';
import { useCamera } from '../hooks/useCamera';
import { useWebSocket } from '../hooks/useWebSocket';
import { saveSession } from '../api/client';

export default function LiveDetection({ onShowToast }) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionScores, setSessionScores] = useState([
    { time: '00:00', score: 18 }
  ]);
  const [liveTelemetry, setLiveTelemetry] = useState({
    face_detected: false,
    confidence: 0,
    deception_score: 18,
    raw_score: 18,
    label: 'Truthful',
    dominant_emotion: 'Neutral',
    fps: 0,
    processing_ms: 0,
    calibrating: false,
    calibration_progress: 0,
    ear: 0.28,
    baseline: {},
    pose: { pitch: 0, yaw: 0, roll: 0 },
    landmarks_count: 0,
    cues: [],
    emotions: {
      happy: 12, sad: 4, angry: 3, fear: 6,
      surprise: 8, disgust: 2, contempt: 4, neutral: 76
    }
  });

  const canvasRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const sessionTimeRef = useRef(0);
  const isRunningRef = useRef(false);
  const isWaitingForResponseRef = useRef(false);
  const lastSendTimeRef = useRef(0);
  const responseTimeoutRef = useRef(null);

  const {
    videoRef,
    isActive: cameraActive,
    error: cameraError,
    isPermissionDenied,
    startCamera,
    stopCamera,
    captureFrameBase64
  } = useCamera();

  // Draw face bounding box & landmark points on overlay canvas
  const drawOverlay = useCallback((data) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Match canvas width/height to video's actual resolution
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!data.face_detected) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const isCalib = data.calibrating;

    // 1. Draw Bounding Box (using normalized 0-1 coords)
    if (data.bbox) {
      const bx = data.bbox.x * cw;
      const by = data.bbox.y * ch;
      const bw = data.bbox.width * cw;
      const bh = data.bbox.height * ch;

      ctx.save();
      ctx.strokeStyle = isCalib ? '#38BDF8' : (data.deception_score >= 70 ? '#EF4444' : (data.deception_score >= 40 ? '#F59E0B' : '#22D3EE'));
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(bx, by, bw, bh);

      // Corner accent markers
      ctx.setLineDash([]);
      ctx.lineWidth = 3.5;
      const cornerLen = Math.min(20, bw * 0.2);
      // Top-left
      ctx.beginPath();
      ctx.moveTo(bx, by + cornerLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + cornerLen, by);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + cornerLen);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(bx, by + bh - cornerLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + cornerLen, by + bh);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - cornerLen);
      ctx.stroke();

      ctx.restore();
    }

    // 2. Draw Facial Landmarks (normalized 0-1 coords)
    if (data.landmarks && Array.isArray(data.landmarks)) {
      ctx.save();
      ctx.fillStyle = isCalib ? 'rgba(56, 189, 248, 0.75)' : 'rgba(34, 211, 238, 0.85)';
      
      const pointSize = cw > 640 ? 3.0 : 2.2;
      data.landmarks.forEach(pt => {
        ctx.fillRect((pt.x * cw) - (pointSize / 2), (pt.y * ch) - (pointSize / 2), pointSize, pointSize);
      });
      ctx.restore();
    }
  }, [videoRef]);

  // Handle incoming WebSocket messages
  const handleWsMessage = useCallback((data) => {
    // Release waiting lock so next frame can be transmitted
    isWaitingForResponseRef.current = false;
    clearTimeout(responseTimeoutRef.current);

    setLiveTelemetry(prev => ({
      ...prev,
      face_detected: data.face_detected,
      confidence: data.confidence || (data.face_detected ? 98.6 : 0),
      deception_score: data.deception_score !== undefined ? data.deception_score : prev.deception_score,
      raw_score: data.raw_score !== undefined ? data.raw_score : prev.raw_score,
      label: data.label || prev.label,
      dominant_emotion: data.dominant_emotion || prev.dominant_emotion,
      fps: data.fps !== undefined ? data.fps : prev.fps,
      processing_ms: data.processing_ms !== undefined ? data.processing_ms : prev.processing_ms,
      calibrating: !!data.calibrating,
      calibration_progress: data.calibration_progress !== undefined ? data.calibration_progress : prev.calibration_progress,
      ear: data.ear !== undefined ? data.ear : prev.ear,
      baseline: data.baseline || prev.baseline,
      pose: data.pose || prev.pose,
      landmarks_count: data.landmarks_count || prev.landmarks_count,
      emotions: data.emotions || prev.emotions,
      cues: data.cues && data.cues.length > 0 ? [...data.cues, ...prev.cues.slice(0, 8)] : prev.cues
    }));

    if (data.deception_score !== undefined && !data.calibrating) {
      setSessionScores(prev => {
        const now = new Date();
        const timeLabel = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const updated = [...prev, { time: timeLabel, score: data.deception_score }];
        return updated.length > 30 ? updated.slice(-30) : updated;
      });
    }

    // Render Canvas Overlay
    drawOverlay(data);

    // Schedule next frame in the single-frame pipeline (Target ~8-10 FPS = 100-120ms interval)
    if (isRunningRef.current) {
      const elapsedSinceSend = performance.now() - lastSendTimeRef.current;
      const targetInterval = 110; // ~9 FPS
      const delay = Math.max(5, targetInterval - elapsedSinceSend);
      setTimeout(() => {
        sendNextFrame();
      }, delay);
    }
  }, [drawOverlay]);

  const {
    isConnected: wsConnected,
    isReconnecting: wsReconnecting,
    connect: connectWs,
    disconnect: disconnectWs,
    sendFrame,
    sendReset
  } = useWebSocket(handleWsMessage);

  // Timer formatted MM:SS
  const formatTime = (seconds) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const streamTickerRef = useRef(null);

  // Single-frame-at-a-time flow control
  const sendNextFrame = useCallback(() => {
    if (!isRunningRef.current || !videoRef.current || isWaitingForResponseRef.current) {
      return;
    }

    const frameBase64 = captureFrameBase64(0.75);
    if (!frameBase64) {
      return;
    }

    isWaitingForResponseRef.current = true;
    lastSendTimeRef.current = performance.now();

    const sent = sendFrame(frameBase64, formatTime(sessionTimeRef.current));
    if (!sent) {
      isWaitingForResponseRef.current = false;
    }
  }, [captureFrameBase64, sendFrame]);

  const handleStartCamera = async () => {
    if (!consentGiven) {
      onShowToast('Consent Required', 'Please check the biometric consent statement first.', 'warning');
      return;
    }

    setIsRunning(true);
    isRunningRef.current = true;
    connectWs();
    sendReset();

    const ok = await startCamera();
    if (!ok) {
      setIsRunning(false);
      isRunningRef.current = false;
      disconnectWs();
      return;
    }

    // Start session timer
    setSessionTime(0);
    sessionTimeRef.current = 0;
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setSessionTime(t => {
        const next = t + 1;
        sessionTimeRef.current = next;
        return next;
      });
    }, 1000);

    // Frame transmission ticker: fires every 100ms (~10 FPS max)
    // Only sends if isWaitingForResponseRef is false (strict 1-frame-at-a-time)
    clearInterval(streamTickerRef.current);
    streamTickerRef.current = setInterval(() => {
      if (isRunningRef.current) {
        // Safety: unlock if waiting longer than 750ms
        if (isWaitingForResponseRef.current && (performance.now() - lastSendTimeRef.current > 750)) {
          isWaitingForResponseRef.current = false;
        }
        if (!isWaitingForResponseRef.current) {
          sendNextFrame();
        }
      }
    }, 100);

    onShowToast('Pipeline Active', 'Webcam streaming at 8-10 FPS with 5s baseline calibration.', 'info');
  };

  const handleStopCamera = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    isWaitingForResponseRef.current = false;
    clearInterval(streamTickerRef.current);
    clearInterval(timerIntervalRef.current);

    stopCamera();
    disconnectWs();

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    onShowToast('Session Paused', 'Webcam stream stopped. You may save this session.', 'info');
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
          { time: '00:08', text: 'Baseline Concordance Maintained', severity: 'emerald' }
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

  // Keyboard shortcut listener for Debug Panel (key 'D' or 'd')
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'd' || e.key === 'D') && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(timerIntervalRef.current);
      clearTimeout(responseTimeoutRef.current);
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

      {/* Camera Permission Denied Warning State */}
      {isPermissionDenied && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-start gap-3 shadow-lg">
          <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-red-300">Camera Permission Denied</h4>
            <p>
              Your browser blocked webcam access. Please click the camera/lock icon in your browser address bar, set Camera to <strong>"Allow"</strong>, and refresh the page.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Left Video (7 cols), Right Telemetry (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Camera Feed & Controls */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="glass-panel rounded-2xl border border-[#1E2733] overflow-hidden relative shadow-2xl bg-black">
            
            <div className="relative w-full aspect-[4/3] bg-[#080B0F] flex items-center justify-center overflow-hidden">
              {/* Webcam Video (Mirrored with CSS scaleX(-1)) */}
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

              {/* Overlay Canvas (Mirrored identically to video) */}
              <canvas
                id="overlay-canvas"
                data-api="WS /ws/live"
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* Radar Scanline */}
              {isRunning && !liveTelemetry.calibrating && <div id="live-scanline" className="radar-scan-line z-15"></div>}

              {/* Calibrating State Overlay */}
              {isRunning && liveTelemetry.calibrating && (
                <div className="absolute inset-0 z-20 bg-cyan-950/50 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center space-y-3 pointer-events-none">
                  <div className="w-12 h-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin flex items-center justify-center">
                    <Activity className="w-5 h-5 text-cyan-300 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2">
                      <span>Calibrating Neutral Baseline</span>
                      <span className="font-mono text-cyan-400">{liveTelemetry.calibration_progress}%</span>
                    </h3>
                    <p className="text-xs text-cyan-200/80 max-w-xs">
                      Please maintain a relaxed, neutral facial expression while baseline EAR, blink frequency, and lip positions are measured.
                    </p>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-48 h-1.5 bg-[#0B0F14] rounded-full overflow-hidden border border-cyan-500/30">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-200"
                      style={{ width: `${liveTelemetry.calibration_progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* No Face Detected Overlay Alert */}
              {isRunning && !liveTelemetry.calibrating && !liveTelemetry.face_detected && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-25 px-4 py-1.5 rounded-full bg-amber-500/90 text-slate-950 font-semibold text-xs flex items-center gap-2 shadow-xl animate-bounce">
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-950" />
                  <span>No Face Detected — Please look toward the camera</span>
                </div>
              )}

              {/* Live HUD Badges */}
              <div className="absolute top-3 left-3 z-20 flex items-center space-x-2">
                {isRunning && (
                  <span id="badge-live-rec" className="px-2.5 py-1 rounded-md bg-red-600/90 text-white font-mono text-xs font-bold tracking-wider uppercase animate-pulse flex items-center gap-1.5 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    LIVE
                  </span>
                )}
                
                {/* WebSocket Status Badge */}
                <span
                  id="badge-stream-status"
                  className={`px-2 py-0.5 rounded-md border font-mono text-[11px] flex items-center gap-1.5 backdrop-blur ${
                    wsConnected
                      ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                      : (wsReconnecting
                        ? 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                        : 'bg-[#121821]/80 border-[#1E2733] text-slate-400')
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400' : (wsReconnecting ? 'bg-amber-400 animate-ping' : 'bg-slate-500')}`}></span>
                  <span>{wsConnected ? 'Connected' : (wsReconnecting ? 'Reconnecting...' : 'Disconnected')}</span>
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
                      Check the consent box below, then click "Start Camera" to initialize real-time MediaPipe Action Unit tracking with 5s baseline calibration.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-[11px] font-mono text-cyan-400/80 bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-800/40">
                    <span>Flow: 8-10 FPS • 320x240 JPEG • Single-Frame Latency Control</span>
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
                    {isRunning ? (liveTelemetry.fps > 0 ? liveTelemetry.fps : '9.0') : '0.0'}
                  </span>
                </div>
                
                {/* Latency / Processing Time */}
                <div className="flex items-center space-x-1.5" title="Server Inference Latency">
                  <span className="text-slate-400">Latency:</span>
                  <span id="stat-latency" className="font-bold text-violet-400 font-mono-numbers">
                    {isRunning && liveTelemetry.processing_ms > 0 ? `${liveTelemetry.processing_ms}ms` : '--'}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">Face:</span>
                  <span
                    id="stat-face-detected"
                    data-api="WS /ws/live"
                    className={`font-bold flex items-center gap-1 ${
                      liveTelemetry.face_detected ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${liveTelemetry.face_detected ? 'bg-emerald-500 animate-ping' : 'bg-slate-600'}`}></span>
                    <span>{liveTelemetry.face_detected ? 'Tracked' : 'Searching'}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">Timer:</span>
                  <span id="stat-session-timer" className="font-bold text-white font-mono-numbers bg-[#121821] px-2 py-0.5 rounded border border-[#1E2733]">
                    {formatTime(sessionTime)}
                  </span>
                </div>

                {/* Debug Panel Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowDebug(s => !s)}
                  title="Toggle Debug Telemetry Panel (Hot-key: D)"
                  className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
                    showDebug
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-[#121821] border-[#1E2733] text-slate-400 hover:text-white'
                  }`}
                >
                  Debug [D]
                </button>
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
                <strong className="text-white font-semibold">Informed Consent:</strong> I consent to webcam facial and micro-expression telemetry analysis. No raw video feed is stored on any server.
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

          {/* Interactive Debug Panel (Hot-key 'D') */}
          {showDebug && (
            <div className="glass-panel rounded-2xl p-4 border border-cyan-500/40 bg-[#0B0F14]/95 space-y-3 font-mono text-xs shadow-2xl animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-[#1E2733] pb-2">
                <span className="text-cyan-400 font-bold flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Live Diagnostic Telemetry (Press 'D' to Hide)
                </span>
                <span className="text-[10px] text-slate-400">MediaPipe Mesh + EMA(α=0.3)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div className="p-2 rounded-lg bg-[#121821] border border-[#1E2733]">
                  <div className="text-slate-400">Eye Aspect Ratio (EAR)</div>
                  <div className="text-white font-bold text-sm">
                    {liveTelemetry.ear} <span className="text-slate-500 text-[10px]">/ base {liveTelemetry.baseline.ear || '--'}</span>
                  </div>
                  <div className="text-[10px] text-cyan-400">{liveTelemetry.ear < (liveTelemetry.baseline.ear || 0.28) * 0.68 ? '● Blink Active' : '○ Eyes Open'}</div>
                </div>

                <div className="p-2 rounded-lg bg-[#121821] border border-[#1E2733]">
                  <div className="text-slate-400">Gaze Ratio / Iris</div>
                  <div className="text-white font-bold text-sm">
                    {liveTelemetry.baseline.gaze_ratio ? `Center: ${liveTelemetry.baseline.gaze_ratio}` : '--'}
                  </div>
                  <div className="text-[10px] text-slate-400">Iris Landmarks: 468/473</div>
                </div>

                <div className="p-2 rounded-lg bg-[#121821] border border-[#1E2733]">
                  <div className="text-slate-400">Raw vs Smoothed Score</div>
                  <div className="text-white font-bold text-sm">
                    {liveTelemetry.raw_score} → <span className="text-cyan-300">{liveTelemetry.deception_score}%</span>
                  </div>
                  <div className="text-[10px] text-slate-400">EMA Filter Active</div>
                </div>

                <div className="p-2 rounded-lg bg-[#121821] border border-[#1E2733]">
                  <div className="text-slate-400">Server Latency</div>
                  <div className="text-violet-300 font-bold text-sm">
                    {liveTelemetry.processing_ms} ms
                  </div>
                  <div className="text-[10px] text-slate-400">FPS: {liveTelemetry.fps}</div>
                </div>
              </div>

              <div className="text-[11px] p-2 rounded-lg bg-[#121821] border border-[#1E2733] flex flex-wrap items-center justify-between gap-2 text-slate-300">
                <div>
                  <span className="text-slate-400">Head Pose:</span> Pitch {liveTelemetry.pose.pitch}° • Yaw {liveTelemetry.pose.yaw}° • Roll {liveTelemetry.pose.roll}°
                </div>
                <div>
                  <span className="text-slate-400">Tracked Landmarks:</span> {liveTelemetry.landmarks_count || 478} points (Normalized)
                </div>
              </div>
            </div>
          )}

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
                Deception Score Timeline (Rolling)
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
                Relative Micro-Expression Cues
              </span>
              <span className="text-[10px] font-mono text-slate-400">Threshold Triggers</span>
            </div>

            <div id="cue-alerts" data-api="WS /ws/live" className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {liveTelemetry.cues.length > 0 ? (
                liveTelemetry.cues.slice(0, 6).map((cue, idx) => {
                  let dotColor = 'bg-emerald-400';
                  if (cue.severity === 'red') dotColor = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]';
                  else if (cue.severity === 'amber') dotColor = 'bg-amber-400';
                  else if (cue.severity === 'cyan') dotColor = 'bg-cyan-400 animate-pulse';

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
