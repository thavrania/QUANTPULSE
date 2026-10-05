import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/alerts/telegramService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { botToken, chatId, message, testPing } = body;

    const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chat = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chat) {
      return NextResponse.json(
        { success: false, message: 'Telegram Bot Token and Chat ID are required.' },
        { status: 400 }
      );
    }

  const localDateString: string = new Date().toLocaleDateString();
    const textToSend =
      testPing
        ? `🔔 *QuantPulse *\n──────────\n✅ Connection today!\n You will now receive instant push alerts for 20-Day VOL Crossovers.\n\n_Market Engine: Nominal • ${localDateString}_`
        : message || 'QuantPulse Alert Event';

    const result = await sendTelegramMessage(token, chat, textToSend);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Alert dispatch error: ${err.message}` },
      { status: 500 }
    );
  }
}
