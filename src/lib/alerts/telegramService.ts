// =====================================================================
// QP — Instant Alert Engine (Telegram Bot Webhook Service)
// Dispatches low-latency push notifications for volume crossovers & orders
// =====================================================================

export interface AlertNotificationPayload {
  type: 'CROSSOVER' | 'ORDER_EXECUTED' | 'TSL_UPDATE' | 'KILL_SWITCH';
  ticker: string;
  timestamp: string;
  details: {
    symbol?: string;
    spotPrice?: number;
    todayVolM?: number;
    avgVol20DM?: number;
    crossoverTime?: string;
    action?: string;
    quantity?: number;
    price?: number;
    orderId?: string;
    mode?: string;
    tslPrice?: number;
  };
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; message: string }> {
  if (!botToken || !chatId) {
    return { success: false, message: 'Telegram Bot Token and Chat ID are required.' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { success: false, message: data.description || 'Telegram API rejected message.' };
    }

    return { success: true, message: 'Telegram alert dispatched successfully!' };
  } catch (err: any) {
    return { success: false, message: `Network error: ${err.message}` };
  }
}

export function formatCrossoverAlert(
  ticker: string,
  todayVolM: number,
  avgVol20DM: number,
  spotLtp: number,
  timeIST: string,
  todaySharesCount?: number,
  avgSharesCount?: number,
  signalType: 'BUY' | 'SELL' = 'BUY'
): string {
  const todayShares = (todaySharesCount !== undefined ? todaySharesCount : Math.round(todayVolM * 1_000_000)).toLocaleString('en-IN');
  const avgShares = (avgSharesCount !== undefined ? avgSharesCount : Math.round(avgVol20DM * 1_000_000)).toLocaleString('en-IN');

  if (signalType === 'SELL') {
    return `🚨 *QP — 20D AVG BEARISH BREAKDOWN!*
────────────
• *Symbol:* \`${ticker}\`
• *Spot Price:* \`₹${spotLtp.toFixed(2)}\`
• *Cross Time:* \`${timeIST} IST\`
• *Today VOL:* \`${todayShares} Qty\`
• *20D Avg:* \`${avgShares} Qty\`
• *Eligibility:* 🔴 *SELL / PE ELIGIBLE*
────────────
_QP High-Frequency Crossover Engine_`;
  }

  return `🚀 *QP — 20D AVG CROSSOVER!*
────────────
• *Symbol:* \`${ticker}\`
• *Spot Price:* \`₹${spotLtp.toFixed(2)}\`
• *Cross Time:* \`${timeIST} IST\`
• *Today VOL:* \`${todayShares} Qty\`
• *20D Avg:* \`${avgShares} Qty\`
• *Eligibility:* 🟢 *BUY*
────────────
_QP High-Frequency Crossover Engine_`;
}

export function formatOrderAlert(symbol: string, action: string, qty: number, price: number, orderId: string, mode: string): string {
  return `⚡ *QP — ORDER DISPATCHED!*
────────────
• *Instrument:* \`${symbol}\`
• *Action:* \`${action} ${qty} Units\`
• *Price:* \`₹${price.toFixed(2)}\`
• *Order ID:* \`${orderId}\`
• *Routing Mode:* \`${mode}\`
────────────
_QP Order Management System (OMS)_`;
}

export function formatTslAlert(
  symbol: string,
  stateIndex: number,
  stateLabel: string,
  newTslPrice: number,
  lockedPnl: number,
  timeIST: string
): string {
  let milestoneHeader = '🛡️ *QP — TSL STATE PROGRESSION*';
  let badge = 'STATE UPDATE';
  if (stateIndex === 2) {
    milestoneHeader = '🛡️ *QP — BREAKEVEN (+1R) ACHIEVED!*';
    badge = 'RISK FREE (0R)';
  } else if (stateIndex === 3) {
    milestoneHeader = '💰 *QP — PROFIT LOCKED (+2R) ACHIEVED!*';
    badge = 'PROFIT LOCKED (+1R)';
  } else if (stateIndex === 4) {
    milestoneHeader = '🎯 *QP — TRADE CLOSED (TARGET / SL)*';
    badge = 'POSITION CLOSED';
  }

  const pnlSign = lockedPnl >= 0 ? '+' : '';
  const pnlEmoji = lockedPnl >= 0 ? '🟢' : '🔴';

  return `${milestoneHeader}
────────────
• *Instrument:* \`${symbol}\`
• *Milestone:* \`${stateLabel}\` [${badge}]
• *Trailing SL Price:* \`₹${newTslPrice.toFixed(2)}\`
• *Locked / Realized P&L:* ${pnlEmoji} \`₹${pnlSign}${lockedPnl.toFixed(2)}\`
• *Timestamp:* \`${timeIST} IST\`
────────────
_QP High-Frequency Trailing Stop-Loss Engine_`;
}

export function formatAutoPilotAlert(stepNumber: number, stepName: string, details: string, timeIST: string): string {
  return `🤖 *QP — PRE-MARKET AUTO-PILOT (Step ${stepNumber}/4)*
────────────
• *Action:* \`${stepName}\`
• *Status:* ✅ COMPLETED
• *Execution Time:* \`${timeIST} IST\`
• *Details:* ${details}
────────────
⚡ _Automated NSE/BSE Pre-Market Pipeline (QuantPulse)_`;
}

export function formatKillSwitchAlert(closedCount: number, timeIST: string): string {
  return `🛑 *QP — EMERGENCY PANIC KILL SWITCH ACTIVATED!*
────────────
• *Action:* Emergency Portfolio Flattening
• *Closed Positions:* \`${closedCount} Trade(s) Squared Off\`
• *Execution Mode:* 🔒 Forced to \`MANUAL\`
• *Feed Status:* Ingestion Stream Halted
• *Timestamp:* \`${timeIST} IST\`
────────────
⚠️ _QP Risk Engine: Emergency Protocol Executed_`;
}

export function formatNifty0920SelectionAlert(
  expiry: string,
  ceSymbol: string,
  cePrice: number,
  ceSl: number,
  peSymbol: string,
  pePrice: number,
  peSl: number,
  timeIST: string
): string {
  return `🌙 *QP — NIFTY 09:20 STRADDLE LOCKED!*
────────────
• *Strategy ID:* \`NIFTY_0920_PREMIUM_625_OVERNIGHT\`
• *Expiry:* \`${expiry}\`
• *Selection Time:* \`${timeIST} IST\`
• *CE Leg:* \`${ceSymbol}\` @ \`₹${cePrice.toFixed(2)}\` (SL: \`₹${ceSl.toFixed(2)}\`)
• *PE Leg:* \`${peSymbol}\` @ \`₹${pePrice.toFixed(2)}\` (SL: \`₹${peSl.toFixed(2)}\`)
• *Core Invariant:* ⚠️ *NO TARGET* (Hold overnight if SL not hit)
• *Mandatory Exit:* 09:25 AM IST Next Trading Day
────────────
_QP Nifty Overnight Option Engine_`;
}

export function formatNifty0920SlAlert(
  legType: 'CE' | 'PE',
  symbol: string,
  refPrice: number,
  slPrice: number,
  lossAmount: number,
  timeIST: string
): string {
  return `🚨 *QP — NIFTY 09:20 STOP LOSS HIT!*
────────────
• *Leg:* \`${legType} (${symbol})\`
• *Reference Price:* \`₹${refPrice.toFixed(2)}\`
• *Exit Price:* \`₹${slPrice.toFixed(2)}\` (-25% Fixed SL)
• *Loss Realized:* \`-₹${Math.abs(lossAmount).toFixed(2)}\`
• *Action:* Sold immediately. Will *NOT* carry overnight.
• *Timestamp:* \`${timeIST} IST\`
────────────
_QP Risk Engine: Strict 25% Capital Protection_`;
}

export function formatNifty0920ExitAlert(
  reason: string,
  ceExit: number,
  cePnl: number,
  peExit: number,
  pePnl: number,
  netPnl: number,
  timeIST: string
): string {
  const pnlSign = netPnl >= 0 ? '+' : '';
  const pnlEmoji = netPnl >= 0 ? '🟢' : '🔴';
  return `🎯 *QP — NIFTY 09:20 MANDATORY EXIT!*
────────────
• *Action:* \`09:25 AM IST Next-Day Portfolio Exit\`
• *CE Exit Price:* \`₹${ceExit.toFixed(2)}\` (P&L: \`₹${cePnl.toFixed(2)}\`)
• *PE Exit Price:* \`₹${peExit.toFixed(2)}\` (P&L: \`₹${pePnl.toFixed(2)}\`)
• *Combined Realized P&L:* ${pnlEmoji} \`₹${pnlSign}${netPnl.toFixed(2)}\`
• *Reason:* \`${reason}\`
• *Timestamp:* \`${timeIST} IST\`
────────────
_QP Nifty Overnight Option Engine_`;
}
