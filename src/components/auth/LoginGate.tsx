'use client';

import React, { useState } from 'react';

interface LoginGateProps {
  onLoginSuccess: (username: string) => void;
}

export function LoginGate({ onLoginSuccess }: LoginGateProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Please enter both User name and Password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass,
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'Invalid User name or Password.');
        return;
      }

      // Store in localStorage for client-side state consistency
      if (typeof window !== 'undefined') {
        localStorage.setItem('qp_terminal_user', data.user?.username || cleanUser);
        localStorage.setItem('qp_terminal_auth_at', Date.now().toString());
      }

      onLoginSuccess(data.user?.username || cleanUser);
    } catch (err: any) {
      setErrorMsg(`Connection error: ${err.message || 'Unable to authenticate'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-obsidian text-slate-100 p-4 relative overflow-hidden select-none">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md bg-panel/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-inner mb-3">
            <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>

          <div className="inline-flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono">
              QUANTPULSE
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              v2.3
            </span>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            Institutional Algorithmic Trading Terminal
          </p>

          <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Multi-Terminal Access Gate Required</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
            <span className="text-sm mt-0.5">⚠️</span>
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              User Name / ID
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm">
                👤
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter user name (e.g. admin)"
                autoComplete="username"
                autoFocus
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 text-sm font-mono text-white rounded-xl border border-slate-700/80 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm">
                🔒
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter terminal password"
                autoComplete="current-password"
                required
                className="w-full pl-9 pr-10 py-2.5 bg-slate-900/90 text-sm font-mono text-white rounded-xl border border-slate-700/80 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 text-xs"
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Remember this terminal session</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Authenticating Terminal...</span>
              </>
            ) : (
              <>
                <span>🔐</span>
                <span>Sign In to Terminal</span>
              </>
            )}
          </button>
        </form>

        {/* Security Notice Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-[11px] text-slate-500 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>256-bit Encrypted Multi-Location Gateway</span>
          </div>
          <div>Sign in required to monitor live market feeds and order routing.</div>
        </div>
      </div>
    </div>
  );
}
