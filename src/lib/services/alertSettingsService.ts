import { supabase, isSupabaseConfigured } from '../supabaseClient';

export interface UserAlertSettings {
  id?: string;
  userId: string;
  telegramBotToken: string;
  maskedBotToken?: string;
  telegramChatId: string;
  telegramCrossoverEnabled: boolean;
  telegramOrderEnabled: boolean;
  telegramTslEnabled: boolean;
  telegramAutoPilotEnabled: boolean;
  telegramKillSwitchEnabled: boolean;
  telegramNiftyOvernightEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Masks a Telegram bot token so sensitive secrets are never sent in plaintext to clients.
 */
export function maskTelegramToken(token?: string | null): string {
  if (!token) return '';
  const trimmed = token.trim();
  if (trimmed.length <= 10) return '••••••••••';
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}${'•'.repeat(Math.max(8, trimmed.length - 8))}${suffix}`;
}

export function isMaskedToken(token?: string | null): boolean {
  if (!token) return false;
  return token.includes('•') || token.includes('*');
}

/**
 * Fetches alert settings for a specific user ID from Supabase.
 */
export async function getUserAlertSettings(userId: string): Promise<UserAlertSettings | null> {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_alert_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      telegramBotToken: data.telegram_bot_token || '',
      maskedBotToken: maskTelegramToken(data.telegram_bot_token),
      telegramChatId: data.telegram_chat_id || '',
      telegramCrossoverEnabled: data.telegram_crossover_enabled ?? true,
      telegramOrderEnabled: data.telegram_order_enabled ?? true,
      telegramTslEnabled: data.telegram_tsl_enabled ?? true,
      telegramAutoPilotEnabled: data.telegram_autopilot_enabled ?? true,
      telegramKillSwitchEnabled: data.telegram_killswitch_enabled ?? true,
      telegramNiftyOvernightEnabled: data.telegram_nifty_overnight_enabled ?? true,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.warn('[AlertSettingsService] Error loading user alert settings:', err);
    return null;
  }
}

/**
 * Saves or updates alert settings for a user.
 * If incoming token is masked or empty, preserves the existing stored token.
 */
export async function saveUserAlertSettings(settings: Partial<UserAlertSettings> & { userId: string }): Promise<{
  success: boolean;
  message: string;
  data?: UserAlertSettings;
}> {
  if (!isSupabaseConfigured || !supabase || !settings.userId) {
    return { success: false, message: 'Database not available or user not specified' };
  }

  try {
    // 1. Check if user already has an existing row
    const existing = await getUserAlertSettings(settings.userId);
    let resolvedToken = (settings.telegramBotToken || '').trim();

    // If incoming token is masked or blank, retain previous unmasked token
    if (isMaskedToken(resolvedToken) || !resolvedToken) {
      if (existing?.telegramBotToken) {
        resolvedToken = existing.telegramBotToken;
      }
    }

    const payload = {
      user_id: settings.userId,
      telegram_bot_token: resolvedToken,
      telegram_chat_id: (settings.telegramChatId || '').trim(),
      telegram_crossover_enabled: settings.telegramCrossoverEnabled ?? true,
      telegram_order_enabled: settings.telegramOrderEnabled ?? true,
      telegram_tsl_enabled: settings.telegramTslEnabled ?? true,
      telegram_autopilot_enabled: settings.telegramAutoPilotEnabled ?? true,
      telegram_killswitch_enabled: settings.telegramKillSwitchEnabled ?? true,
      telegram_nifty_overnight_enabled: settings.telegramNiftyOvernightEnabled ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_alert_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      console.warn('[AlertSettingsService] Upsert error:', error.message);
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: 'Alert settings persisted successfully.',
      data: {
        id: data.id,
        userId: data.user_id,
        telegramBotToken: data.telegram_bot_token,
        maskedBotToken: maskTelegramToken(data.telegram_bot_token),
        telegramChatId: data.telegram_chat_id,
        telegramCrossoverEnabled: data.telegram_crossover_enabled,
        telegramOrderEnabled: data.telegram_order_enabled,
        telegramTslEnabled: data.telegram_tsl_enabled,
        telegramAutoPilotEnabled: data.telegram_autopilot_enabled,
        telegramKillSwitchEnabled: data.telegram_killswitch_enabled,
        telegramNiftyOvernightEnabled: data.telegram_nifty_overnight_enabled,
        updatedAt: data.updated_at,
      },
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to save alert settings' };
  }
}

/**
 * Retrieves all enabled alert destinations for a given alert category
 * Used by server-side centralized alert dispatcher.
 */
export async function getActiveAlertDestinations(
  alertCategory: 'CROSSOVER' | 'ORDER' | 'TSL' | 'AUTOPILOT' | 'KILL_SWITCH' | 'NIFTY_OVERNIGHT'
): Promise<Array<{ botToken: string; chatId: string; userId: string }>> {
  const destinations: Array<{ botToken: string; chatId: string; userId: string }> = [];

  // 1. Check system defaults
  const defaultToken = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_DEFAULT_TELEGRAM_BOT_TOKEN;
  const defaultChat = process.env.TELEGRAM_CHAT_ID || process.env.NEXT_PUBLIC_DEFAULT_TELEGRAM_CHAT_ID;

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('user_alert_settings').select('*');
      switch (alertCategory) {
        case 'CROSSOVER':
          query = query.eq('telegram_crossover_enabled', true);
          break;
        case 'ORDER':
          query = query.eq('telegram_order_enabled', true);
          break;
        case 'TSL':
          query = query.eq('telegram_tsl_enabled', true);
          break;
        case 'AUTOPILOT':
          query = query.eq('telegram_autopilot_enabled', true);
          break;
        case 'KILL_SWITCH':
          query = query.eq('telegram_killswitch_enabled', true);
          break;
        case 'NIFTY_OVERNIGHT':
          query = query.eq('telegram_nifty_overnight_enabled', true);
          break;
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const token = row.telegram_bot_token || defaultToken;
          const chat = row.telegram_chat_id || defaultChat;
          if (token && chat) {
            destinations.push({
              botToken: token,
              chatId: chat,
              userId: row.user_id,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[AlertSettingsService] Error querying destinations:', err);
    }
  }

  // 2. If no user rows matched, fall back to default global channel if configured
  if (destinations.length === 0 && defaultToken && defaultChat) {
    destinations.push({
      botToken: defaultToken,
      chatId: defaultChat,
      userId: 'SYSTEM_GLOBAL',
    });
  }

  return destinations;
}
