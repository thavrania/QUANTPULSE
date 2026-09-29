'use client';

import React, { useState, useEffect } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export function AuthModal() {
  const { showToast, isAuthModalOpen, setIsAuthModalOpen } = useQuantPulse();

  const [mode, setMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !isAuthModalOpen) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setUserEmail(data.session.user.email);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
    });

    return () => subscription.unsubscribe();
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const onClose = () => setIsAuthModalOpen(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      showToast('Supabase is not configured yet. Operating in Demo mode.', 'amber');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'SIGN_IN') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        showToast('Signed in successfully!', 'emerald');
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        showToast('Account created! Please check your email for confirmation.', 'emerald');
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Authentication failed', 'rose');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUserEmail(null);
      showToast('Signed out of QuantPulse.', 'info');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <h3 className="text-sm font-bold text-white">
              {userEmail ? 'Account Profile' : mode === 'SIGN_IN' ? 'Sign In to QuantPulse' : 'Create Trader Account'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2.5 py-1 rounded bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 text-xs text-slate-300">
          {userEmail ? (
            <div className="space-y-4">
              <div className="p-3 bg-obsidian rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Active Session</div>
                <div className="font-mono text-sm text-cyan-300 font-bold break-all">{userEmail}</div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Connected to Supabase PostgreSQL Vault
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-3.5">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="trader@quantpulse.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-900 text-xs text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-900 text-xs font-mono text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
              >
                {isLoading ? 'Processing...' : mode === 'SIGN_IN' ? 'Sign In' : 'Create Account'}
              </button>

              <div className="text-center pt-1 text-[11px] text-slate-400">
                {mode === 'SIGN_IN' ? (
                  <span>
                    New trader?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('SIGN_UP')}
                      className="text-cyan-400 hover:underline font-semibold"
                    >
                      Sign Up
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('SIGN_IN')}
                      className="text-cyan-400 hover:underline font-semibold"
                    >
                      Sign In
                    </button>
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
