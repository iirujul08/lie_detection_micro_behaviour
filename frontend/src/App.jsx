import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import OfflineBanner from './components/OfflineBanner';
import ToastContainer from './components/Toast';
import Home from './pages/Home';
import LiveDetection from './pages/LiveDetection';
import UploadAnalysis from './pages/UploadAnalysis';
import History from './pages/History';
import Metrics from './pages/Metrics';
import About from './pages/About';
import { getHealth } from './api/client';

export default function App() {
  const [activeScreen, setActiveScreen] = useState('home');
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((title, message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const checkBackendHealth = useCallback(async () => {
    try {
      await getHealth();
      if (!isBackendOnline) {
        setIsBackendOnline(true);
        showToast('Backend Connected', 'FastAPI health check responded with status: 200 OK.', 'success');
      }
    } catch (err) {
      if (isBackendOnline) {
        setIsBackendOnline(false);
        showToast('Backend Offline', 'Cannot reach FastAPI at http://localhost:8000. Running in client simulation mode.', 'error');
      }
    }
  }, [isBackendOnline, showToast]);

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 15000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  const toggleBackendSimulation = () => {
    const newState = !isBackendOnline;
    setIsBackendOnline(newState);
    if (newState) {
      showToast('Simulated Online', 'FastAPI backend connection restored.', 'success');
    } else {
      showToast('Simulated Offline', 'FastAPI connection severed. Testing offline banners.', 'warning');
    }
  };

  return (
    <div className="bg-[#0B0F14] text-slate-200 min-h-screen flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative bg-grid-pattern">
      {/* Background Ambient Glow Accents */}
      <div className="fixed inset-0 pointer-events-none z-0 radial-glow-cyan"></div>
      <div className="fixed inset-0 pointer-events-none z-0 radial-glow-ambient"></div>

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Global Offline Banner */}
      <OfflineBanner
        isOffline={!isBackendOnline}
        onRetry={checkBackendHealth}
        onDismiss={() => setIsBackendOnline(true)}
      />

      {/* Sticky Top Navigation Bar */}
      <Navbar
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
        isBackendOnline={isBackendOnline}
        toggleBackendState={toggleBackendSimulation}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">
        {activeScreen === 'home' && <Home onNavigate={setActiveScreen} />}
        {activeScreen === 'live' && <LiveDetection onShowToast={showToast} />}
        {activeScreen === 'upload' && <UploadAnalysis onShowToast={showToast} />}
        {activeScreen === 'history' && <History onShowToast={showToast} />}
        {activeScreen === 'metrics' && <Metrics />}
        {activeScreen === 'about' && <About />}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
