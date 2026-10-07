import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/alerts/telegramService';
import { isMaskedToken, getUserAlertSettings } from '@/lib/services/alertSettingsService';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// Server-side in-memory idempotency deduplication cache
const serverDispatchedKeys = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { botToken, chatId, message, testPing, idempotencyKey } = body;

    // Server-side Idempotency Check: suppress duplicate dispatches across multiple browsers/tabs
    const dedupKey = idempotencyKey || (!testPing && message ? `MSG_HASH:${message.trim()}` : null);
    if (dedupKey && serverDispatchedKeys.has(dedupKey)) {
      return NextResponse.json({
        success: true,
        message: 'Alert already dispatched centrally (duplicate suppressed).',
        duplicate: true,
      });
    }

    // Resolve authenticated user if session provided
    let authUserId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ') && isSupabaseConfigured && supabase) {
      const token = authHeader.replace('Bearer ', '').trim();
      const { data } = await supabase.auth.getUser(token);
      if (data?.user) {
        authUserId = data.user.id;
      }
    }

    // If botToken is masked or not provided, resolve unmasked credential from user_alert_settings
    if (!botToken || isMaskedToken(botToken)) {
      if (authUserId) {
        const userSettings = await getUserAlertSettings(authUserId);
        if (userSettings?.telegramBotToken) {
          botToken = userSettings.telegramBotToken;
        }
        if (!chatId && userSettings?.telegramChatId) {
          chatId = userSettings.telegramChatId;
        }
      }
    }

    const token =
      botToken && !isMaskedToken(botToken)
        ? botToken
        : process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_DEFAULT_TELEGRAM_BOT_TOKEN;

    const chat =
      chatId && chatId.trim()
        ? chatId.trim()
        : process.env.TELEGRAM_CHAT_ID || process.env.NEXT_PUBLIC_DEFAULT_TELEGRAM_CHAT_ID;

    if (!token || !chat) {
      return NextResponse.json(
        { success: false, message: 'Telegram Bot Token and Chat ID are required.' },
        { status: 400 }
      );
    }

    const localDateString: string = new Date().toLocaleDateString();
    const textToSend =
      testPing
        ? `🔔 *QP *\n──────────\n✅ Connection verified!\nYou will now receive instant push alerts for 20-Day VOL Crossovers.\n\n_Market Engine: Nominal • ${localDateString}_`
        : message || 'QuantPulse Alert Event';

    const result = await sendTelegramMessage(token, chat, textToSend);

    if (result.success && dedupKey) {
      serverDispatchedKeys.add(dedupKey);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Alert dispatch error: ${err.message}` },
      { status: 500 }
    );
  }
}
