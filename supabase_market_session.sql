-- =====================================================================
-- QUANTPULSE — Market-Day Lifecycle State Machine & Target Tracking Schema
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/cmcgvadapaoapxrxdcau/sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. MARKET_SESSION TABLE (Single source of truth for persistent session state)
CREATE TABLE IF NOT EXISTS public.market_session (
    trading_date DATE PRIMARY KEY,
    market_state VARCHAR(35) NOT NULL DEFAULT 'PRE_MARKET',
    initialization_status VARCHAR(25) NOT NULL DEFAULT 'PENDING',
    live_sync_status VARCHAR(25) NOT NULL DEFAULT 'PENDING',
    twenty_day_sync_status VARCHAR(25) NOT NULL DEFAULT 'PENDING',
    live_feed_status VARCHAR(25) NOT NULL DEFAULT 'STOPPED',
    trade_mode VARCHAR(15) NOT NULL DEFAULT 'AUTO',
    started_at TIMESTAMPTZ,
    live_feed_started_at TIMESTAMPTZ,
    live_feed_stopped_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_error TEXT,
    retry_count INT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index on trading_date
CREATE INDEX IF NOT EXISTS idx_market_session_date ON public.market_session(trading_date);

-- 2. ENHANCE TRADE_LOGS FOR PI% TARGET TRACKING & REPORTING
ALTER TABLE public.trade_logs ADD COLUMN IF NOT EXISTS buy_value NUMERIC(14, 2);
ALTER TABLE public.trade_logs ADD COLUMN IF NOT EXISTS pi_pct NUMERIC(6, 4) DEFAULT 3.1416;
ALTER TABLE public.trade_logs ADD COLUMN IF NOT EXISTS target_1 NUMERIC(10, 2);
ALTER TABLE public.trade_logs ADD COLUMN IF NOT EXISTS target_2 NUMERIC(10, 2);
ALTER TABLE public.trade_logs ADD COLUMN IF NOT EXISTS target_3 NUMERIC(10, 2);
ALTER TABLE public.trade_logs ADD COLUMN IF NOT EXISTS target_4 NUMERIC(10, 2);
ALTER TABLE public.trade_logs ADD COLUMN IF NOT EXISTS highest_target_achieved VARCHAR(10) DEFAULT 'NONE';
ALTER TABLE public.trade_logs ADD COLUMN IF NOT EXISTS target_achievement_time VARCHAR(30);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.market_session ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous read on market_session" ON public.market_session;
CREATE POLICY "Allow anonymous read on market_session" ON public.market_session FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous insert on market_session" ON public.market_session;
CREATE POLICY "Allow anonymous insert on market_session" ON public.market_session FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous update on market_session" ON public.market_session;
CREATE POLICY "Allow anonymous update on market_session" ON public.market_session FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous delete on market_session" ON public.market_session;
CREATE POLICY "Allow anonymous delete on market_session" ON public.market_session FOR DELETE TO anon USING (true);

-- 4. REALTIME PUBLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_session;
