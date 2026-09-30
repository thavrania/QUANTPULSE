import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { getActiveBrokerCredentials } from '@/lib/services/brokerVaultService';
import { DHAN_BASE_URL, getDhanSecurityId } from '@/lib/broker/dhan/dhanConstants';
import { sendTelegramMessage } from '@/lib/alerts/telegramService';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel Pro/Hobby

function getISTDate(date = new Date()): { dateStr: string; timeStr: string } {
  const utcTime = date.getTime();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(utcTime + istOffsetMs);
  const isoStr = istDate.toISOString();
  const dateStr = isoStr.slice(0, 10);
  const timeStr = isoStr.slice(11, 19);
  return { dateStr, timeStr };
}

export async function GET(req: NextRequest) {
  return handleMarketCloseArchive(req);
}

export async function POST(req: NextRequest) {
  return handleMarketCloseArchive(req);
}

async function handleMarketCloseArchive(req: NextRequest) {
  const { dateStr, timeStr } = getISTDate();

  // 1. Verify Vercel Cron Secret if set
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // In production, reject unauthorized calls if secret is set and header doesn't match
    const url = new URL(req.url);
    const keyParam = url.searchParams.get('key');
    if (keyParam !== cronSecret && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, message: 'Unauthorized cron request.' }, { status: 401 });
    }
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { success: false, message: 'Supabase is not configured on this server.' },
      { status: 500 }
    );
  }

  const client = supabase;
  const closedPositions: any[] = [];
  let dhanSquareOffCount = 0;

  try {
    // 2. Fetch active broker credentials if live square-off is possible
    const vault = await getActiveBrokerCredentials();
    const hasLiveDhan = Boolean(vault.clientId && vault.accessToken);

    // 3. Fetch open active positions (state_index < 4)
    const { data: openPositions, error: posError } = await client
      .from('active_positions')
      .select('*')
      .lt('state_index', 4);

    if (posError) {
      console.warn('Error fetching active_positions for EOD close:', posError.message);
    }

    if (openPositions && openPositions.length > 0) {
      for (const pos of openPositions) {
        const exitPrice = Number(pos.current_ltp) || Number(pos.entry_price) || 1000;
        const entryPrice = Number(pos.entry_price) || exitPrice;
        const quantity = Number(pos.quantity) || 1;
        const realizedPnl = +((exitPrice - entryPrice) * quantity).toFixed(2);

        // If position is routed to LIVE_DHAN, trigger square-off order with Dhan HQ
        if (pos.execution_mode === 'LIVE_DHAN' && hasLiveDhan) {
          try {
            const isOption = pos.instrument_type?.includes('OPTION');
            const exchangeSegment = isOption ? 'NSE_FNO' : 'NSE_EQ';
            const securityId = getDhanSecurityId(pos.ticker);

            const squareOffPayload = {
              dhanClientId: vault.clientId,
              transactionType: 'SELL',
              exchangeSegment,
              productType: 'INTRADAY',
              orderType: 'MARKET',
              validity: 'DAY',
              securityId,
              quantity,
              price: 0,
              triggerPrice: 0,
            };

            const dhanRes = await fetch(`${DHAN_BASE_URL}/orders`, {
              method: 'POST',
              headers: {
                'access-token': vault.accessToken,
                'client-id': vault.clientId,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(squareOffPayload),
            });

            if (dhanRes.ok) {
              dhanSquareOffCount++;
            }
          } catch (dhanErr: any) {
            console.warn(`Dhan square-off failed for ${pos.symbol}:`, dhanErr.message);
          }
        }

        // Close position in active_positions table
        await client
          .from('active_positions')
          .update({
            state_index: 4,
            state_label: 'State 4: EOD Square-Off (3:35 PM)',
            current_ltp: exitPrice,
          })
          .eq('id', pos.id);

        // Close order in trade_logs table
        await client
          .from('trade_logs')
          .update({
            status: 'CLOSED',
            exit_price: exitPrice,
            realized_pnl: realizedPnl,
            closed_at: new Date().toISOString(),
          })
          .eq('order_id', pos.id);

        // Append transition to tsl_audit_trail
        await client.from('tsl_audit_trail').insert({
          position_id: pos.id,
          symbol: pos.symbol,
          from_state: pos.state_index,
          to_state: 4,
          from_label: pos.state_label,
          to_label: 'State 4: EOD Square-Off (3:35 PM)',
          spot_price_at_transition: exitPrice,
          new_trailing_sl: exitPrice,
          pnl_locked: realizedPnl,
          timestamp_ist: `${timeStr} IST`,
        });

        closedPositions.push({
          id: pos.id,
          symbol: pos.symbol,
          entryPrice,
          exitPrice,
          realizedPnl,
        });
      }
    }

    // 4. Query all trade_logs from today to calculate performance journal metrics
    const { data: todayTrades } = await client
      .from('trade_logs')
      .select('*')
      .gte('created_at', `${dateStr}T00:00:00`);

    const tradesList = todayTrades || [];
    const totalTrades = tradesList.length;
    const winningTrades = tradesList.filter((t: any) => Number(t.realized_pnl) > 0).length;
    const losingTrades = tradesList.filter((t: any) => Number(t.realized_pnl) < 0).length;
    const winRatePct = totalTrades > 0 ? +((winningTrades / totalTrades) * 100).toFixed(1) : 0;
    const grossRealizedPnl = +tradesList
      .reduce((sum: number, t: any) => sum + (Number(t.realized_pnl) || 0), 0)
      .toFixed(2);

    const symbolsTraded = Array.from(new Set(tradesList.map((t: any) => t.ticker || t.symbol)));

    // Calculate max drawdown on today's trades
    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (const t of tradesList) {
      cumulative += Number(t.realized_pnl) || 0;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // 5. Upsert into daily_pnl_journal
    const journalPayload = {
      trading_date: dateStr,
      total_trades: totalTrades,
      winning_trades: winningTrades,
      losing_trades: losingTrades,
      win_rate_pct: winRatePct,
      gross_realized_pnl: grossRealizedPnl,
      max_drawdown: +maxDrawdown.toFixed(2),
      symbols_traded: symbolsTraded,
      notes: `EOD Automated Square-Off executed at ${timeStr} IST. ${closedPositions.length} open position(s) closed. ${dhanSquareOffCount} live broker square-off(s) dispatched.`,
    };

    const { error: journalErr } = await client
      .from('daily_pnl_journal')
      .upsert(journalPayload, { onConflict: 'trading_date' });

    if (journalErr) {
      console.warn('Error saving daily_pnl_journal:', journalErr.message);
    }

    // 6. Reset intraday volume & crossover latch in watchlist for clean day end
    await client
      .from('watchlist')
      .update({
        today_vol_m: 0.0,
        has_crossed_20d: false,
        crossover_time: null,
        crossover_spot_price: null,
        updated_at: new Date().toISOString(),
      })
      .neq('ticker', 'DUMMY_NEVER_MATCH');

    // 7. Dispatch Telegram Summary Report
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      const pnlSign = grossRealizedPnl >= 0 ? '+' : '';
      const pnlEmoji = grossRealizedPnl >= 0 ? '🟢' : '🔴';

      const summaryMsg = `📊 *QUANTPULSE — POST-MARKET CLOSING & JOURNAL ARCHIVED*
──────────────────────
• *Date:* \`${dateStr}\` (\`15:35 IST\`)
• *Total Trades:* \`${totalTrades}\` (Win: \`${winningTrades}\` | Loss: \`${losingTrades}\`)
• *Win Rate:* \`${winRatePct}%\`
• *Gross Realized P&L:* ${pnlEmoji} \`₹${pnlSign}${grossRealizedPnl.toLocaleString('en-IN')}\`
• *Max Drawdown:* \`₹${maxDrawdown.toFixed(2)}\`
• *Symbols Traded:* \`${symbolsTraded.join(', ') || 'None'}\`
• *Intraday Positions Closed:* \`${closedPositions.length}\`
──────────────────────
_QuantPulse Automated EOD Cloud Pipeline_`;

      await sendTelegramMessage(botToken, chatId, summaryMsg);
    }

    return NextResponse.json({
      success: true,
      message: `Market Close & Archive completed for ${dateStr} at ${timeStr} IST.`,
      closedPositionsCount: closedPositions.length,
      dhanSquareOffCount,
      journalSummary: journalPayload,
    });
  } catch (err: any) {
    console.error('Error in market-close-archive:', err);
    return NextResponse.json(
      { success: false, message: `Market Close Archive error: ${err.message}` },
      { status: 500 }
    );
  }
}
