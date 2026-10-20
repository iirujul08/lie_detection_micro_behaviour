import React, { useState } from 'react';
import { Eye, Play, Menu, X } from 'lucide-react';

export default function Navbar({ activeScreen, setActiveScreen, isBackendOnline, toggleBackendState }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'nav-link-home', target: 'home', label: 'Home' },
    { id: 'nav-link-live', target: 'live', label: 'Live Detection', isLive: true },
    { id: 'nav-link-upload', target: 'upload', label: 'Upload' },
    { id: 'nav-link-history', target: 'history', label: 'History', api: 'GET /api/sessions' },
    { id: 'nav-link-metrics', target: 'metrics', label: 'Metrics', api: 'GET /api/model-info' },
    { id: 'nav-link-about', target: 'about', label: 'About' },
  ];

  const handleNavClick = (target) => {
    setActiveScreen(target);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#1E2733] bg-[#0B0F14]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <button
          onClick={() => handleNavClick('home')}
          className="flex items-center space-x-3 group cursor-pointer focus:outline-none text-left"
          id="nav-brand-logo"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#22D3EE] to-[#8B5CF6] p-0.5 shadow-[0_0_15px_rgba(34,211,238,0.35)] group-hover:shadow-[0_0_20px_rgba(34,211,238,0.6)] transition duration-300">
            <div className="w-full h-full bg-[#0B0F14] rounded-[10px] flex items-center justify-center">
              <Eye className="w-5 h-5 text-[#22D3EE] group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              Truth<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6]">Lens</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-400 font-semibold uppercase tracking-wider">AI v2.4</span>
            </span>
            <span className="text-[10px] text-slate-400 -mt-1 hidden sm:block">Micro-Expression FACS Analytics</span>
          </div>
        </button>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
          {navLinks.map((item) => {
            const isActive = activeScreen === item.target;
            return (
              <button
                key={item.id}
                id={item.id}
                data-api={item.api}
                onClick={() => handleNavClick(item.target)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition border flex items-center gap-1.5 ${
                  isActive
                    ? 'nav-tab-active border-cyan-400/30'
                    : 'text-slate-300 hover:text-white border-transparent'
                }`}
              >
                {item.isLive && (
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Backend Status & Actions */}
        <div className="flex items-center space-x-3">
          {/* Backend Status Pill */}
          <div
            id="backend-status-pill"
            data-api="GET /api/health"
            onClick={toggleBackendState}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#121821] border border-[#1E2733] text-xs font-mono select-none cursor-pointer hover:border-slate-700 transition"
            title="Click to simulate Backend Online/Offline state"
          >
            <span
              id="backend-status-dot"
              className={`w-2 h-2 rounded-full ${
                isBackendOnline
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-status-pulse'
                  : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-status-pulse'
              }`}
            ></span>
            <span id="backend-status-text" className="text-slate-300 text-[11px] font-medium hidden sm:inline">
              Backend: {isBackendOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Quick Demo Live Button in header */}
          <button
            id="btn-header-quick-live"
            onClick={() => handleNavClick('live')}
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-slate-950 text-xs font-semibold shadow-[0_0_15px_rgba(34,211,238,0.3)] transition transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Camera</span>
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            id="btn-mobile-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-[#121821] border border-[#1E2733] text-slate-300 hover:text-white"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div id="mobile-nav-menu" className="md:hidden border-b border-[#1E2733] bg-[#0B0F14]/98 px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.target)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-[#121821]"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
