// =====================================================================
// QUANTPULSE — Instant Alert Engine (Telegram Bot Webhook Service)
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
  avgSharesCount?: number
): string {
  const todayShares = (todaySharesCount !== undefined ? todaySharesCount : Math.round(todayVolM * 1_000_000)).toLocaleString('en-IN');
  const avgShares = (avgSharesCount !== undefined ? avgSharesCount : Math.round(avgVol20DM * 1_000_000)).toLocaleString('en-IN');
  return `🚀 *QUANTPULSE — 20D TRADED SHARES CROSSOVER!*
──────────────────────
• *Symbol:* \`${ticker}\`
• *Exact Cross Time:* \`${timeIST} IST\`
• *Today Traded Shares:* \`${todayShares} shares\` (\`${todayVolM.toFixed(2)}M\`)
• *20D Avg Benchmark:* \`${avgShares} shares\` (\`${avgVol20DM.toFixed(2)}M\`)
• *Spot Price:* \`₹${spotLtp.toFixed(2)}\`
• *Eligibility:* 🟢 *ELIGIBLE FOR BUY*
──────────────────────
_QuantPulse High-Frequency Crossover Engine_`;
}

export function formatOrderAlert(symbol: string, action: string, qty: number, price: number, orderId: string, mode: string): string {
  return `⚡ *QUANTPULSE — ORDER DISPATCHED!*
──────────────────────
• *Instrument:* \`${symbol}\`
• *Action:* \`${action} ${qty} Units\`
• *Price:* \`₹${price.toFixed(2)}\`
• *Order ID:* \`${orderId}\`
• *Routing Mode:* \`${mode}\`
──────────────────────
_QuantPulse Order Management System (OMS)_`;
}

export function formatTslAlert(
  symbol: string,
  stateIndex: number,
  stateLabel: string,
  newTslPrice: number,
  lockedPnl: number,
  timeIST: string
): string {
  let milestoneHeader = '🛡️ *QUANTPULSE — TSL STATE PROGRESSION*';
  let badge = 'STATE UPDATE';
  if (stateIndex === 2) {
    milestoneHeader = '🛡️ *QUANTPULSE — BREAKEVEN (+1R) ACHIEVED!*';
    badge = 'RISK FREE (0R)';
  } else if (stateIndex === 3) {
    milestoneHeader = '💰 *QUANTPULSE — PROFIT LOCKED (+2R) ACHIEVED!*';
    badge = 'PROFIT LOCKED (+1R)';
  } else if (stateIndex === 4) {
    milestoneHeader = '🎯 *QUANTPULSE — TRADE CLOSED (TARGET / SL)*';
    badge = 'POSITION CLOSED';
  }

  const pnlSign = lockedPnl >= 0 ? '+' : '';
  const pnlEmoji = lockedPnl >= 0 ? '🟢' : '🔴';

  return `${milestoneHeader}
──────────────────────
• *Instrument:* \`${symbol}\`
• *Milestone:* \`${stateLabel}\` [${badge}]
• *Trailing SL Price:* \`₹${newTslPrice.toFixed(2)}\`
• *Locked / Realized P&L:* ${pnlEmoji} \`₹${pnlSign}${lockedPnl.toFixed(2)}\`
• *Timestamp:* \`${timeIST} IST\`
──────────────────────
_QuantPulse High-Frequency Trailing Stop-Loss Engine_`;
}

export function formatAutoPilotAlert(stepNumber: number, stepName: string, details: string, timeIST: string): string {
  return `🤖 *QUANTPULSE — PRE-MARKET AUTO-PILOT (Step ${stepNumber}/4)*
──────────────────────
• *Action:* \`${stepName}\`
• *Status:* ✅ COMPLETED
• *Execution Time:* \`${timeIST} IST\`
• *Details:* ${details}
──────────────────────
⚡ _Automated NSE/BSE Pre-Market Pipeline (QuantPulse)_`;
}

export function formatKillSwitchAlert(closedCount: number, timeIST: string): string {
  return `🛑 *QUANTPULSE — EMERGENCY PANIC KILL SWITCH ACTIVATED!*
──────────────────────
• *Action:* Emergency Portfolio Flattening
• *Closed Positions:* \`${closedCount} Trade(s) Squared Off\`
• *Execution Mode:* 🔒 Forced to \`MANUAL\`
• *Feed Status:* Ingestion Stream Halted
• *Timestamp:* \`${timeIST} IST\`
──────────────────────
⚠️ _QuantPulse Risk Engine: Emergency Protocol Executed_`;
}
