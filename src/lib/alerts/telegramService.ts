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

export function formatCrossoverAlert(ticker: string, todayVolM: number, avgVol20DM: number, spotLtp: number, timeIST: string): string {
  const todayShares = Math.round(todayVolM * 1_000_000).toLocaleString('en-IN');
  const avgShares = Math.round(avgVol20DM * 1_000_000).toLocaleString('en-IN');
  return `🚀 *QUANTPULSE — 20D TRADED SHARES CROSSOVER!*
──────────────────────
• *Symbol:* \`${ticker}\`
• *Exact Cross Time:* \`${timeIST} IST\`
• *Today Traded Shares:* \`${todayVolM.toFixed(2)}M\` (\`${todayShares} shares\`)
• *20D Avg Benchmark:* \`${avgVol20DM.toFixed(2)}M\` (\`${avgShares} shares\`)
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
