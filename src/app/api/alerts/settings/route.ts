import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  getUserAlertSettings,
  saveUserAlertSettings,
  maskTelegramToken,
} from '@/lib/services/alertSettingsService';

async function resolveUserFromRequest(req: NextRequest) {
  if (!isSupabaseConfigured || !supabase) return null;

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        return data.user;
      }
    }
  }

  // Check custom user ID header if passed by client
  const customUserId = req.headers.get('x-user-id');
  if (customUserId) {
    return { id: customUserId, email: null };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUserFromRequest(req);
    const defaultToken = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_DEFAULT_TELEGRAM_BOT_TOKEN || '';
    const defaultChat = process.env.TELEGRAM_CHAT_ID || process.env.NEXT_PUBLIC_DEFAULT_TELEGRAM_CHAT_ID || '-1004477627015';

    if (!user) {
      return NextResponse.json({
        success: true,
        isAuthenticated: false,
        settings: {
          telegramBotToken: '',
          maskedBotToken: defaultToken ? maskTelegramToken(defaultToken) : '',
          telegramChatId: defaultChat,
          telegramCrossoverEnabled: true,
          telegramOrderEnabled: true,
          telegramTslEnabled: true,
          telegramAutoPilotEnabled: true,
          telegramKillSwitchEnabled: true,
          telegramNiftyOvernightEnabled: true,
          hasBotToken: Boolean(defaultToken),
        },
      });
    }

    const settings = await getUserAlertSettings(user.id);

    if (!settings) {
      return NextResponse.json({
        success: true,
        isAuthenticated: true,
        userId: user.id,
        settings: {
          telegramBotToken: '',
          maskedBotToken: defaultToken ? maskTelegramToken(defaultToken) : '',
          telegramChatId: defaultChat,
          telegramCrossoverEnabled: true,
          telegramOrderEnabled: true,
          telegramTslEnabled: true,
          telegramAutoPilotEnabled: true,
          telegramKillSwitchEnabled: true,
          telegramNiftyOvernightEnabled: true,
          hasBotToken: Boolean(defaultToken),
        },
      });
    }

    return NextResponse.json({
      success: true,
      isAuthenticated: true,
      userId: user.id,
      settings: {
        maskedBotToken: settings.maskedBotToken || maskTelegramToken(settings.telegramBotToken),
        hasBotToken: Boolean(settings.telegramBotToken),
        telegramChatId: settings.telegramChatId,
        telegramCrossoverEnabled: settings.telegramCrossoverEnabled,
        telegramOrderEnabled: settings.telegramOrderEnabled,
        telegramTslEnabled: settings.telegramTslEnabled,
        telegramAutoPilotEnabled: settings.telegramAutoPilotEnabled,
        telegramKillSwitchEnabled: settings.telegramKillSwitchEnabled,
        telegramNiftyOvernightEnabled: settings.telegramNiftyOvernightEnabled,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Failed to fetch settings: ${err.message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUserFromRequest(req);
    const body = await req.json();

    const targetUserId = user?.id || body.userId;

    if (!targetUserId) {
      return NextResponse.json({
        success: true,
        isAuthenticated: false,
        message: 'Saved to local session (sign in with QuantPulse account for cross-device cloud persistence).',
      });
    }

    const result = await saveUserAlertSettings({
      userId: targetUserId,
      telegramBotToken: body.botToken,
      telegramChatId: body.chatId,
      telegramCrossoverEnabled: body.notifyCrossover,
      telegramOrderEnabled: body.notifyOrder,
      telegramTslEnabled: body.notifyTsl,
      telegramAutoPilotEnabled: body.notifyAutoPilot,
      telegramKillSwitchEnabled: body.notifyKillSwitch,
      telegramNiftyOvernightEnabled: body.notifyNiftyOvernight,
    });

    return NextResponse.json({
      ...result,
      isAuthenticated: Boolean(user),
      maskedBotToken: result.data ? maskTelegramToken(result.data.telegramBotToken) : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Failed to save alert settings: ${err.message}` },
      { status: 500 }
    );
  }
}
