import React, { useState, useEffect } from 'react';
import { Search, Trash2, Eye, Download, X, Play, Video, Image as ImageIcon } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis } from 'recharts';
import { getSessions, deleteSession } from '../api/client';

export default function History({ onShowToast }) {
  const [sessions, setSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchHistory = async () => {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (err) {
      console.warn('Failed to fetch sessions from backend:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete session record ${id}?`)) {
      try {
        await deleteSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
        if (selectedSession && selectedSession.id === id) {
          setDrawerOpen(false);
          setSelectedSession(null);
        }
        onShowToast('Session Removed', `Session ${id} deleted (DELETE /api/sessions/${id}).`, 'info');
      } catch (err) {
        onShowToast('Delete Error', `Could not delete session ${id}.`, 'error');
      }
    }
  };

  const handleOpenDrawer = (session) => {
    setSelectedSession(session);
    setDrawerOpen(true);
  };

  const handleExportJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Export Ready', `Downloaded JSON dossier ${filename}.`, 'success');
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = !searchTerm ||
      session.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.label.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSource = sourceFilter === 'all' || session.sourceType === sourceFilter;
    const matchesLabel = labelFilter === 'all' || session.label.toLowerCase() === labelFilter.toLowerCase();

    return matchesSearch && matchesSource && matchesLabel;
  });

  return (
    <section id="screen-history" className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-emerald-400"></span>
            Forensic Session Audit Trail
          </h2>
          <p className="text-sm text-slate-400">Archived biometric sessions, micro-expression telemetry, and assessment logs</p>
        </div>
        <button
          id="btn-export-all-history"
          onClick={() => handleExportJSON(sessions, `truthlens_audit_sessions_${Date.now()}.json`)}
          className="px-3.5 py-2 rounded-xl bg-[#17202C] hover:bg-[#1E2733] border border-[#2A3647] text-slate-200 text-xs font-medium transition flex items-center gap-2"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          <span>Export JSON</span>
        </button>
      </div>

      {/* Search & Filter Row */}
      <div className="glass-panel rounded-2xl p-4 border border-[#1E2733] flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            id="search-sessions"
            placeholder="Search by session ID, source, or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0B0F14] border border-[#1E2733] focus:border-cyan-400 focus:outline-none text-sm text-white placeholder-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span>Source:</span>
            <select
              id="filter-source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-[#0B0F14] border border-[#1E2733] rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="all">All Sources</option>
              <option value="live">Live Stream</option>
              <option value="video">Uploaded Video</option>
              <option value="image">Uploaded Image</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span>Label:</span>
            <select
              id="filter-label"
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="bg-[#0B0F14] border border-[#1E2733] rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="all">All Statuses</option>
              <option value="Truthful">Truthful</option>
              <option value="Suspicious">Suspicious</option>
              <option value="Likely Deceptive">Likely Deceptive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="glass-panel rounded-2xl border border-[#1E2733] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table id="sessions-table" data-api="GET /api/sessions" className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1E2733] bg-[#0E141D] text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 font-semibold">Date &amp; Time</th>
                <th className="py-3.5 px-4 font-semibold">Source</th>
                <th className="py-3.5 px-4 font-semibold">Duration</th>
                <th className="py-3.5 px-4 font-semibold">Average Score</th>
                <th className="py-3.5 px-4 font-semibold">Assessment</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="sessions-tbody" className="divide-y divide-[#1E2733] font-mono text-xs">
              {filteredSessions.map((session) => {
                let badgeClass = 'text-emerald-400 bg-emerald-950/80 border-emerald-500/50';
                if (session.label === 'Likely Deceptive') {
                  badgeClass = 'text-red-400 bg-red-950/80 border-red-500/50';
                } else if (session.label === 'Suspicious') {
                  badgeClass = 'text-amber-400 bg-amber-950/80 border-amber-500/50';
                }

                return (
                  <tr key={session.id} className="table-row-hover text-slate-300 border-b border-[#1E2733]/60">
                    <td className="py-3.5 px-4 font-mono font-medium text-white">
                      {session.date}
                      <span className="block text-[10px] text-slate-500 font-normal">{session.id}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#121821] border border-[#1E2733] text-[11px] text-slate-300">
                        {session.sourceType === 'live' && <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />}
                        {session.sourceType === 'video' && <Video className="w-3.5 h-3.5 text-violet-400" />}
                        {session.sourceType === 'image' && <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />}
                        {session.source}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono">{session.duration}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold font-mono text-white text-sm">{session.avgScore}%</span>
                      <span className="block text-[10px] text-slate-500">Peak {session.peakScore}%</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}`}>
                        {session.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-2">
                        <button
                          onClick={() => handleOpenDrawer(session)}
                          className="px-2.5 py-1 rounded-lg bg-[#17202C] hover:bg-[#1E2733] border border-[#2A3647] hover:border-cyan-500/50 text-cyan-300 text-xs transition"
                        >
                          View
                        </button>
                        <button
                          onClick={(e) => handleDelete(session.id, e)}
                          className="p-1 rounded-lg hover:bg-red-950/50 text-slate-400 hover:text-red-400 transition"
                          title="Delete record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredSessions.length === 0 && (
          <div id="history-empty-state" className="py-16 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-300">No sessions match your filter</p>
            <p className="text-xs text-slate-500">Run a Live Detection or analyze an uploaded video to generate records.</p>
          </div>
        )}
      </div>

      {/* Slide-out Session Detail Drawer */}
      <div
        id="session-detail-drawer"
        data-api="GET /api/sessions/{id}"
        className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ${
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          id="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          className={`drawer-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-auto">
          <div
            id="drawer-panel"
            className={`drawer-panel w-screen max-w-md bg-[#0B0F14] border-l border-[#1E2733] p-6 shadow-2xl flex flex-col justify-between overflow-y-auto transform transition-transform duration-300 ${
              drawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {selectedSession && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[#1E2733] pb-4">
                  <div>
                    <span id="drawer-session-id" className="text-xs font-mono text-cyan-400">{selectedSession.id}</span>
                    <h3 id="drawer-title" className="text-lg font-bold text-white">Session Telemetry Drilldown</h3>
                  </div>
                  <button
                    id="btn-close-drawer"
                    onClick={() => setDrawerOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg bg-[#121821] border border-[#1E2733]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span id="drawer-badge-source" className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#17202C] border border-[#1E2733] text-slate-300">
                    {selectedSession.source}
                  </span>
                  <span id="drawer-badge-label" className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-950/80 border border-amber-500/50 text-amber-400">
                    {selectedSession.label}
                  </span>
                  <span id="drawer-timestamp" className="text-xs font-mono text-slate-400 ml-auto">
                    {selectedSession.date}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#121821] border border-[#1E2733]">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Average Deception</span>
                    <span id="drawer-avg-score" className="text-xl font-bold font-mono text-white">{selectedSession.avgScore}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#121821] border border-[#1E2733]">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Duration</span>
                    <span id="drawer-duration" className="text-xl font-bold font-mono text-cyan-400">{selectedSession.duration}</span>
                  </div>
                </div>

                {/* Trajectory Chart in Drawer */}
                <div className="space-y-2">
                  <span className="text-xs font-mono text-slate-300">Deception Score Trajectory:</span>
                  <div className="h-32 w-full bg-[#121821] rounded-xl p-2 border border-[#1E2733]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={selectedSession.timeline.map((val, i) => ({ step: `${i * 10}s`, val }))}
                        margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                      >
                        <XAxis dataKey="step" stroke="#475569" fontSize={8} tickLine={false} />
                        <YAxis domain={[0, 100]} stroke="#475569" fontSize={8} tickLine={false} />
                        <Line type="monotone" dataKey="val" stroke="#22D3EE" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cue List in Drawer */}
                <div className="space-y-2">
                  <span className="text-xs font-mono text-slate-300">Action Unit Incident Log:</span>
                  <div id="drawer-cue-list" className="space-y-2 text-xs font-mono max-h-48 overflow-y-auto pr-1">
                    {selectedSession.cues.map((c, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-[#0E141D] border border-[#1E2733] flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-200">
                          <span className={`w-1.5 h-1.5 rounded-full ${c.severity === 'red' ? 'bg-red-500' : 'bg-amber-400'}`}></span>
                          {c.text}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{c.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Drawer Footer Controls */}
                <div className="border-t border-[#1E2733] pt-4 mt-6 flex items-center justify-between gap-3">
                  <button
                    id="drawer-delete-btn"
                    data-api="DELETE /api/sessions/{id}"
                    onClick={() => handleDelete(selectedSession.id)}
                    className="px-4 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Session</span>
                  </button>

                  <button
                    id="drawer-export-btn"
                    onClick={() => handleExportJSON(selectedSession, `truthlens_report_${selectedSession.id}.json`)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-slate-950 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Report</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </section>
  );
}
