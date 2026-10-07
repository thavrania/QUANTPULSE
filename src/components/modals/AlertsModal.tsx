'use client';

import React, { useState, useEffect } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  formatCrossoverAlert,
  formatOrderAlert,
  formatTslAlert,
  formatAutoPilotAlert,
  formatKillSwitchAlert,
  formatNifty0920SelectionAlert,
} from '@/lib/alerts/telegramService';

type AlertTypeId = 'PING' | 'CROSSOVER' | 'ORDER' | 'TSL' | 'AUTOPILOT' | 'KILL_SWITCH' | 'NIFTY_OVERNIGHT';

function getAlertLabel(type: AlertTypeId): string {
  switch (type) {
    case 'PING':
      return 'Connection Ping';
    case 'CROSSOVER':
      return '20D Volume Crossover (Buy & Sell) Alert';
    case 'ORDER':
      return 'Order Dispatched (Trade Took) Alert';
    case 'TSL':
      return 'Target / Trailing SL Alert';
    case 'AUTOPILOT':
      return 'Pre-Market Auto-Pilot Alert';
    case 'KILL_SWITCH':
      return 'Emergency Kill Switch Alert';
    case 'NIFTY_OVERNIGHT':
      return 'NIFTY 09:20 Overnight Alert';
    default:
      return 'Telegram Alert';
  }
}

export function AlertsModal() {
  const { showToast, isAlertsModalOpen, setIsAlertsModalOpen } = useQuantPulse();

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [hasCloudToken, setHasCloudToken] = useState(false);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Individual Alert Type Toggles
  const [notifyCrossover, setNotifyCrossover] = useState(true);
  const [notifyOrder, setNotifyOrder] = useState(true);
  const [notifyTsl, setNotifyTsl] = useState(true);
  const [notifyAutoPilot, setNotifyAutoPilot] = useState(true);
  const [notifyKillSwitch, setNotifyKillSwitch] = useState(true);
  const [notifyNiftyOvernight, setNotifyNiftyOvernight] = useState(true);

  // Active testing state for individual buttons
  const [testingAlertId, setTestingAlertId] = useState<AlertTypeId | null>(null);

  useEffect(() => {
    if (!isAlertsModalOpen) return;

    let isMounted = true;
    setIsLoadingSettings(true);

    async function loadAlertSettings() {
      const defaultToken = process.env.NEXT_PUBLIC_DEFAULT_TELEGRAM_BOT_TOKEN || '8602260354:AAGfdG8fTeS24QpP9QXiooNWRuKTepyr0Mw';
      const defaultChat = process.env.NEXT_PUBLIC_DEFAULT_TELEGRAM_CHAT_ID || '-1004477627015';

      let tokenToSet = defaultToken;
      let chatToSet = defaultChat;
      let crossToSet = true;
      let orderToSet = true;
      let tslToSet = true;
      let autoToSet = true;
      let killToSet = true;
      let niftyToSet = true;

      // Check localStorage first for instant display
      if (typeof window !== 'undefined') {
        const savedToken = localStorage.getItem('qp_telegram_bot_token');
        let savedChat = localStorage.getItem('qp_telegram_chat_id');
        if (savedChat === '-1005577627015') {
          savedChat = defaultChat;
          localStorage.setItem('qp_telegram_chat_id', defaultChat);
        }
        if (savedToken) tokenToSet = savedToken;
        if (savedChat) chatToSet = savedChat;

        const sCross = localStorage.getItem('qp_notify_crossover');
        if (sCross !== null) crossToSet = sCross === 'true';
        const sOrder = localStorage.getItem('qp_notify_order');
        if (sOrder !== null) orderToSet = sOrder === 'true';
        const sTsl = localStorage.getItem('qp_notify_tsl');
        if (sTsl !== null) tslToSet = sTsl === 'true';
        const sAuto = localStorage.getItem('qp_notify_autopilot');
        if (sAuto !== null) autoToSet = sAuto === 'true';
        const sKill = localStorage.getItem('qp_notify_killswitch');
        if (sKill !== null) killToSet = sKill === 'true';
        const sNifty = localStorage.getItem('qp_notify_nifty_overnight');
        if (sNifty !== null) niftyToSet = sNifty === 'true';
      }

      // Check Supabase Cloud Vault for authenticated cross-device persistence
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const session = sessionData.session;

          if (session?.access_token) {
            const res = await fetch('/api/alerts/settings', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            if (res.ok) {
              const result = await res.json();
              if (result.success && result.settings) {
                const s = result.settings;
                if (s.maskedBotToken) tokenToSet = s.maskedBotToken;
                if (s.telegramChatId) chatToSet = s.telegramChatId;
                if (s.telegramCrossoverEnabled !== undefined) crossToSet = s.telegramCrossoverEnabled;
                if (s.telegramOrderEnabled !== undefined) orderToSet = s.telegramOrderEnabled;
                if (s.telegramTslEnabled !== undefined) tslToSet = s.telegramTslEnabled;
                if (s.telegramAutoPilotEnabled !== undefined) autoToSet = s.telegramAutoPilotEnabled;
                if (s.telegramKillSwitchEnabled !== undefined) killToSet = s.telegramKillSwitchEnabled;
                if (s.telegramNiftyOvernightEnabled !== undefined) niftyToSet = s.telegramNiftyOvernightEnabled;

                if (isMounted) {
                  setHasCloudToken(Boolean(s.hasBotToken));
                  setIsCloudSynced(true);
                }
              }
            }
          }
        } catch (err) {
          console.warn('[AlertsModal] Cloud fetch notice:', err);
        }
      }

      if (isMounted) {
        setBotToken(tokenToSet);
        setChatId(chatToSet);
        setNotifyCrossover(crossToSet);
        setNotifyOrder(orderToSet);
        setNotifyTsl(tslToSet);
        setNotifyAutoPilot(autoToSet);
        setNotifyKillSwitch(killToSet);
        setNotifyNiftyOvernight(niftyToSet);
        setIsLoadingSettings(false);
      }
    }

    loadAlertSettings();

    return () => {
      isMounted = false;
    };
  }, [isAlertsModalOpen]);

  if (!isAlertsModalOpen) return null;

  const onClose = () => setIsAlertsModalOpen(false);

  const handleSave = async () => {
    setIsSaving(true);
    const trimmedBotToken = botToken.trim();
    const trimmedChatId = chatId.trim();

    // 1. Save to localStorage as immediate offline cache
    if (typeof window !== 'undefined') {
      localStorage.setItem('qp_telegram_bot_token', trimmedBotToken);
      localStorage.setItem('qp_telegram_chat_id', trimmedChatId);
      localStorage.setItem('qp_notify_crossover', String(notifyCrossover));
      localStorage.setItem('qp_notify_order', String(notifyOrder));
      localStorage.setItem('qp_notify_tsl', String(notifyTsl));
      localStorage.setItem('qp_notify_autopilot', String(notifyAutoPilot));
      localStorage.setItem('qp_notify_killswitch', String(notifyKillSwitch));
      localStorage.setItem('qp_notify_nifty_overnight', String(notifyNiftyOvernight));
    }

    // 2. Persist to Supabase Cloud Vault for cross-device synchronization
    let cloudSynced = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch('/api/alerts/settings', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            userId: session?.user?.id,
            botToken: trimmedBotToken,
            chatId: trimmedChatId,
            notifyCrossover,
            notifyOrder,
            notifyTsl,
            notifyAutoPilot,
            notifyKillSwitch,
            notifyNiftyOvernight,
          }),
        });

        const data = await res.json();
        if (data.success && data.isAuthenticated) {
          cloudSynced = true;
          setIsCloudSynced(true);
          if (data.maskedBotToken) {
            setBotToken(data.maskedBotToken);
          }
        }
      } catch (err: any) {
        console.warn('[AlertsModal] Cloud save failed, saved locally:', err.message);
      }
    }

    setIsSaving(false);
    if (cloudSynced) {
      showToast('✅ Alert settings saved and synced across all your devices!', 'emerald');
    } else {
      showToast('Alert preferences saved to local browser session.', 'emerald');
    }
    onClose();
  };

  const handleToggleAll = (enable: boolean) => {
    setNotifyCrossover(enable);
    setNotifyOrder(enable);
    setNotifyTsl(enable);
    setNotifyAutoPilot(enable);
    setNotifyKillSwitch(enable);
    setNotifyNiftyOvernight(enable);
    showToast(enable ? 'All alert types enabled.' : 'All alert types muted.', 'info');
  };

  const handleTestSpecificAlert = async (alertType: AlertTypeId) => {
    if (!botToken.trim() || !chatId.trim()) {
      showToast('Enter both Telegram Bot Token and Chat ID to test.', 'rose');
      return;
    }

    setTestingAlertId(alertType);
    try {
      const nowIST = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
      let messageToSend = '';
      let isPing = false;

      if (alertType === 'PING') {
        isPing = true;
      } else if (alertType === 'CROSSOVER') {
        messageToSend = formatCrossoverAlert('RELIANCE', 14.25, 12.50, 2985.40, nowIST, 14250000, 12500000);
      } else if (alertType === 'ORDER') {
        messageToSend = formatOrderAlert('RELIANCE 2980 CE', 'AUTO BUY', 250, 48.50, 'ORD-89421', 'LIVE_DHAN');
      } else if (alertType === 'TSL') {
        messageToSend = formatTslAlert('RELIANCE 2980 CE', 2, 'State 2: Breakeven (+1R)', 48.50, 0, nowIST);
      } else if (alertType === 'AUTOPILOT') {
        messageToSend = formatAutoPilotAlert(
          3,
          'Pre-Open Live Sync',
          'NSE pre-open discovered opening prices synced. ATM Option strikes calibrated.',
          nowIST
        );
      } else if (alertType === 'KILL_SWITCH') {
        messageToSend = formatKillSwitchAlert(2, nowIST);
      } else if (alertType === 'NIFTY_OVERNIGHT') {
        messageToSend = formatNifty0920SelectionAlert(
          '14-OCT-2026',
          'NIFTY 25200 CE',
          64.0,
          48.0,
          'NIFTY 24800 PE',
          63.0,
          47.25,
          nowIST
        );
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isSupabaseConfigured && supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
          headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
        }
      }

      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          botToken: botToken.trim(),
          chatId: chatId.trim(),
          testPing: isPing,
          message: messageToSend,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${getAlertLabel(alertType)} delivered to Telegram!`, 'emerald');
      } else {
        showToast(`❌ ${data.message}`, 'rose');
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`, 'rose');
    } finally {
      setTestingAlertId(null);
    }
  };

  const alertCards = [
    {
      id: 'CROSSOVER' as AlertTypeId,
      badge: 'BUY & SELL',
      badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      icon: '🚀',
      title: '20D Volume Crossover (Buy & Sell)',
      desc: "Dispatched the exact second a stock's today traded shares break above its 20-Day Average benchmark: 🟢 BUY for bullish breakouts and 🔴 SELL / PE ELIGIBLE for bearish breakdowns.",
      checked: notifyCrossover,
      setChecked: setNotifyCrossover,
      sampleText: 'Sample: 🟢 RELIANCE (BUY) or 🔴 INFY (SELL) 20D Volume Crossover',
    },
    {
      id: 'ORDER' as AlertTypeId,
      badge: 'TRADE TOOK',
      badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      icon: '⚡',
      title: 'Trade Taken (Order Executed / OMS)',
      desc: 'Dispatched whenever an Auto or Manual Buy order executes (Paper Simulator or Live Dhan Execution) with strike, quantity, and Order ID.',
      checked: notifyOrder,
      setChecked: setNotifyOrder,
      sampleText: 'Sample: RELIANCE 2980 CE BUY 250 Units @ ₹48.50',
    },
    {
      id: 'TSL' as AlertTypeId,
      badge: 'PROFIT / TSL',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      icon: '🎯',
      title: 'Target Hits & Trailing SL Milestones',
      desc: 'Dispatched as trades achieve +1R Breakeven (0R Risk-Free), +2R (+1R Profit Locked), and final Target Hit / SL Square Off.',
      checked: notifyTsl,
      setChecked: setNotifyTsl,
      sampleText: 'Sample: Breakeven (+1R) Achieved • SL Moved to Entry (Risk-Free)',
    },
    {
      id: 'AUTOPILOT' as AlertTypeId,
      badge: 'SCHEDULED',
      badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      icon: '🤖',
      title: 'Pre-Market Auto-Pilot Pipeline',
      desc: 'Dispatched during morning stages: 08:50 AM baseline sync, 09:00 AM day reset, 09:07 AM pre-open sync, 09:14 AM live feed connect.',
      checked: notifyAutoPilot,
      setChecked: setNotifyAutoPilot,
      sampleText: 'Sample: Pre-Open Live Sync Completed • Strikes Calibrated',
    },
    {
      id: 'KILL_SWITCH' as AlertTypeId,
      badge: 'EMERGENCY',
      badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      icon: '🛑',
      title: 'Emergency Panic Kill Switch',
      desc: 'Dispatched when Panic Kill Switch is pressed to immediately square off all open positions, cancel active orders, and halt live trading.',
      checked: notifyKillSwitch,
      setChecked: setNotifyKillSwitch,
      sampleText: 'Sample: Portfolio Flattening Protocol • 2 Trade(s) Squared Off',
    },
    {
      id: 'NIFTY_OVERNIGHT' as AlertTypeId,
      badge: 'OVERNIGHT',
      badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      icon: '🌙',
      title: 'NIFTY 09:20 Premium 62.5 Overnight Strategy',
      desc: 'Dispatched at 09:20 AM strike selection, 25% Stop Loss breaches, overnight carry, and next-day 09:25 AM mandatory exits.',
      checked: notifyNiftyOvernight,
      setChecked: setNotifyNiftyOvernight,
      sampleText: 'Sample: CE 25200 @ ₹64 (SL: ₹48) | PE 24800 @ ₹63 (SL: ₹47.25) • NO TARGET',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-base shadow-inner">
              🔔
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">Telegram Push Alert Settings</h3>
                {isCloudSynced ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    CLOUD PERSISTENT
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-semibold">
                    LOCAL / DEMO
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Cross-device persistent alert triggers delivered directly to your Telegram channels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 flex-1">
          {/* Cloud Sync Status Banner */}
          {isCloudSynced ? (
            <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center justify-between text-[11px] text-emerald-300">
              <div className="flex items-center gap-2">
                <span>☁️</span>
                <span>Settings linked to your account. Open on any browser or machine to restore automatically.</span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span>💡</span>
                <span>Sign in via <strong>Account Profile</strong> in Zone A to enable seamless cross-device cloud persistence.</span>
              </div>
            </div>
          )}

          {/* Bot & Chat ID Grid */}
          <div className="p-4 bg-obsidian/90 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Telegram Credentials &amp; Target Destination
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">@SureShotTradeBot</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                  Telegram Bot Token {hasCloudToken && <span className="text-emerald-400 font-normal">(Secured in Cloud)</span>}
                </label>
                <input
                  type="password"
                  placeholder="e.g. 8602260354:AAGfdG8f..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full bg-slate-900 text-xs font-mono text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                  Telegram Group / Chat ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. -1004477627015"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full bg-slate-900 text-xs font-mono text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {chatId === '-1004477627015' && (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 pt-0.5">
                <span>✓</span> Verified Destination: <strong>SureShot</strong> Supergroup (ID: <code>-1004477627015</code>)
              </div>
            )}
          </div>

          {/* Alert Types Matrix Section Header */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Notification Trigger Types
              </span>
              <p className="text-[11px] text-slate-400">
                Toggle each alert type on/off and click <strong>Test Alert</strong> to preview live in Telegram
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Enable All
              </button>
              <button
                type="button"
                onClick={() => handleToggleAll(false)}
                className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
              >
                Mute All
              </button>
            </div>
          </div>

          {/* 6 Distinct Alert Type Cards */}
          <div className="space-y-2.5">
            {alertCards.map((card) => {
              const isTesting = testingAlertId === card.id;
              return (
                <div
                  key={card.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    card.checked
                      ? 'bg-slate-900/90 border-slate-700 hover:border-slate-600'
                      : 'bg-slate-900/40 border-slate-800/70 opacity-70'
                  }`}
                >
                  {/* Left: Icon, Badge & Details */}
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0 mt-0.5">
                      {card.icon}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${card.badgeColor}`}>
                          {card.badge}
                        </span>
                        <strong className="text-xs text-white">{card.title}</strong>
                        {card.checked ? (
                          <span className="text-[10px] text-emerald-400 font-mono">● Active</span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">○ Muted</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{card.desc}</p>
                      <div className="text-[10px] text-slate-500 font-mono italic">{card.sampleText}</div>
                    </div>
                  </div>

                  {/* Right: Toggle & Test Button */}
                  <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTestSpecificAlert(card.id)}
                      disabled={isTesting}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition flex items-center gap-1.5"
                      title={`Send sample ${card.title} to your Telegram group`}
                    >
                      {isTesting ? (
                        <>
                          <span className="animate-spin text-xs">⏳</span> Sending...
                        </>
                      ) : (
                        <>
                          <span>⚡</span> Test Alert
                        </>
                      )}
                    </button>

                    {/* Styled Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={card.checked}
                        onChange={(e) => card.setChecked(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 border border-slate-700"></div>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Help Tips */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-200">💡 Quick Telegram Tips:</div>
            <div>
              • <strong>SureShot Group:</strong> Ensure <code>@SureShotTradeBot</code> has administrator privileges so it can dispatch alerts without restrictions.
            </div>
            <div>
              • <strong>Cross-Device Persistence:</strong> Once saved while signed in, your preferences are secured in the Supabase Cloud Vault and automatically restored whenever you log in from any browser.
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleTestSpecificAlert('PING')}
            disabled={testingAlertId === 'PING'}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition flex items-center gap-1.5"
            title="Send a basic connection handshake ping to verify credentials"
          >
            {testingAlertId === 'PING' ? 'Pinging...' : '⚡ General Test Ping'}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
            >
              {isSaving ? 'Saving...' : 'Save Alert Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
