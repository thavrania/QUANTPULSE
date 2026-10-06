'use client';

import React, { useState, useEffect } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { BrokerType, BrokerConnectionTestResult } from '@/lib/broker/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export function BrokerSettingsModal() {
  const {
    watchlist,
    showToast,
    isBrokerModalOpen,
    setIsBrokerModalOpen,
    brokerVaultStatus,
    refreshBrokerVaultStatus,
    syncDailyBaselines,
  } = useQuantPulse();

  const [broker, setBroker] = useState<BrokerType>('DHAN');
  const [clientId, setClientId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingBaselines, setIsSyncingBaselines] = useState(false);
  const [isTestingQuote, setIsTestingQuote] = useState(false);
  const [isSyncingVault, setIsSyncingVault] = useState(false);
  const [isPullingVault, setIsPullingVault] = useState(false);
  const [testResult, setTestResult] = useState<BrokerConnectionTestResult | null>(null);
  const [liveQuotePreview, setLiveQuotePreview] = useState<Record<string, any> | null>(null);
  const [isCheckingIp, setIsCheckingIp] = useState(false);
  const [isSettingIp, setIsSettingIp] = useState(false);
  const [ipData, setIpData] = useState<{
    serverIp: string;
    isVercel: boolean;
    dhanConfig: {
      primaryIP: string | null;
      secondaryIP: string | null;
      modifyDatePrimary: string | null;
      modifyDateSecondary: string | null;
    } | null;
    isMatched: boolean;
    message: string;
  } | null>(null);

  const [dhanAuthStatus, setDhanAuthStatus] = useState<any>(null);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);

  const fetchAuthStatus = async () => {
    try {
      const res = await fetch('/api/broker/dhan/auth-status');
      const data = await res.json();
      if (data?.success && data?.status) {
        setDhanAuthStatus(data.status);
      }
    } catch {}
  };

  const handleForceRefreshToken = async () => {
    setIsRefreshingToken(true);
    try {
      const res = await fetch('/api/broker/dhan/auth-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });
      const data = await res.json();
      if (data?.success && data?.status) {
        setDhanAuthStatus(data.status);
        showToast('Dhan Access Token refreshed successfully via Server Auto-Auth!', 'emerald');
        refreshBrokerVaultStatus();
      } else {
        showToast(data?.message || 'Failed to refresh token', 'rose');
      }
    } catch (err: any) {
      showToast(`Refresh error: ${err.message}`, 'rose');
    } finally {
      setIsRefreshingToken(false);
    }
  };

  // Load saved credentials from localStorage & server auth status
  useEffect(() => {
    if (typeof window !== 'undefined' && isBrokerModalOpen) {
      fetchAuthStatus();
      const savedBroker = (localStorage.getItem('qp_broker_type') as BrokerType) || 'DHAN';
      const savedClientId = localStorage.getItem('qp_dhan_client_id') || '';
      const savedToken = localStorage.getItem('qp_dhan_access_token') || '';
      setBroker(savedBroker);
      setClientId(savedClientId);
      setAccessToken(savedToken);

      // Auto-fetch if local is empty and vault is configured
      if (!savedClientId && brokerVaultStatus?.clientId) {
        setClientId(brokerVaultStatus.clientId);
      }
    }
  }, [isBrokerModalOpen, brokerVaultStatus]);

  if (!isBrokerModalOpen) return null;

  const onClose = () => setIsBrokerModalOpen(false);

  const handleSaveLocal = () => {
    localStorage.setItem('qp_broker_type', broker);
    localStorage.setItem('qp_dhan_client_id', clientId.trim());
    localStorage.setItem('qp_dhan_access_token', accessToken.trim());
    showToast(`Broker configuration saved locally (${broker})`, 'emerald');
    refreshBrokerVaultStatus();
    onClose();
  };

  const handleSaveAndSyncVault = async () => {
    if (!clientId.trim() || !accessToken.trim()) {
      showToast('Please enter both Dhan Client ID and Access Token.', 'rose');
      return;
    }

    setIsSyncingVault(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/broker/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerName: broker,
          clientId: clientId.trim(),
          accessToken: accessToken.trim(),
          expiryHours: 24,
        }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('qp_broker_type', broker);
        localStorage.setItem('qp_dhan_client_id', clientId.trim());
        localStorage.setItem('qp_dhan_access_token', accessToken.trim());
        if (data.expiryAt) localStorage.setItem('qp_token_expiry_at', data.expiryAt);

        setTestResult({
          success: true,
          message: data.message,
          broker: 'DHAN',
          latencyMs: data.latencyMs,
          availableCash: data.availableMargin,
        });

        await refreshBrokerVaultStatus();
        showToast('✅ Dhan HQ Authenticated & Synced to Cloud Vault!', 'emerald');
      } else {
        setTestResult({
          success: false,
          message: data.message || 'Authentication failed',
          broker: 'DHAN',
          latencyMs: data.latencyMs,
        });
        showToast(data.message || 'Authentication failed', 'rose');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to ping Dhan API and sync to vault',
        broker: 'DHAN',
      });
      showToast(`Sync error: ${err.message}`, 'rose');
    } finally {
      setIsSyncingVault(false);
    }
  };

  const handlePullFromVault = async () => {
    setIsPullingVault(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data: vData, error } = await supabase
          .from('broker_vault')
          .select('*')
          .eq('is_primary', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && vData && vData.client_id) {
          setClientId(vData.client_id);
          setAccessToken(vData.access_token);
          setBroker((vData.broker_name as BrokerType) || 'DHAN');

          localStorage.setItem('qp_broker_type', vData.broker_name || 'DHAN');
          localStorage.setItem('qp_dhan_client_id', vData.client_id);
          localStorage.setItem('qp_dhan_access_token', vData.access_token);
          if (vData.token_expiry_at) {
            localStorage.setItem('qp_token_expiry_at', vData.token_expiry_at);
          }

          await refreshBrokerVaultStatus();
          showToast('📥 Active credentials pulled from Cloud Vault!', 'emerald');
          return;
        }
      }

      // Fallback to API route if direct query has issue
      const res = await fetch('/api/broker/vault');
      const data = await res.json();
      if (data.success && data.data?.isConfigured && data.data.clientId) {
        setClientId(data.data.clientId);
        showToast('Client ID restored from Cloud Vault.', 'emerald');
      } else {
        showToast('No active credentials stored in Supabase Cloud Vault.', 'amber');
      }
    } catch (err: any) {
      showToast(`Error pulling vault: ${err.message}`, 'rose');
    } finally {
      setIsPullingVault(false);
    }
  };

  const handleTestConnection = async () => {
    if (!clientId.trim() || !accessToken.trim()) {
      showToast('Please enter both Dhan Client ID and Access Token.', 'rose');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/broker/dhan/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId.trim(),
          accessToken: accessToken.trim(),
        }),
      });

      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        showToast(`Dhan API Online! Latency: ${data.latencyMs}ms`, 'emerald');
      } else {
        showToast(data.message || 'Authentication failed', 'rose');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to ping Dhan API',
        broker: 'DHAN',
      });
      showToast('Connection test failed', 'rose');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync20DBaselines = async () => {
    if (!clientId.trim() || !accessToken.trim()) {
      showToast('Configure and test Dhan credentials first.', 'amber');
      return;
    }

    // Persist active credentials to localStorage so syncDailyBaselines picks them up
    if (typeof window !== 'undefined') {
      localStorage.setItem('qp_dhan_client_id', clientId.trim());
      localStorage.setItem('qp_dhan_access_token', accessToken.trim());
    }

    setIsSyncingBaselines(true);
    try {
      await syncDailyBaselines(false, true);
      showToast(`Synced real 20-Day Volume Baselines for all active stocks from Dhan!`, 'emerald');
    } catch (err: any) {
      showToast(`Baseline sync error: ${err?.message || err}`, 'rose');
    } finally {
      setIsSyncingBaselines(false);
    }
  };

  const handleTestLiveQuotes = async () => {
    if (!clientId.trim() || !accessToken.trim()) {
      showToast('Please enter both Dhan Client ID and Access Token.', 'rose');
      return;
    }

    setIsTestingQuote(true);
    setLiveQuotePreview(null);

    try {
      const res = await fetch('/api/broker/dhan/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: ['RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK'],
          clientId: clientId.trim(),
          accessToken: accessToken.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.quotes) {
        setLiveQuotePreview(data.quotes);
        showToast('✅ Live Market Quotes successfully received from Dhan HQ!', 'emerald');
      } else {
        showToast(`Market Quote failed: ${data.message || 'Unknown error'}`, 'rose');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'rose');
    } finally {
      setIsTestingQuote(false);
    }
  };

  const handleCheckIpStatus = async () => {
    setIsCheckingIp(true);
    try {
      const q = new URLSearchParams();
      if (clientId.trim()) q.set('clientId', clientId.trim());
      if (accessToken.trim()) q.set('accessToken', accessToken.trim());

      const res = await fetch(`/api/broker/dhan/ip-status?${q.toString()}`);
      const data = await res.json();
      if (data.success) {
        setIpData(data);
        if (data.isMatched) {
          showToast('✅ IP Whitelist Verified: Server IP matches Dhan configuration!', 'emerald');
        } else {
          showToast('⚠️ IP Mismatch: Current server IP is not whitelisted on Dhan.', 'amber');
        }
      } else {
        showToast(data.message || 'Failed to check IP status', 'rose');
      }
    } catch (err: any) {
      showToast(`IP check error: ${err.message}`, 'rose');
    } finally {
      setIsCheckingIp(false);
    }
  };

  const handleSetDhanIp = async (flag: 'PRIMARY' | 'SECONDARY') => {
    if (!ipData?.serverIp || ipData.serverIp === 'UNKNOWN') {
      showToast('No valid server IP detected to whitelist.', 'amber');
      return;
    }
    if (!clientId.trim() || !accessToken.trim()) {
      showToast('Dhan Client ID and Access Token required.', 'rose');
      return;
    }

    setIsSettingIp(true);
    try {
      const res = await fetch('/api/broker/dhan/ip-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: ipData.serverIp,
          ipFlag: flag,
          clientId: clientId.trim(),
          accessToken: accessToken.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Whitelisted ${ipData.serverIp} as ${flag} IP on Dhan!`, 'emerald');
        await handleCheckIpStatus();
      } else {
        showToast(data.message || 'Failed to update IP on Dhan', 'rose');
      }
    } catch (err: any) {
      showToast(`Failed to set IP: ${err.message}`, 'rose');
    } finally {
      setIsSettingIp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              🔌
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Live Broker Gateway &amp; Cloud Vault</h3>
              <p className="text-xs text-slate-400">Phase 2: 24h Auto-Auth &amp; Multi-Device Cloud Sync</p>
            </div>
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
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-300">
          
          {/* Cloud Vault Status Card */}
          <div className="p-3.5 bg-obsidian rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">☁️</span>
                <span className="font-bold text-white text-xs">Supabase Cloud Vault</span>
                {brokerVaultStatus?.isConfigured ? (
                  brokerVaultStatus.isExpired ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                      🔴 Expired
                    </span>
                  ) : brokerVaultStatus.isExpiringSoon ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                      ⚠️ Expiring Soon ({brokerVaultStatus.tokenTimeRemaining})
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      🟢 Active ({brokerVaultStatus.tokenTimeRemaining})
                    </span>
                  )
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Not Configured
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handlePullFromVault}
                disabled={isPullingVault}
                className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-2 py-1 rounded transition flex items-center gap-1"
                title="Fetch active keys from Supabase database to auto-fill this form"
              >
                <span>{isPullingVault ? 'Pulling...' : '📥 Pull from Cloud Vault'}</span>
              </button>
            </div>

            {brokerVaultStatus?.isConfigured && (
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-1 text-slate-400 border-t border-slate-800/80">
                <div>
                  <span className="block text-slate-500">Client ID:</span>
                  <span className="text-white font-bold">{brokerVaultStatus.clientId}</span>
                </div>
                <div>
                  <span className="block text-slate-500">Token Mask:</span>
                  <span className="text-slate-300">{brokerVaultStatus.maskedToken}</span>
                </div>
                <div>
                  <span className="block text-slate-500">Available Margin:</span>
                  <span className="text-emerald-400 font-bold">
                    ₹{(brokerVaultStatus.availableMargin || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Broker Selector */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
              Select Execution &amp; Feed Broker
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBroker('DHAN')}
                className={`py-2 px-3 rounded-lg border text-left font-semibold transition ${
                  broker === 'DHAN'
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Dhan HQ API v2</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                    FREE
                  </span>
                </div>
                <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                  Direct NSE Feed &amp; Zero-brokerage API
                </div>
              </button>

              <button
                type="button"
                onClick={() => setBroker('PAPER')}
                className={`py-2 px-3 rounded-lg border text-left font-semibold transition ${
                  broker === 'PAPER'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Paper Trading Engine</span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                    SIM
                  </span>
                </div>
                <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                  Zero risk testing with real algorithms
                </div>
              </button>
            </div>
          </div>

          {broker === 'DHAN' ? (
            <div className="space-y-3 bg-obsidian p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-semibold text-white">Dhan API Credentials</span>
                <a
                  href="https://web.dhan.co"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  Generate in Dhan Web ↗
                </a>
              </div>

              {/* Automated Server-Side Authentication Banner */}
              {dhanAuthStatus?.authMode === 'AUTOMATED_API_KEY_TOTP' ? (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-300 text-xs">
                      <span>🤖</span>
                      <span>Automated Server-Side Authentication Active</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      TOTP + API Key
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    QuantPulse automatically generates and maintains a fresh Dhan Access Token using your server-side API Key &amp; TOTP. No daily manual token generation required!
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20 text-[10px] text-slate-400 font-mono">
                    <span>
                      Token Status:{' '}
                      <strong className="text-emerald-400">
                        {dhanAuthStatus.timeRemainingFormatted}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleForceRefreshToken}
                      disabled={isRefreshingToken}
                      className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded border border-emerald-500/40 font-semibold transition"
                    >
                      {isRefreshingToken ? 'Refreshing...' : '🔄 Force Renew Now'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg text-[11px] text-slate-400 flex items-center justify-between">
                  <span>
                    💡 <strong>Automate 24h Logins:</strong> Add <code className="text-cyan-400 font-mono">DHAN_API_KEY</code> &amp; <code className="text-cyan-400 font-mono">DHAN_TOTP_SECRET</code> to <code className="text-cyan-400 font-mono">.env.local</code>.
                  </span>
                  <a
                    href="/api/broker/dhan/initiate-auth"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline shrink-0 ml-2 font-semibold text-[10px] bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/30"
                  >
                    OAuth Consent ↗
                  </a>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">
                  Dhan Client ID (6 to 10 digits)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1000123456"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full bg-slate-900 text-xs font-mono text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">
                  Dhan Access Token (JWT / API Token)
                </label>
                <textarea
                  rows={3}
                  placeholder="Paste your 24-hour Dhan Access Token here..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full bg-slate-900 text-xs font-mono text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Action Buttons: Ping, IP Check, Baseline Sync, Live Quotes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="py-2 px-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition flex items-center justify-center gap-1"
                >
                  {isTesting ? 'Pinging...' : '⚡ Test Auth'}
                </button>

                <button
                  type="button"
                  onClick={handleCheckIpStatus}
                  disabled={isCheckingIp}
                  className="py-2 px-2 rounded-lg text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 transition flex items-center justify-center gap-1"
                  title="Checks if current server IP is whitelisted on Dhan for order placement"
                >
                  {isCheckingIp ? 'Checking...' : '🛡️ Check IP'}
                </button>

                <button
                  type="button"
                  onClick={handleSync20DBaselines}
                  disabled={isSyncingBaselines}
                  className="py-2 px-2 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition flex items-center justify-center gap-1"
                  title="Calculates real 20-day average volume for stocks from Dhan historical charts"
                >
                  {isSyncingBaselines ? 'Syncing...' : '📊 20D Baselines'}
                </button>

                <button
                  type="button"
                  onClick={handleTestLiveQuotes}
                  disabled={isTestingQuote}
                  className="py-2 px-2 rounded-lg text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition flex items-center justify-center gap-1"
                  title="Test fetching live marketfeed quote data from Dhan HQ"
                >
                  {isTestingQuote ? 'Fetching...' : '📈 Live Feed'}
                </button>
              </div>

              {/* IP Whitelist & Order Authorization Status Card */}
              {ipData && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                    ipData.isMatched
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <span>{ipData.isMatched ? '🛡️ Dhan Static IP Whitelisted' : '⚠️ Dhan IP Mismatch (Invalid IP)'}</span>
                    </span>
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold ${
                        ipData.isMatched
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {ipData.isMatched ? '🟢 LIVE ORDERS ALLOWED' : '🔴 LIVE ORDERS BLOCKED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase">Server Outbound IP</span>
                      <span className="font-bold text-white text-xs">{ipData.serverIp}</span>
                      {ipData.isVercel && (
                        <span className="block text-[9px] text-amber-400 mt-0.5 font-sans font-medium">
                          ⚠️ Vercel Dynamic Cloud IP
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase">Dhan Whitelisted IP</span>
                      <span className="font-bold text-white text-xs">
                        {ipData.dhanConfig?.primaryIP || 'Not Set'}
                      </span>
                      {ipData.dhanConfig?.secondaryIP && (
                        <span className="block text-[10px] text-slate-400">
                          Sec: {ipData.dhanConfig.secondaryIP}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed opacity-95">
                    {ipData.message}
                  </p>

                  {!ipData.isMatched && ipData.serverIp !== 'UNKNOWN' && (
                    <div className="pt-1 flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => handleSetDhanIp('PRIMARY')}
                        disabled={isSettingIp}
                        className="py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition flex items-center gap-1 shadow"
                      >
                        {isSettingIp ? 'Updating...' : `Whitelist '${ipData.serverIp}' as Primary IP on Dhan`}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetDhanIp('SECONDARY')}
                        disabled={isSettingIp}
                        className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      >
                        Set as Secondary IP
                      </button>
                    </div>
                  )}

                  {ipData.isVercel && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-300 leading-relaxed space-y-1">
                      <div className="font-bold">Important for Vercel Deployments:</div>
                      <div>
                        Vercel serverless functions use dynamic AWS IP pools that rotate with each execution.
                        Under SEBI rules, Dhan blocks order placement from dynamic IPs.
                      </div>
                      <div>
                        💡 <strong>Recommended:</strong> To execute live orders with real Dhan capital, run QuantPulse locally (<code className="bg-slate-900 px-1 py-0.5 rounded text-amber-200">npm run dev</code>) on your PC and whitelist your broadband IP in Dhan. Or use <strong>Paper Trading Mode</strong> for complete virtual algorithm testing on Vercel.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live Quote Preview Table */}
              {liveQuotePreview && (
                <div className="p-3 bg-obsidian rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Live Marketfeed Received from Dhan HQ
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date().toLocaleTimeString('en-IN')} IST
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    {Object.entries(liveQuotePreview).map(([sym, q]: [string, any]) => (
                      <div key={sym} className="p-2 bg-slate-900/80 rounded border border-slate-800 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-white">{sym}</span>
                          <div className="text-[10px] text-slate-400">Vol: {q.volumeM}M</div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400">₹{q.ltp}</span>
                          <div className={`text-[10px] ${q.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {q.changePct >= 0 ? '+' : ''}{q.changePct}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ping Result Banner */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{testResult.success ? '✅ Authentication Verified' : '❌ Connection Error'}</span>
                    {testResult.latencyMs && (
                      <span className="font-mono text-[10px] bg-slate-900/80 px-2 py-0.5 rounded">
                        {testResult.latencyMs}ms Latency
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-90">{testResult.message}</p>
                  {testResult.availableCash !== undefined && testResult.success && (
                    <div className="text-[11px] font-mono text-cyan-300 pt-1">
                      Available Trading Margin: ₹
                      {testResult.availableCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-obsidian border border-slate-800 space-y-2">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Paper Trading Mode Active
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Paper trading allows you to test the 20-day volume crossover latching, option ATM strikes, and trailing stop-loss algorithms without placing real money orders.
              </p>
            </div>
          )}

          {/* Quick instructions box */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-200">How to configure DhanHQ Live API:</div>
            <div>1. Log in to <strong className="text-white">web.dhan.co</strong>.</div>
            <div>2. Click profile avatar (top-right) $\rightarrow$ <strong className="text-white">DhanHQ API &amp; Access Token</strong>.</div>
            <div>3. Click <strong className="text-emerald-300">Generate Access Token</strong> and paste it above.</div>
            <div>
              4. <strong>Static IP Setup:</strong> In Dhan Web, navigate to <strong>IP Setup</strong> (or use the <strong>🛡️ Check IP</strong> button above) to whitelist your server IP.
            </div>
            <div className="text-[10px] text-slate-500 pt-0.5">
              ⚠️ <em>Note:</em> Dhan strictly rejects live orders with &apos;Invalid IP&apos; if the IP doesn&apos;t match. If deployed on Vercel, run locally (<code className="text-slate-400">npm run dev</code>) or use Paper Trading.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSaveLocal}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Saves to this browser only"
          >
            💾 Save Local Only
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndSyncVault}
              disabled={isSyncingVault}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition flex items-center gap-1.5"
              title="Pings Dhan HQ, verifies token, and saves to Supabase Cloud Vault for all devices"
            >
              <span>{isSyncingVault ? 'Verifying & Syncing...' : '☁️ Save & Sync to Cloud Vault'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
