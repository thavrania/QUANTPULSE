'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';

interface TerminalSessionItem {
  id: string;
  username: string;
  createdAt: number;
  lastActive: number;
  ip: string;
  userAgent: string;
  device: string;
  status: 'ACTIVE' | 'KILLED';
  killedAt?: number;
  killedBy?: string;
  isCurrent?: boolean;
}

export function ActiveSessionsModal() {
  const {
    isSessionsModalOpen,
    setIsSessionsModalOpen,
    setActiveSessionsCount,
    terminalLogout,
    showToast,
  } = useQuantPulse();

  const [sessions, setSessions] = useState<TerminalSessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [killingId, setKillingId] = useState<string | null>(null);
  const [isKillingAll, setIsKillingAll] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/sessions');
      const data = await res.json();
      if (data && data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        setCurrentSessionId(data.currentSessionId || null);
        if (typeof data.activeCount === 'number') {
          setActiveSessionsCount(data.activeCount);
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch active sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [setActiveSessionsCount]);

  useEffect(() => {
    if (!isSessionsModalOpen) return;
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [isSessionsModalOpen, fetchSessions]);

  const handleKillSession = async (sessionId: string, isCurrent = false) => {
    if (isCurrent) {
      if (confirm('Lock this workstation and sign out now?')) {
        await terminalLogout();
        setIsSessionsModalOpen(false);
      }
      return;
    }

    try {
      setKillingId(sessionId);
      const res = await fetch('/api/auth/sessions/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data && data.success) {
        showToast('Remote browser session killed successfully.', 'emerald');
        await fetchSessions();
      } else {
        showToast(data?.message || 'Failed to kill session', 'rose');
      }
    } catch (err: any) {
      showToast(`Error killing session: ${err.message}`, 'rose');
    } finally {
      setKillingId(null);
    }
  };

  const handleKillAllOthers = async () => {
    if (
      !confirm(
        'Terminate ALL other open browsers? Only this current browser will remain logged in.'
      )
    ) {
      return;
    }

    try {
      setIsKillingAll(true);
      const res = await fetch('/api/auth/sessions/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ killAllOthers: true }),
      });
      const data = await res.json();
      if (data && data.success) {
        showToast(
          `Killed ${data.killedCount ?? 'all'} remote browser session(s).`,
          'emerald'
        );
        await fetchSessions();
      } else {
        showToast(data?.message || 'Failed to terminate other sessions', 'rose');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'rose');
    } finally {
      setIsKillingAll(false);
    }
  };

  if (!isSessionsModalOpen) return null;

  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE');
  const remoteActiveSessions = activeSessions.filter((s) => !s.isCurrent);

  const formatRelativeTime = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 5) return 'Just now (live)';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    return `${diffHours}h ago`;
  };

  const formatAbsoluteTime = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-lg">
              🖥️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Active Browsers & Open Sessions</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  {activeSessions.length} {activeSessions.length === 1 ? 'Browser' : 'Browsers'} Open
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live monitoring of all workstations and devices currently running QuantPulse.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSessions}
              disabled={isLoading}
              className="text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1"
              title="Refresh session list"
            >
              <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSessionsModalOpen(false)}
              className="text-slate-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Global Action Banner */}
        <div className="px-5 py-3 bg-slate-900/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span>🛡️</span>
            <span>
              {remoteActiveSessions.length > 0 ? (
                <span className="text-amber-300 font-semibold">
                  {remoteActiveSessions.length} other browser{remoteActiveSessions.length > 1 ? 's are' : ' is'} currently open remotely.
                </span>
              ) : (
                <span className="text-emerald-300 font-medium">
                  This is the only open browser. No remote sessions detected.
                </span>
              )}
            </span>
          </div>

          {remoteActiveSessions.length > 0 && (
            <button
              type="button"
              onClick={handleKillAllOthers}
              disabled={isKillingAll}
              className="px-3 py-1.5 rounded-lg font-bold text-xs bg-rose-600/90 hover:bg-rose-500 text-white shadow-sm shadow-rose-900/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Immediately lock and kill all other devices where this website is open"
            >
              <span>🚨</span>
              <span>{isKillingAll ? 'Terminating...' : 'Kill All Other Browsers'}</span>
            </button>
          )}
        </div>

        {/* Content / Session Cards */}
        <div className="p-5 overflow-y-auto flex-1 bg-obsidian space-y-3">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-mono">
              No sessions found. Loading active connections...
            </div>
          ) : (
            sessions.map((session) => {
              const isCurrent = session.isCurrent;
              const isKilled = session.status === 'KILLED';
              const isKilling = killingId === session.id;

              return (
                <div
                  key={session.id}
                  className={`p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isKilled
                      ? 'bg-rose-950/10 border-rose-900/30 opacity-60'
                      : isCurrent
                      ? 'bg-slate-900/90 border-cyan-500/40 shadow-lg shadow-cyan-950/20'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Left Column: Device Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                        isKilled
                          ? 'bg-rose-900/20 border-rose-800/40 text-rose-400'
                          : isCurrent
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {session.device.includes('iPhone') || session.device.includes('Android') ? '📱' : '💻'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white truncate">
                          {session.device}
                        </span>
                        {isCurrent ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            THIS BROWSER (CURRENT)
                          </span>
                        ) : isKilled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            TERMINATED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            REMOTE BROWSER
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2.5 font-mono">
                        <span className="text-slate-300 font-semibold">User: {session.username}</span>
                        <span>•</span>
                        <span>IP: {session.ip}</span>
                        <span>•</span>
                        <span>Opened: {formatAbsoluteTime(session.createdAt)}</span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        Last Active: <span className="text-slate-400 font-semibold">{formatRelativeTime(session.lastActive)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="shrink-0 flex items-center gap-2 self-end md:self-center">
                    {isKilled ? (
                      <span className="text-xs font-mono text-rose-400 font-semibold px-3 py-1 bg-rose-950/30 rounded border border-rose-900/40">
                        Session Revoked
                      </span>
                    ) : isCurrent ? (
                      <button
                        type="button"
                        onClick={() => handleKillSession(session.id, true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                        title="Lock and sign out of this current workstation"
                      >
                        <span>🔒</span>
                        <span>Lock This Device</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleKillSession(session.id, false)}
                        disabled={isKilling}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600/90 hover:bg-rose-500 text-white shadow-sm shadow-rose-950/50 border border-rose-500/50 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Kill this remote browser and prevent further access"
                      >
                        <span>🔴</span>
                        <span>{isKilling ? 'Killing...' : 'Kill Browser'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Heartbeat security active: remote browsers terminate in &lt;6 seconds when killed.</span>
          </div>
          <div className="font-mono text-slate-400">
            QuantPulse Multi-Terminal Guard
          </div>
        </div>
      </div>
    </div>
  );
}
