-- =====================================================================
-- QUANTPULSE — Database Migration: User Alert Settings Persistence
-- Cross-Device Telegram Credentials & Notification Preferences
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USER_ALERT_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.user_alert_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    telegram_crossover_enabled BOOLEAN DEFAULT true,
    telegram_order_enabled BOOLEAN DEFAULT true,
    telegram_tsl_enabled BOOLEAN DEFAULT true,
    telegram_autopilot_enabled BOOLEAN DEFAULT true,
    telegram_killswitch_enabled BOOLEAN DEFAULT true,
    telegram_nifty_overnight_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_user_alert_settings_user UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_alert_settings_user ON public.user_alert_settings(user_id);

-- 2. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.user_alert_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage exclusively their own alert settings
DROP POLICY IF EXISTS "Users can view own alert settings" ON public.user_alert_settings;
CREATE POLICY "Users can view own alert settings" 
ON public.user_alert_settings FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own alert settings" ON public.user_alert_settings;
CREATE POLICY "Users can insert own alert settings" 
ON public.user_alert_settings FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own alert settings" ON public.user_alert_settings;
CREATE POLICY "Users can update own alert settings" 
ON public.user_alert_settings FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Allow anonymous access for demo mode fallback when no user is signed in
DROP POLICY IF EXISTS "Allow anon select user_alert_settings" ON public.user_alert_settings;
CREATE POLICY "Allow anon select user_alert_settings" 
ON public.user_alert_settings FOR SELECT 
TO anon 
USING (true);

DROP POLICY IF EXISTS "Allow anon insert user_alert_settings" ON public.user_alert_settings;
CREATE POLICY "Allow anon insert user_alert_settings" 
ON public.user_alert_settings FOR INSERT 
TO anon 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update user_alert_settings" ON public.user_alert_settings;
CREATE POLICY "Allow anon update user_alert_settings" 
ON public.user_alert_settings FOR UPDATE 
TO anon 
USING (true) 
WITH CHECK (true);
