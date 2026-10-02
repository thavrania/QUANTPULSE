'use client';

import React, { useState, useEffect } from 'react';
import { useQuantPulse } from '@/context/QuantPulseContext';

export function AlertsModal() {
  const { showToast, isAlertsModalOpen, setIsAlertsModalOpen } = useQuantPulse();

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [notifyCrossover, setNotifyCrossover] = useState(true);
  const [notifyOrder, setNotifyOrder] = useState(true);
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const defaultToken = process.env.NEXT_PUBLIC_DEFAULT_TELEGRAM_BOT_TOKEN || '8602260354:AAGfdG8fTeS24QpP9QXiooNWRuKTepyr0Mw';
      const defaultChat = process.env.NEXT_PUBLIC_DEFAULT_TELEGRAM_CHAT_ID || '-1004477627015';
      const savedToken = localStorage.getItem('qp_telegram_bot_token');
      let savedChat = localStorage.getItem('qp_telegram_chat_id');

      // Auto-migrate if stored chat id was the previous typo (-1005577627015 instead of -1004477627015)
      if (savedChat === '-1005577627015') {
        savedChat = defaultChat;
        localStorage.setItem('qp_telegram_chat_id', defaultChat);
      }

      const activeToken = savedToken || defaultToken;
      const activeChat = savedChat || defaultChat;
      setBotToken(activeToken);
      setChatId(activeChat);

      if (!savedToken) localStorage.setItem('qp_telegram_bot_token', activeToken);
      if (!savedChat) localStorage.setItem('qp_telegram_chat_id', activeChat);

      const savedNotifyCross = localStorage.getItem('qp_notify_crossover');
      if (savedNotifyCross !== null) setNotifyCrossover(savedNotifyCross === 'true');
    }
  }, [isAlertsModalOpen]);

  if (!isAlertsModalOpen) return null;

  const onClose = () => setIsAlertsModalOpen(false);

  const handleSave = () => {
    localStorage.setItem('qp_telegram_bot_token', botToken.trim());
    localStorage.setItem('qp_telegram_chat_id', chatId.trim());
    localStorage.setItem('qp_notify_crossover', String(notifyCrossover));
    localStorage.setItem('qp_notify_order', String(notifyOrder));
    showToast('Alert preferences saved successfully!', 'emerald');
    onClose();
  };

  const handleTestAlert = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      showToast('Enter both Telegram Bot Token and Chat ID to test.', 'rose');
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch('/api/alerts/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          chatId: chatId.trim(),
          testPing: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('✅ Test Alert delivered to your Telegram!', 'emerald');
      } else {
        showToast(`❌ ${data.message}`, 'rose');
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`, 'rose');
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-panel border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-sm">
              🔔
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Instant Webhook Push Alerts</h3>
              <p className="text-xs text-slate-400">Telegram Bot Notifications for Crossovers &amp; Fills</p>
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
        <div className="p-5 space-y-4 text-xs text-slate-300">
          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
              Telegram Bot Token
            </label>
            <input
              type="password"
              placeholder="e.g. 7123456789:AAHxyz_your_bot_token"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="w-full bg-slate-900 text-xs font-mono text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
              Telegram Chat ID (Personal or Group)
            </label>
            <input
              type="text"
              placeholder="e.g. 987654321 or -10012345678"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="w-full bg-slate-900 text-xs font-mono text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Trigger Checkboxes */}
          <div className="p-3 bg-obsidian rounded-xl border border-slate-800 space-y-2.5">
            <span className="font-semibold text-white block">Active Notification Triggers</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyCrossover}
                onChange={(e) => setNotifyCrossover(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <span>Send alert when a stock latches 20-Day Volume Crossover</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOrder}
                onChange={(e) => setNotifyOrder(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <span>Send alert on Order Placement (Paper Sim &amp; Live Dhan)</span>
            </label>
          </div>

          {/* Instructions Box */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-200">Get Telegram credentials in 60 seconds (Free):</div>
            <div>1. In Telegram, search for <strong className="text-cyan-300">@BotFather</strong> and send <code>/newbot</code> to get your token.</div>
            <div>2. Search for <strong className="text-cyan-300">@userinfobot</strong> and send <code>/start</code> to see your Chat ID.</div>
            <div>3. Press Start in your new bot and click <strong>Test Ping</strong> below!</div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
          <button
            type="button"
            onClick={handleTestAlert}
            disabled={isSendingTest}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
          >
            {isSendingTest ? 'Pinging...' : '⚡ Send Test Ping'}
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
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
            >
              Save Alerts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
