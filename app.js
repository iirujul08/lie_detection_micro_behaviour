/**
 * TruthLens — Facial & Micro-Expression Lie Detector
 * Client-Side Controller & Simulation Telemetry Engine
 * Designed for immediate standalone preview & seamless FastAPI connection
 */

// =============================================================================
// 1. STATE MANAGEMENT
// =============================================================================
const AppState = {
  activeScreen: 'screen-home',
  backendOnline: true,
  cameraActive: false,
  cameraStream: null,
  sessionStartTime: null,
  sessionTimerInterval: null,
  liveAnalysisInterval: null,
  currentLiveScore: 18,
  currentScoresHistory: [],
  currentLiveCues: [],
  
  // Simulated or Active FPS and Face tracking telemetry
  fps: 0,
  frameCount: 0,
  lastFpsCheck: Date.now(),
  faceDetected: false,
  confidence: 96.4,
  poseYaw: 2.1,
  posePitch: -1.2,
  poseRoll: 0.8,
  
  // Charts
  scoreTimelineChart: null,
  emotionChart: null,
  uploadFrameChart: null,
  classDistributionChart: null,
  drawerTimelineChart: null,

  // Selected session for detail drawer
  selectedSession: null
};

// Default Realistic Forensic Sessions Database
const DEFAULT_SESSIONS = [
  {
    id: "SES-98241",
    date: "2026-10-19 21:42",
    source: "Live Stream",
    sourceType: "live",
    duration: "02:15",
    durationSec: 135,
    avgScore: 24.2,
    peakScore: 38.5,
    label: "Truthful",
    labelClass: "text-emerald-400 bg-emerald-950/80 border-emerald-500/50",
    cues: [
      { time: "00:24", text: "AU1+2 Symmetric brow raise (Authentic surprise)", severity: "emerald" },
      { time: "01:08", text: "AU12 Bilateral zygomatic contraction (Genuine smile)", severity: "emerald" },
      { time: "01:52", text: "Consistent direct eye contact sustained", severity: "emerald" }
    ],
    timeline: [18, 20, 22, 25, 21, 38, 28, 24, 20, 19, 22, 25, 23, 21]
  },
  {
    id: "SES-98104",
    date: "2026-10-19 18:30",
    source: "Uploaded Video",
    sourceType: "video",
    duration: "04:12",
    durationSec: 252,
    avgScore: 78.6,
    peakScore: 94.2,
    label: "Likely Deceptive",
    labelClass: "text-red-400 bg-red-950/80 border-red-500/50",
    cues: [
      { time: "00:41", text: "AU4 Brow furrow coupled with AU15 lip depressor", severity: "red" },
      { time: "01:15", text: "Asymmetric lip corner curl (AU14 Micro-contempt)", severity: "red" },
      { time: "02:03", text: "Gaze aversion right-up with vocal swallowing pause", severity: "amber" },
      { time: "03:22", text: "Blink rate acceleration (+180% above baseline)", severity: "red" }
    ],
    timeline: [35, 42, 58, 72, 88, 94, 85, 78, 82, 89, 76, 70, 75, 84]
  },
  {
    id: "SES-97982",
    date: "2026-10-18 14:10",
    source: "Uploaded Video",
    sourceType: "video",
    duration: "01:45",
    durationSec: 105,
    avgScore: 56.4,
    peakScore: 71.0,
    label: "Suspicious",
    labelClass: "text-amber-400 bg-amber-950/80 border-amber-500/50",
    cues: [
      { time: "00:18", text: "AU14 Unilateral dimpler activation", severity: "amber" },
      { time: "00:54", text: "Lip compression (AU24) during direct inquiry", severity: "amber" },
      { time: "01:22", text: "Rapid eye saccades with dilated pupils", severity: "amber" }
    ],
    timeline: [40, 45, 52, 60, 68, 71, 62, 55, 50, 58, 62, 54]
  },
  {
    id: "SES-97650",
    date: "2026-10-17 11:25",
    source: "Uploaded Image",
    sourceType: "image",
    duration: "00:01",
    durationSec: 1,
    avgScore: 21.0,
    peakScore: 21.0,
    label: "Truthful",
    labelClass: "text-emerald-400 bg-emerald-950/80 border-emerald-500/50",
    cues: [
      { time: "00:00", text: "Relaxed orbicularis oculi, absence of muscle tension", severity: "emerald" },
      { time: "00:00", text: "Symmetric frontal facial orientation", severity: "emerald" }
    ],
    timeline: [21, 21, 21]
  }
];

// Initialize local storage for history persistence
function getStoredSessions() {
  const data = localStorage.getItem('truthlens_sessions');
  if (!data) {
    localStorage.setItem('truthlens_sessions', JSON.stringify(DEFAULT_SESSIONS));
    return DEFAULT_SESSIONS;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return DEFAULT_SESSIONS;
  }
}

function saveStoredSessions(sessions) {
  localStorage.setItem('truthlens_sessions', JSON.stringify(sessions));
}

// =============================================================================
// 2. DOM INITIALIZATION & NAVIGATION ROUTER
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initToastSystem();
  initBackendStatusToggle();
  initConsentAndCamera();
  initCharts();
  initUploadScreen();
  initHistoryScreen();
  initMetricsScreen();
  
  // Set up periodic simulated FPS updates
  requestAnimationFrame(renderLandmarkLoop);
});

// Navigation Controller
function initNavigation() {
  const screens = document.querySelectorAll('.screen-view');
  const navItems = document.querySelectorAll('.nav-item');
  const mobileNavItems = document.querySelectorAll('.nav-item-mobile');
  const actionItems = document.querySelectorAll('.nav-item-action');
  const mobileMenu = document.getElementById('mobile-nav-menu');
  const btnMobileMenu = document.getElementById('btn-mobile-menu');

  function switchScreen(targetId) {
    // Hide all screens
    screens.forEach(screen => screen.classList.add('hidden'));

    // Show selected screen
    const targetScreen = document.getElementById(targetId);
    if (targetScreen) {
      targetScreen.classList.remove('hidden');
      AppState.activeScreen = targetId;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update active nav link style
    navItems.forEach(item => {
      if (item.dataset.target === targetId) {
        item.classList.add('nav-tab-active');
      } else {
        item.classList.remove('nav-tab-active');
      }
    });

    // Close mobile menu if open
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
      mobileMenu.classList.add('hidden');
    }

    // Trigger Chart Resize/Update when screen becomes visible
    setTimeout(() => {
      if (targetId === 'screen-live') {
        if (AppState.scoreTimelineChart) AppState.scoreTimelineChart.resize();
        if (AppState.emotionChart) AppState.emotionChart.resize();
      } else if (targetId === 'screen-upload') {
        if (AppState.uploadFrameChart) AppState.uploadFrameChart.resize();
        drawAnnotatedPreview();
      } else if (targetId === 'screen-metrics') {
        if (AppState.classDistributionChart) AppState.classDistributionChart.resize();
      } else if (targetId === 'screen-history') {
        renderHistoryTable();
      }
    }, 100);
  }

  // Click on Brand Logo -> Go Home
  const navBrand = document.getElementById('nav-brand-logo');
  if (navBrand) {
    navBrand.addEventListener('click', (e) => {
      e.preventDefault();
      switchScreen('screen-home');
    });
  }

  // Header Nav links
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.target;
      if (target) switchScreen(target);
    });
  });

  // Mobile menu links
  mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.target;
      if (target) switchScreen(target);
    });
  });

  // Action buttons (Hero buttons, quick live, etc.)
  actionItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (target) switchScreen(target);
    });
  });

  // Quick run camera button in header
  const btnQuickLive = document.getElementById('btn-header-quick-live');
  if (btnQuickLive) {
    btnQuickLive.addEventListener('click', () => switchScreen('screen-live'));
  }

  // Mobile Hamburger Toggle
  if (btnMobileMenu && mobileMenu) {
    btnMobileMenu.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }
}

// =============================================================================
// 3. TOAST SYSTEM & BACKEND STATUS
// =============================================================================
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `p-4 rounded-xl border pointer-events-auto transform transition-all duration-300 shadow-xl backdrop-blur-md flex items-start space-x-3 text-xs sm:text-sm animate-fade-in`;

  let borderClass = 'border-[#1E2733] bg-[#121821]/95 text-white';
  let iconSvg = '';

  if (type === 'success') {
    borderClass = 'border-emerald-500/50 bg-emerald-950/90 text-emerald-100';
    iconSvg = `<svg class="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
  } else if (type === 'warning') {
    borderClass = 'border-amber-500/50 bg-amber-950/90 text-amber-100';
    iconSvg = `<svg class="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
  } else if (type === 'error') {
    borderClass = 'border-red-500/50 bg-red-950/90 text-red-100';
    iconSvg = `<svg class="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else {
    borderClass = 'border-cyan-500/50 bg-cyan-950/90 text-cyan-100';
    iconSvg = `<svg class="w-5 h-5 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  }

  toast.className += ` ${borderClass}`;
  toast.innerHTML = `
    ${iconSvg}
    <div class="flex-1 space-y-0.5">
      <div class="font-bold text-white">${title}</div>
      <div class="text-xs opacity-90">${message}</div>
    </div>
    <button class="text-slate-400 hover:text-white transition ml-2" onclick="this.parentElement.remove()">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function initToastSystem() {
  // Expose to window for inline callers
  window.showToast = showToast;
}

function initBackendStatusToggle() {
  const pill = document.getElementById('backend-status-pill');
  const dot = document.getElementById('backend-status-dot');
  const text = document.getElementById('backend-status-text');
  const offlineBanner = document.getElementById('offline-banner');
  const btnReconnect = document.getElementById('btn-reconnect-backend');
  const btnDismissBanner = document.getElementById('btn-dismiss-offline-banner');

  function updateBackendState(online) {
    AppState.backendOnline = online;
    if (online) {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-status-pulse';
      text.textContent = 'Backend: Online';
      offlineBanner.classList.add('hidden');
      showToast('Backend Connected', 'FastAPI health check responded with status: 200 OK.', 'success');
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-status-pulse';
      text.textContent = 'Backend: Offline';
      offlineBanner.classList.remove('hidden');
      showToast('Backend Disconnected', 'Failed to reach FastAPI (GET /api/health). Running client simulated telemetry.', 'error');
    }
  }

  // Toggle state on click for testing/demoing
  if (pill) {
    pill.addEventListener('click', () => {
      updateBackendState(!AppState.backendOnline);
    });
  }

  if (btnReconnect) {
    btnReconnect.addEventListener('click', () => {
      showToast('Pinging Backend...', 'Querying http://localhost:8000/api/health', 'info');
      setTimeout(() => {
        updateBackendState(true);
      }, 700);
    });
  }

  if (btnDismissBanner) {
    btnDismissBanner.addEventListener('click', () => {
      offlineBanner.classList.add('hidden');
    });
  }
}

// =============================================================================
// 4. SCREEN 2: LIVE DETECTION & CAMERA CONTROLLER
// =============================================================================
function initConsentAndCamera() {
  const consentCheckbox = document.getElementById('consent-checkbox');
  const btnStartCamera = document.getElementById('btn-start-camera');
  const btnStopCamera = document.getElementById('btn-stop-camera');
  const btnSaveSession = document.getElementById('btn-save-session');
  const videoElement = document.getElementById('webcam-video');
  const idlePlaceholder = document.getElementById('camera-idle-placeholder');
  const scanLine = document.getElementById('live-scanline');
  const badgeRec = document.getElementById('badge-live-rec');
  const badgeStreamStatus = document.getElementById('badge-stream-status');
  const faceHud = document.getElementById('face-hud-overlay');

  // Consent checkbox gates the start button
  if (consentCheckbox && btnStartCamera) {
    consentCheckbox.addEventListener('change', (e) => {
      btnStartCamera.disabled = !e.target.checked;
      if (e.target.checked) {
        showToast('Consent Recorded', 'Webcam analysis permitted. Ephemeral streaming only.', 'info');
      }
    });
  }

  // Start Camera Stream
  if (btnStartCamera) {
    btnStartCamera.addEventListener('click', async () => {
      if (!consentCheckbox.checked) {
        showToast('Consent Required', 'Please check the consent box before starting camera.', 'warning');
        return;
      }

      btnStartCamera.disabled = true;
      btnStopCamera.disabled = false;
      btnSaveSession.disabled = true;

      idlePlaceholder.classList.add('hidden');
      scanLine.classList.remove('hidden');
      badgeRec.classList.remove('hidden');
      faceHud.classList.remove('hidden');
      badgeStreamStatus.textContent = 'Active 60fps';

      // Start timer
      AppState.sessionStartTime = Date.now();
      clearInterval(AppState.sessionTimerInterval);
      AppState.sessionTimerInterval = setInterval(updateSessionTimer, 1000);

      AppState.cameraActive = true;
      AppState.faceDetected = true;
      AppState.currentScoresHistory = [];

      // Attempt to access user webcam
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
          });
          videoElement.srcObject = stream;
          AppState.cameraStream = stream;
          showToast('Live Camera Initialized', 'Hardware webcam stream active. Streaming to WS /ws/live.', 'success');
        } else {
          fallbackSyntheticCamera();
        }
      } catch (err) {
        console.warn('Physical camera not available or denied. Using synthetic cybernetic face generator:', err);
        fallbackSyntheticCamera();
      }

      // Start live score & telemetry emulation
      startLiveTelemetryEngine();
    });
  }

  function fallbackSyntheticCamera() {
    showToast('Synthetic Mode Engaged', 'Webcam unavailable. Rendering high-precision synthetic neural face feed.', 'info');
    videoElement.style.display = 'none'; // Render purely via canvas overlay
  }

  // Stop Camera Stream
  if (btnStopCamera) {
    btnStopCamera.addEventListener('click', () => {
      btnStartCamera.disabled = false;
      btnStopCamera.disabled = true;
      btnSaveSession.disabled = false;

      AppState.cameraActive = false;
      clearInterval(AppState.sessionTimerInterval);
      clearInterval(AppState.liveAnalysisInterval);

      // Stop media tracks
      if (AppState.cameraStream) {
        AppState.cameraStream.getTracks().forEach(track => track.stop());
        AppState.cameraStream = null;
      }

      scanLine.classList.add('hidden');
      badgeRec.classList.add('hidden');
      badgeStreamStatus.textContent = 'Paused';

      const statFace = document.getElementById('stat-face-detected');
      if (statFace) {
        statFace.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-600"></span><span>No</span>`;
        statFace.className = 'font-bold text-slate-500 flex items-center gap-1';
      }

      showToast('Stream Paused', 'Session recording frozen. You may now save this session to History.', 'info');
    });
  }

  // Save Session
  if (btnSaveSession) {
    btnSaveSession.addEventListener('click', () => {
      const durationStr = document.getElementById('stat-session-timer').textContent || '00:30';
      const score = AppState.currentLiveScore || 24;
      
      let label = 'Truthful';
      let labelClass = 'text-emerald-400 bg-emerald-950/80 border-emerald-500/50';
      if (score >= 70) {
        label = 'Likely Deceptive';
        labelClass = 'text-red-400 bg-red-950/80 border-red-500/50';
      } else if (score >= 40) {
        label = 'Suspicious';
        labelClass = 'text-amber-400 bg-amber-950/80 border-amber-500/50';
      }

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);
      const newSession = {
        id: `SES-${Math.floor(10000 + Math.random() * 90000)}`,
        date: dateStr,
        source: "Live Stream",
        sourceType: "live",
        duration: durationStr,
        durationSec: 45,
        avgScore: score,
        peakScore: Math.min(100, score + 14),
        label: label,
        labelClass: labelClass,
        cues: AppState.currentLiveCues.length > 0 ? AppState.currentLiveCues : [
          { time: "00:08", text: "AU12 Zygomatic major smile engagement", severity: "emerald" },
          { time: "00:19", text: "AU4 Micro-brow furrow (Cognitive retrieval)", severity: "amber" }
        ],
        timeline: AppState.currentScoresHistory.length > 0 ? AppState.currentScoresHistory.slice(-15) : [20, 22, 28, 32, 25, 29, 34, 30]
      };

      const sessions = getStoredSessions();
      sessions.unshift(newSession);
      saveStoredSessions(sessions);
      renderHistoryTable();

      btnSaveSession.disabled = true;
      showToast('Session Saved', `Session ${newSession.id} saved to forensic database (POST /api/sessions).`, 'success');
    });
  }
}

function updateSessionTimer() {
  if (!AppState.sessionStartTime) return;
  const elapsedSec = Math.floor((Date.now() - AppState.sessionStartTime) / 1000);
  const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');
  const timerElem = document.getElementById('stat-session-timer');
  if (timerElem) timerElem.textContent = `${mins}:${secs}`;
}

// =============================================================================
// 5. FACIAL LANDMARK & SYNTHETIC MESH CANVAS RENDERER
// =============================================================================
function renderLandmarkLoop(timestamp) {
  const canvas = document.getElementById('overlay-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Calculate real FPS
    AppState.frameCount++;
    if (Date.now() - AppState.lastFpsCheck >= 1000) {
      AppState.fps = (AppState.frameCount * 1000) / (Date.now() - AppState.lastFpsCheck);
      AppState.frameCount = 0;
      AppState.lastFpsCheck = Date.now();
      const fpsElem = document.getElementById('stat-fps');
      if (fpsElem) {
        fpsElem.textContent = AppState.cameraActive ? AppState.fps.toFixed(1) : '0.0';
      }
    }

    ctx.clearRect(0, 0, width, height);

    if (AppState.cameraActive) {
      // Draw Face HUD tracking box & 468 landmark mesh points
      drawFacialMesh(ctx, width, height, timestamp);
    }
  }

  requestAnimationFrame(renderLandmarkLoop);
}

function drawFacialMesh(ctx, width, height, time) {
  const cx = width / 2;
  const cy = height / 2 + 10;
  const rx = 110;
  const ry = 145;

  // Small organic oscillation
  const oscX = Math.sin(time / 600) * 8;
  const oscY = Math.cos(time / 800) * 5;
  const centerX = cx + oscX;
  const centerY = cy + oscY;

  // Face Detection Bounding Box
  ctx.save();
  ctx.strokeStyle = '#22D3EE';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 4]);

  const boxX = centerX - rx - 18;
  const boxY = centerY - ry - 25;
  const boxW = (rx * 2) + 36;
  const boxH = (ry * 2) + 50;

  ctx.strokeRect(boxX, boxY, boxW, boxH);
  ctx.setLineDash([]);

  // Corner bracket accents
  const cornerSize = 14;
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 3;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + cornerSize);
  ctx.lineTo(boxX, boxY);
  ctx.lineTo(boxX + cornerSize, boxY);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(boxX + boxW - cornerSize, boxY);
  ctx.lineTo(boxX + boxW, boxY);
  ctx.lineTo(boxX + boxW, boxY + cornerSize);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + boxH - cornerSize);
  ctx.lineTo(boxX, boxY + boxH);
  ctx.lineTo(boxX + cornerSize, boxY + boxH);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(boxX + boxW - cornerSize, boxY + boxH);
  ctx.lineTo(boxX + boxW, boxY + boxH);
  ctx.lineTo(boxX + boxW, boxY + boxH - cornerSize);
  ctx.stroke();

  // Bounding Box Tag
  ctx.fillStyle = '#0B0F14';
  ctx.fillRect(boxX, boxY - 20, 140, 18);
  ctx.strokeStyle = '#1E2733';
  ctx.strokeRect(boxX, boxY - 20, 140, 18);
  ctx.fillStyle = '#22D3EE';
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillText('FACE_01: 98.4% CONF', boxX + 6, boxY - 7);

  // Mesh wireframe lines
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
  ctx.lineWidth = 0.8;

  // Outer Oval
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Vertical center symmetry axis
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - ry);
  ctx.lineTo(centerX, centerY + ry);
  ctx.stroke();

  // Eye line & mouth horizontal guides
  const eyeY = centerY - 25;
  const noseY = centerY + 15;
  const mouthY = centerY + 65;

  // Eyebrows
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
  ctx.lineWidth = 2;
  // Left brow
  ctx.beginPath();
  ctx.moveTo(centerX - 65, eyeY - 20);
  ctx.quadraticCurveTo(centerX - 35, eyeY - 28 + (AppState.currentLiveScore > 50 ? -4 : 0), centerX - 12, eyeY - 18);
  ctx.stroke();
  // Right brow
  ctx.beginPath();
  ctx.moveTo(centerX + 12, eyeY - 18);
  ctx.quadraticCurveTo(centerX + 35, eyeY - 28, centerX + 65, eyeY - 20);
  ctx.stroke();

  // Eyes
  ctx.strokeStyle = '#22D3EE';
  ctx.lineWidth = 1.5;
  // Left Eye
  ctx.beginPath();
  ctx.ellipse(centerX - 38, eyeY, 18, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Left Pupil & Gaze vector
  ctx.fillStyle = '#22D3EE';
  ctx.beginPath();
  const gazeShift = (AppState.currentLiveScore > 60) ? 4 : 0;
  ctx.arc(centerX - 38 + gazeShift, eyeY - 1, 4, 0, Math.PI * 2);
  ctx.fill();

  // Right Eye
  ctx.beginPath();
  ctx.ellipse(centerX + 38, eyeY, 18, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Right Pupil
  ctx.beginPath();
  ctx.arc(centerX + 38 + gazeShift, eyeY - 1, 4, 0, Math.PI * 2);
  ctx.fill();

  // Nose Bridge & Tip
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
  ctx.beginPath();
  ctx.moveTo(centerX, eyeY);
  ctx.lineTo(centerX - 6, noseY);
  ctx.lineTo(centerX + 6, noseY);
  ctx.closePath();
  ctx.stroke();

  // Mouth & Lips (FACS AU12 / AU15 dynamic shape)
  ctx.strokeStyle = AppState.currentLiveScore > 65 ? '#EF4444' : '#22D3EE';
  ctx.lineWidth = 1.8;
  const mouthCurve = AppState.currentLiveScore > 60 ? -3 : 4; // micro-depressor vs smile
  ctx.beginPath();
  ctx.moveTo(centerX - 34, mouthY);
  ctx.quadraticCurveTo(centerX, mouthY + mouthCurve, centerX + 34, mouthY);
  ctx.stroke();

  // Landmark Points (Dense 68 / 468 points constellation simulation)
  ctx.fillStyle = 'rgba(34, 211, 238, 0.85)';
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    const ptX = centerX + Math.cos(angle) * (rx * (0.4 + (i % 5) * 0.15));
    const ptY = centerY + Math.sin(angle) * (ry * (0.4 + (i % 4) * 0.16));
    ctx.fillRect(ptX - 1, ptY - 1, 2, 2);
  }

  // Draw AU trigger highlights if high deception
  if (AppState.currentLiveScore > 50) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    // AU4 furrow zone
    ctx.fillRect(centerX - 15, eyeY - 26, 30, 12);
    // AU15 lip corner zone
    ctx.fillRect(centerX - 42, mouthY - 4, 12, 12);
    ctx.fillRect(centerX + 30, mouthY - 4, 12, 12);
  }

  ctx.restore();

  // Update HUD text
  const statFace = document.getElementById('stat-face-detected');
  if (statFace) {
    statFace.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span><span class="text-emerald-400">Yes (Tracked)</span>`;
    statFace.className = 'font-bold text-emerald-400 flex items-center gap-1';
  }

  const statConf = document.getElementById('stat-confidence');
  if (statConf) {
    statConf.textContent = '98.4%';
  }
}

// =============================================================================
// 6. LIVE TELEMETRY SIMULATION ENGINE (GAUGE, EMOTIONS, CUES)
// =============================================================================
function startLiveTelemetryEngine() {
  clearInterval(AppState.liveAnalysisInterval);

  // Pool of realistic Action Unit cue alerts
  const cueLibrary = [
    { text: "Lip Press & Corner Retraction (AU14)", severity: "red", desc: "Concealed tension marker" },
    { text: "Gaze Aversion (Right Upper quadrant)", severity: "amber", desc: "Cognitive load construction" },
    { text: "Rapid Eyebrow Flash (AU1+2)", severity: "emerald", desc: "Authentic spontaneous surprise" },
    { text: "Unilateral Lip Depressor (AU15)", severity: "red", desc: "Fleeting suppressed sorrow/hesitation" },
    { text: "Accelerated Blink Cadence (>45/min)", severity: "amber", desc: "Autonomic sympathetic surge" },
    { text: "Zygomatic Contraction (AU12)", severity: "emerald", desc: "Genuine bilateral smile engagement" },
    { text: "Nose Wrinkle (AU9 micro-disgust)", severity: "red", desc: "Involuntary rejection reflex" },
    { text: "Pupil Dilation Transient (+2.2mm)", severity: "amber", desc: "Heightened mental processing load" }
  ];

  AppState.liveAnalysisInterval = setInterval(() => {
    if (!AppState.cameraActive) return;

    // Simulate subtle dynamic fluctuation in score
    const targetDelta = (Math.random() - 0.48) * 6;
    AppState.currentLiveScore = Math.max(5, Math.min(96, Math.round(AppState.currentLiveScore + targetDelta)));
    AppState.currentScoresHistory.push(AppState.currentLiveScore);

    // Update Deception Semicircle Gauge
    updateDeceptionGauge(AppState.currentLiveScore);

    // Update Rolling Line Chart
    if (AppState.scoreTimelineChart) {
      const chart = AppState.scoreTimelineChart;
      const now = new Date();
      const timeLabel = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      chart.data.labels.push(timeLabel);
      chart.data.datasets[0].data.push(AppState.currentLiveScore);

      // Keep only last 25 points
      if (chart.data.labels.length > 25) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      chart.update('none');
    }

    // Update Emotion Spectrum Bar Chart
    if (AppState.emotionChart) {
      updateLiveEmotions();
    }

    // Occasionally push a new cue alert (every ~4-6 seconds)
    if (Math.random() < 0.35) {
      const randomCue = cueLibrary[Math.floor(Math.random() * cueLibrary.length)];
      pushCueAlert(randomCue);
    }
  }, 1000);
}

function updateDeceptionGauge(score) {
  const gaugePath = document.getElementById('gauge-progress-path');
  const gaugeNeedle = document.getElementById('gauge-needle-group');
  const scoreValue = document.getElementById('gauge-score-value');
  const labelBadge = document.getElementById('deception-label');

  if (!gaugePath || !gaugeNeedle || !scoreValue || !labelBadge) return;

  scoreValue.textContent = `${score}%`;

  // Arc length is 251.2 for radius 80
  const maxDash = 251.2;
  const progressOffset = maxDash - (maxDash * (score / 100));
  gaugePath.style.strokeDashoffset = progressOffset;

  // Needle angle: -90deg is 0%, 90deg is 100%
  const needleAngle = -90 + (score * 1.8);
  gaugeNeedle.style.transform = `rotate(${needleAngle}deg)`;

  // Update label and color
  if (score < 40) {
    labelBadge.textContent = 'TRUTHFUL';
    labelBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 tracking-wider';
    scoreValue.className = 'text-3xl font-extrabold font-mono text-emerald-400 tracking-tight';
  } else if (score < 70) {
    labelBadge.textContent = 'SUSPICIOUS';
    labelBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-950/80 border border-amber-500/50 text-amber-400 tracking-wider';
    scoreValue.className = 'text-3xl font-extrabold font-mono text-amber-400 tracking-tight';
  } else {
    labelBadge.textContent = 'LIKELY DECEPTIVE';
    labelBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-red-950/80 border border-red-500/50 text-red-400 tracking-wider animate-pulse';
    scoreValue.className = 'text-3xl font-extrabold font-mono text-red-400 tracking-tight';
  }
}

function updateLiveEmotions() {
  const chart = AppState.emotionChart;
  if (!chart) return;

  // 8 Emotions: Happy, Sad, Angry, Fear, Surprise, Disgust, Contempt, Neutral
  let happy = 10, sad = 5, angry = 3, fear = 4, surprise = 8, disgust = 2, contempt = 2, neutral = 66;

  if (AppState.currentLiveScore > 65) {
    contempt = Math.floor(18 + Math.random() * 15);
    fear = Math.floor(15 + Math.random() * 12);
    angry = Math.floor(12 + Math.random() * 8);
    disgust = Math.floor(10 + Math.random() * 10);
    neutral = Math.max(10, 100 - (happy + sad + angry + fear + surprise + disgust + contempt));
  } else if (AppState.currentLiveScore > 40) {
    fear = Math.floor(12 + Math.random() * 8);
    contempt = Math.floor(8 + Math.random() * 6);
    neutral = Math.floor(45 + Math.random() * 10);
  } else {
    happy = Math.floor(18 + Math.random() * 12);
    neutral = Math.floor(65 + Math.random() * 10);
  }

  chart.data.datasets[0].data = [happy, sad, angry, fear, surprise, disgust, contempt, neutral];
  chart.update('none');

  // Dominant emotion indicator
  const emotions = [
    { name: 'Happy', val: happy },
    { name: 'Sad', val: sad },
    { name: 'Angry', val: angry },
    { name: 'Fear', val: fear },
    { name: 'Surprise', val: surprise },
    { name: 'Disgust', val: disgust },
    { name: 'Contempt', val: contempt },
    { name: 'Neutral', val: neutral }
  ];
  emotions.sort((a, b) => b.val - a.val);
  const domElem = document.getElementById('dominant-emotion-label');
  if (domElem) {
    domElem.textContent = `${emotions[0].name} (${emotions[0].val}%)`;
  }
}

function pushCueAlert(cue) {
  const list = document.getElementById('cue-alerts');
  if (!list) return;

  const now = new Date();
  const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  AppState.currentLiveCues.unshift({
    time: timeStr,
    text: cue.text,
    severity: cue.severity
  });
  if (AppState.currentLiveCues.length > 20) AppState.currentLiveCues.pop();

  const dotColor = cue.severity === 'red' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : (cue.severity === 'amber' ? 'bg-amber-400' : 'bg-emerald-400');

  const item = document.createElement('div');
  item.className = 'cue-item flex items-center justify-between p-2 rounded-xl bg-[#0E141D] border border-[#1E2733] text-xs transform transition-all duration-300 animate-fade-in hover:border-slate-700';
  item.innerHTML = `
    <div class="flex items-center space-x-2.5">
      <span class="w-2 h-2 rounded-full ${dotColor} flex-shrink-0"></span>
      <div>
        <div class="font-medium text-slate-200">${cue.text}</div>
        <div class="text-[10px] text-slate-400 font-mono">${cue.desc}</div>
      </div>
    </div>
    <span class="text-[10px] font-mono text-slate-400 bg-[#121821] px-1.5 py-0.5 rounded border border-[#1E2733]">${timeStr}</span>
  `;

  list.insertBefore(item, list.firstChild);
  if (list.children.length > 8) {
    list.lastChild.remove();
  }
}

// =============================================================================
// 7. CHART INITIALIZATION
// =============================================================================
function initCharts() {
  Chart.defaults.color = '#94A3B8';
  Chart.defaults.font.family = "'JetBrains Mono', monospace";

  // Chart 1: Live Score Timeline
  const ctxTimeline = document.getElementById('score-timeline');
  if (ctxTimeline) {
    AppState.scoreTimelineChart = new Chart(ctxTimeline, {
      type: 'line',
      data: {
        labels: ['00:00', '00:02', '00:04', '00:06', '00:08', '00:10', '00:12', '00:14'],
        datasets: [{
          label: 'Deception Score %',
          data: [15, 18, 16, 22, 28, 25, 20, 18],
          borderColor: '#22D3EE',
          backgroundColor: 'rgba(34, 211, 238, 0.1)',
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0B0F14',
            titleColor: '#22D3EE',
            borderColor: '#1E2733',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `Score: ${ctx.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: 'rgba(30, 39, 51, 0.6)' },
            ticks: { stepSize: 25, font: { size: 9 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 9 }, maxTicksLimit: 6 }
          }
        }
      }
    });
  }

  // Chart 2: Live Emotion Spectrum Bar Chart (8 emotions)
  const ctxEmotions = document.getElementById('emotion-chart');
  if (ctxEmotions) {
    AppState.emotionChart = new Chart(ctxEmotions, {
      type: 'bar',
      data: {
        labels: ['Happy', 'Sad', 'Angry', 'Fear', 'Surprise', 'Disgust', 'Contempt', 'Neutral'],
        datasets: [{
          data: [12, 4, 3, 6, 8, 2, 4, 76],
          backgroundColor: [
            '#10B981', // Happy - Green
            '#38BDF8', // Sad - Blue
            '#EF4444', // Angry - Red
            '#F59E0B', // Fear - Amber
            '#A855F7', // Surprise - Purple
            '#EC4899', // Disgust - Pink
            '#E11D48', // Contempt - Crimson
            '#64748B'  // Neutral - Slate
          ],
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0B0F14',
            borderColor: '#1E2733',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: 'rgba(30, 39, 51, 0.6)' },
            ticks: { stepSize: 50, font: { size: 8 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 9 } }
          }
        }
      }
    });
  }

  // Chart 3: Upload Per-Frame Timeline Chart
  const ctxFrame = document.getElementById('frame-timeline');
  if (ctxFrame) {
    // Generate realistic per-frame wave data
    const frameLabels = [];
    const frameData = [];
    for (let f = 0; f <= 720; f += 20) {
      frameLabels.push(`F${f}`);
      // Simulated curve with prominent peaks at frame 240-300
      let score = 25 + Math.sin(f / 40) * 12 + Math.cos(f / 80) * 8;
      if (f >= 220 && f <= 320) {
        score += 42; // Peak deception micro-burst
      } else if (f >= 500 && f <= 580) {
        score += 26; // Second suspicious rise
      }
      frameData.push(Math.round(Math.min(96, Math.max(8, score))));
    }

    AppState.uploadFrameChart = new Chart(ctxFrame, {
      type: 'line',
      data: {
        labels: frameLabels,
        datasets: [{
          label: 'Deception Likelihood',
          data: frameData,
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139, 92, 246, 0.12)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 6,
          segment: {
            borderColor: ctx => {
              const val = ctx.p1.parsed.y;
              if (val > 70) return '#EF4444';
              if (val > 40) return '#F59E0B';
              return '#10B981';
            }
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0B0F14',
            titleColor: '#22D3EE',
            borderColor: '#1E2733',
            borderWidth: 1,
            callbacks: {
              afterLabel: (ctx) => {
                if (ctx.parsed.y > 70) return 'Action Unit: AU4+AU15 Peak Burst';
                if (ctx.parsed.y > 40) return 'Action Unit: Gaze Aversion Spike';
                return 'Status: Baseline Concordance';
              }
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: 'rgba(30, 39, 51, 0.6)' },
            ticks: { font: { size: 10 } }
          },
          x: {
            grid: { color: 'rgba(30, 39, 51, 0.3)' },
            ticks: { font: { size: 9 }, maxTicksLimit: 12 }
          }
        }
      }
    });
  }

  // Chart 4: Metrics Class Distribution Chart
  const ctxClassDist = document.getElementById('class-distribution-chart');
  if (ctxClassDist) {
    AppState.classDistributionChart = new Chart(ctxClassDist, {
      type: 'bar',
      data: {
        labels: ['Truthful Control', 'Suspicious Inconclusive', 'Deceptive Outlier'],
        datasets: [{
          data: [579, 419, 422],
          backgroundColor: [
            'rgba(16, 185, 129, 0.85)',
            'rgba(245, 158, 11, 0.85)',
            'rgba(239, 68, 68, 0.85)'
          ],
          borderColor: ['#10B981', '#F59E0B', '#EF4444'],
          borderWidth: 1,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0B0F14',
            borderColor: '#1E2733',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `${ctx.parsed.y} Benchmark Video Samples`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(30, 39, 51, 0.6)' },
            ticks: { font: { size: 10 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 } }
          }
        }
      }
    });
  }
}

// =============================================================================
// 8. SCREEN 3: UPLOAD ANALYSIS CONTROLLER
// =============================================================================
function initUploadScreen() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const progressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('upload-progress');
  const percentageLabel = document.getElementById('upload-percentage');
  const statusLabel = document.getElementById('upload-status-text');
  const scrubber = document.getElementById('frame-scrubber');
  const frameIndicator = document.getElementById('current-frame-indicator');
  const btnPlayScrub = document.getElementById('btn-scrub-play');
  const btnSampleDeceptive = document.getElementById('btn-load-sample-interview');
  const btnSampleTruth = document.getElementById('btn-load-sample-truth');
  const btnSaveUpload = document.getElementById('btn-save-uploaded-session');

  // Trigger file open
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-cyan-400', 'bg-[#121821]');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-cyan-400', 'bg-[#121821]');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-cyan-400', 'bg-[#121821]');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileProcessing(e.dataTransfer.files[0].name);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileProcessing(e.target.files[0].name);
      }
    });
  }

  // Quick sample buttons
  if (btnSampleDeceptive) {
    btnSampleDeceptive.addEventListener('click', (e) => {
      e.stopPropagation();
      handleFileProcessing("casme2_subject42_deceptive_clip.mp4", 78.4, 91.2, "Likely Deceptive");
    });
  }

  if (btnSampleTruth) {
    btnSampleTruth.addEventListener('click', (e) => {
      e.stopPropagation();
      handleFileProcessing("samm_control_subject18_truthful.mp4", 19.8, 32.4, "Truthful");
    });
  }

  // Simulated File Processing Pipeline
  function handleFileProcessing(fileName, targetAvg = 58.4, targetPeak = 82.1, targetLabel = "Suspicious") {
    progressContainer.classList.remove('hidden');
    let percent = 0;
    progressBar.style.width = '0%';
    percentageLabel.textContent = '0%';
    statusLabel.textContent = `Ingesting ${fileName} (POST /api/analyze/video)...`;

    const interval = setInterval(() => {
      percent += 15;
      if (percent >= 100) {
        percent = 100;
        clearInterval(interval);
        progressBar.style.width = '100%';
        percentageLabel.textContent = '100%';
        statusLabel.textContent = 'Action Unit tensor decomposition complete.';

        setTimeout(() => {
          progressContainer.classList.add('hidden');
          showToast('Analysis Complete', `Forensic timeline ready for ${fileName}.`, 'success');
          updateUploadResults(targetAvg, targetPeak, targetLabel);
          drawAnnotatedPreview();
        }, 500);
      } else {
        progressBar.style.width = `${percent}%`;
        percentageLabel.textContent = `${percent}%`;
        if (percent === 45) {
          statusLabel.textContent = 'Tracking 468 3D landmarks & head pose...';
        } else if (percent === 75) {
          statusLabel.textContent = 'Extracting FACS micro-expression Action Units...';
        }
      }
    }, 180);
  }

  function updateUploadResults(avg, peak, label) {
    const avgElem = document.getElementById('upload-avg-score');
    const peakElem = document.getElementById('upload-peak-score');
    const labelElem = document.getElementById('upload-final-label');

    if (avgElem) avgElem.textContent = `${avg}%`;
    if (peakElem) peakElem.textContent = `${peak}%`;
    if (labelElem) {
      labelElem.textContent = label.toUpperCase();
      if (label === 'Truthful') {
        labelElem.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 tracking-wider';
      } else if (label === 'Likely Deceptive') {
        labelElem.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-red-950/80 border border-red-500/50 text-red-400 tracking-wider';
      } else {
        labelElem.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-950/80 border border-amber-500/50 text-amber-400 tracking-wider';
      }
    }
  }

  // Frame Scrubber interaction
  if (scrubber && frameIndicator) {
    scrubber.addEventListener('input', (e) => {
      frameIndicator.textContent = `#${e.target.value} / 720`;
      drawAnnotatedPreview(parseInt(e.target.value));
    });
  }

  // Save Uploaded Video Session
  if (btnSaveUpload) {
    btnSaveUpload.addEventListener('click', () => {
      const newSession = {
        id: `SES-${Math.floor(10000 + Math.random() * 90000)}`,
        date: new Date().toISOString().slice(0, 10) + ' ' + new Date().toTimeString().slice(0, 5),
        source: "Uploaded Video",
        sourceType: "video",
        duration: "00:12",
        durationSec: 12,
        avgScore: 58.4,
        peakScore: 82.1,
        label: "Suspicious",
        labelClass: "text-amber-400 bg-amber-950/80 border-amber-500/50",
        cues: [
          { time: "00:04", text: "AU4 Brow Furrow + AU15 Lip Depressor", severity: "red" },
          { time: "00:08", text: "Gaze Aversion with swallow reflex", severity: "amber" },
          { time: "00:11", text: "Elevated blink rate cadence", severity: "amber" }
        ],
        timeline: [25, 30, 42, 68, 82, 74, 55, 48, 52, 60]
      };

      const sessions = getStoredSessions();
      sessions.unshift(newSession);
      saveStoredSessions(sessions);
      renderHistoryTable();
      showToast('Archived in History', `Upload run saved as session ${newSession.id}.`, 'success');
    });
  }
}

// Draw realistic cybernetic annotated facial preview on upload preview canvas
function drawAnnotatedPreview(frameNumber = 248) {
  const canvas = document.getElementById('annotated-preview');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Clear
  ctx.fillStyle = '#080B0F';
  ctx.fillRect(0, 0, w, h);

  // Background grid
  ctx.strokeStyle = 'rgba(30, 39, 51, 0.4)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw subject silhouette & facial landmarks
  const cx = w / 2;
  const cy = h / 2 - 10;
  const rx = 90;
  const ry = 120;

  // Face Oval
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Bounding Box
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - rx - 15, cy - ry - 20, (rx * 2) + 30, (ry * 2) + 40);

  // Eyes & brows
  ctx.strokeStyle = '#22D3EE';
  ctx.beginPath();
  ctx.ellipse(cx - 32, cy - 20, 14, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 32, cy - 20, 14, 7, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Highlight AU4 Brow Lowerer if around peak frame 248
  const isPeak = frameNumber >= 200 && frameNumber <= 320;
  ctx.strokeStyle = isPeak ? '#EF4444' : '#22D3EE';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy - 35);
  ctx.lineTo(cx - 12, cy - 30);
  ctx.moveTo(cx + 12, cy - 30);
  ctx.lineTo(cx + 52, cy - 35);
  ctx.stroke();

  // Mouth
  ctx.strokeStyle = isPeak ? '#EF4444' : '#22D3EE';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy + 50);
  ctx.quadraticCurveTo(cx, cy + (isPeak ? 46 : 55), cx + 28, cy + 50);
  ctx.stroke();

  // Optical flow motion arrows
  if (isPeak) {
    ctx.fillStyle = '#EF4444';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText('⚡ MICRO-BURST DETECTED (AU4 + AU15)', cx - rx, cy - ry - 26);

    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    // Draw vector arrow from lip corner
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy + 50);
    ctx.lineTo(cx - 42, cy + 62);
    ctx.stroke();
  }

  // Optical flow telemetry overlay
  ctx.fillStyle = '#22D3EE';
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillText(`FRAME #${frameNumber} | CONF: 97.8% | ACTION_UNIT_WEIGHT: ${isPeak ? '0.88' : '0.24'}`, 14, 24);
}

// =============================================================================
// 9. SCREEN 4: HISTORY & SESSION DETAIL DRAWER
// =============================================================================
function initHistoryScreen() {
  const searchInput = document.getElementById('search-sessions');
  const filterSource = document.getElementById('filter-source');
  const filterLabel = document.getElementById('filter-label');
  const btnExportAll = document.getElementById('btn-export-all-history');

  if (searchInput) searchInput.addEventListener('input', renderHistoryTable);
  if (filterSource) filterSource.addEventListener('change', renderHistoryTable);
  if (filterLabel) filterLabel.addEventListener('change', renderHistoryTable);

  if (btnExportAll) {
    btnExportAll.addEventListener('click', () => {
      const sessions = getStoredSessions();
      const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `truthlens_audit_sessions_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export Generated', 'Exported JSON audit log of all recorded sessions.', 'success');
    });
  }

  initSessionDrawer();
  renderHistoryTable();
}

function renderHistoryTable() {
  const tbody = document.getElementById('sessions-tbody');
  const emptyState = document.getElementById('history-empty-state');
  const searchVal = (document.getElementById('search-sessions')?.value || '').toLowerCase().trim();
  const sourceFilter = document.getElementById('filter-source')?.value || 'all';
  const labelFilter = document.getElementById('filter-label')?.value || 'all';

  if (!tbody) return;

  const allSessions = getStoredSessions();
  const filtered = allSessions.filter(item => {
    // Search match
    const matchSearch = !searchVal || 
      item.id.toLowerCase().includes(searchVal) || 
      item.date.toLowerCase().includes(searchVal) || 
      item.source.toLowerCase().includes(searchVal) ||
      item.label.toLowerCase().includes(searchVal);

    // Source match
    const matchSource = sourceFilter === 'all' || item.sourceType === sourceFilter;

    // Label match
    const matchLabel = labelFilter === 'all' || item.label.toLowerCase() === labelFilter.toLowerCase();

    return matchSearch && matchSource && matchLabel;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  filtered.forEach(session => {
    const tr = document.createElement('tr');
    tr.className = 'table-row-hover text-slate-300 border-b border-[#1E2733]/60';

    // Source badge
    let sourceIcon = `<svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    if (session.sourceType === 'video') {
      sourceIcon = `<svg class="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
    } else if (session.sourceType === 'image') {
      sourceIcon = `<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    }

    // Label badge styling
    let labelBadgeClass = 'text-emerald-400 bg-emerald-950/80 border-emerald-500/50';
    if (session.label === 'Likely Deceptive') {
      labelBadgeClass = 'text-red-400 bg-red-950/80 border-red-500/50';
    } else if (session.label === 'Suspicious') {
      labelBadgeClass = 'text-amber-400 bg-amber-950/80 border-amber-500/50';
    }

    tr.innerHTML = `
      <td class="py-3.5 px-4 font-mono font-medium text-white">
        ${session.date}
        <span class="block text-[10px] text-slate-500 font-normal">${session.id}</span>
      </td>
      <td class="py-3.5 px-4">
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#121821] border border-[#1E2733] text-[11px] text-slate-300">
          ${sourceIcon}
          ${session.source}
        </span>
      </td>
      <td class="py-3.5 px-4 text-slate-300 font-mono">${session.duration}</td>
      <td class="py-3.5 px-4">
        <span class="font-bold font-mono text-white text-sm">${session.avgScore}%</span>
        <span class="block text-[10px] text-slate-500">Peak ${session.peakScore}%</span>
      </td>
      <td class="py-3.5 px-4">
        <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${labelBadgeClass}">
          ${session.label}
        </span>
      </td>
      <td class="py-3.5 px-4 text-right">
        <div class="inline-flex items-center space-x-2">
          <button class="btn-view-session px-2.5 py-1 rounded-lg bg-[#17202C] hover:bg-[#1E2733] border border-[#2A3647] hover:border-cyan-500/50 text-cyan-300 text-xs transition" data-id="${session.id}">
            View
          </button>
          <button class="btn-delete-session p-1 rounded-lg hover:bg-red-950/50 text-slate-400 hover:text-red-400 transition" data-id="${session.id}" title="Delete record">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach click listeners for View and Delete
  tbody.querySelectorAll('.btn-view-session').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      openSessionDrawer(id);
    });
  });

  tbody.querySelectorAll('.btn-delete-session').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      deleteSession(id);
    });
  });
}

function deleteSession(id) {
  if (confirm(`Are you sure you want to delete session record ${id}?`)) {
    let sessions = getStoredSessions();
    sessions = sessions.filter(s => s.id !== id);
    saveStoredSessions(sessions);
    renderHistoryTable();
    showToast('Session Removed', `Session ${id} deleted (DELETE /api/sessions/${id}).`, 'info');
  }
}

// Drawer Controller
function initSessionDrawer() {
  const drawer = document.getElementById('session-detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const panel = document.getElementById('drawer-panel');
  const btnClose = document.getElementById('btn-close-drawer');
  const btnDelete = document.getElementById('drawer-delete-btn');
  const btnExport = document.getElementById('drawer-export-btn');

  function closeDrawer() {
    backdrop.classList.add('opacity-0');
    panel.classList.add('translate-x-full');
    setTimeout(() => {
      drawer.classList.add('pointer-events-none');
    }, 300);
  }

  if (btnClose) btnClose.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      if (AppState.selectedSession) {
        deleteSession(AppState.selectedSession.id);
        closeDrawer();
      }
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      if (AppState.selectedSession) {
        const blob = new Blob([JSON.stringify(AppState.selectedSession, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `truthlens_report_${AppState.selectedSession.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Report Downloaded', `Exported telemetry dossier for ${AppState.selectedSession.id}.`, 'success');
      }
    });
  }
}

function openSessionDrawer(sessionId) {
  const sessions = getStoredSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return;

  AppState.selectedSession = session;

  const drawer = document.getElementById('session-detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const panel = document.getElementById('drawer-panel');

  // Populate drawer fields
  document.getElementById('drawer-session-id').textContent = session.id;
  document.getElementById('drawer-badge-source').textContent = session.source;
  document.getElementById('drawer-timestamp').textContent = session.date;
  document.getElementById('drawer-avg-score').textContent = `${session.avgScore}%`;
  document.getElementById('drawer-duration').textContent = session.duration;

  const labelElem = document.getElementById('drawer-badge-label');
  labelElem.textContent = session.label;
  if (session.label === 'Likely Deceptive') {
    labelElem.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-red-950/80 border border-red-500/50 text-red-400';
  } else if (session.label === 'Suspicious') {
    labelElem.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-950/80 border border-amber-500/50 text-amber-400';
  } else {
    labelElem.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-400';
  }

  // Populate Cue list
  const cueList = document.getElementById('drawer-cue-list');
  cueList.innerHTML = '';
  if (session.cues && session.cues.length > 0) {
    session.cues.forEach(c => {
      const dotColor = c.severity === 'red' ? 'bg-red-500' : (c.severity === 'amber' ? 'bg-amber-400' : 'bg-emerald-400');
      const li = document.createElement('div');
      li.className = 'p-2 rounded-lg bg-[#0E141D] border border-[#1E2733] flex items-center justify-between';
      li.innerHTML = `
        <span class="flex items-center gap-2 text-slate-200">
          <span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>
          ${c.text}
        </span>
        <span class="text-[10px] text-slate-500 font-mono">${c.time}</span>
      `;
      cueList.appendChild(li);
    });
  } else {
    cueList.innerHTML = `<div class="text-xs text-slate-500">No anomalous micro-expressions recorded.</div>`;
  }

  // Render Drawer Mini Chart
  const ctxDrawer = document.getElementById('drawer-timeline-chart');
  if (ctxDrawer) {
    if (AppState.drawerTimelineChart) {
      AppState.drawerTimelineChart.destroy();
    }

    const labels = session.timeline.map((_, i) => `${i * 10}s`);
    AppState.drawerTimelineChart = new Chart(ctxDrawer, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: session.timeline,
          borderColor: '#22D3EE',
          backgroundColor: 'rgba(34, 211, 238, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 100, ticks: { font: { size: 8 } }, grid: { color: 'rgba(30, 39, 51, 0.4)' } },
          x: { ticks: { font: { size: 8 }, maxTicksLimit: 6 }, grid: { display: false } }
        }
      }
    });
  }

  // Slide drawer into view
  drawer.classList.remove('pointer-events-none');
  setTimeout(() => {
    backdrop.classList.remove('opacity-0');
    panel.classList.remove('translate-x-full');
  }, 10);
}

// =============================================================================
// 10. SCREEN 5: MODEL & METRICS CONTROLLER
// =============================================================================
function initMetricsScreen() {
  const btnToggleBanner = document.getElementById('btn-toggle-model-banner');
  const banner = document.getElementById('model-banner');
  const btnDismiss = document.getElementById('btn-dismiss-model-banner');

  if (btnToggleBanner && banner) {
    btnToggleBanner.addEventListener('click', () => {
      banner.classList.toggle('hidden');
    });
  }

  if (btnDismiss && banner) {
    btnDismiss.addEventListener('click', () => {
      banner.classList.add('hidden');
    });
  }
}
