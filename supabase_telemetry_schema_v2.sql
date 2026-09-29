-- =====================================================================
-- QUANTPULSE — Phase 1: Database Hardening & Full Telemetry Schema (v2.0)
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/cmcgvadapaoapxrxdcau/sql
-- =====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. ENHANCE WATCHLIST WITH OHLC & LIVE FEED TELEMETRY
-- ---------------------------------------------------------------------
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS day_high NUMERIC(10, 2);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS day_low NUMERIC(10, 2);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS day_open NUMERIC(10, 2);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS day_close NUMERIC(10, 2);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS change_pct NUMERIC(6, 2) DEFAULT 0;
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS feed_source VARCHAR(20) DEFAULT 'LIVE_DHAN';

-- ---------------------------------------------------------------------
-- 2. TRADE_LOGS TABLE (Permanent Immutable Ledger of All Orders)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trade_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(50) NOT NULL UNIQUE,
    ticker VARCHAR(20) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL')),
    instrument_type VARCHAR(50) NOT NULL,
    routing_mode VARCHAR(20) NOT NULL CHECK (routing_mode IN ('PAPER', 'LIVE_DHAN')),
    quantity INT NOT NULL,
    lots INT,
    entry_price NUMERIC(10, 2) NOT NULL,
    exit_price NUMERIC(10, 2),
    stop_loss NUMERIC(10, 2) NOT NULL,
    target_price NUMERIC(10, 2) NOT NULL,
    realized_pnl NUMERIC(12, 2) DEFAULT 0,
    crossover_ref_time VARCHAR(20),
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for fast lookup by order_id and ticker
CREATE INDEX IF NOT EXISTS idx_trade_logs_order_id ON public.trade_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_trade_logs_ticker ON public.trade_logs(ticker);
CREATE INDEX IF NOT EXISTS idx_trade_logs_status ON public.trade_logs(status);

-- ---------------------------------------------------------------------
-- 3. TSL_AUDIT_TRAIL TABLE (Monitors 4-State Trailing Stop-Loss Milestones)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tsl_audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id VARCHAR(50) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    from_state INT NOT NULL CHECK (from_state BETWEEN 1 AND 4),
    to_state INT NOT NULL CHECK (to_state BETWEEN 1 AND 4),
    from_label VARCHAR(60) NOT NULL,
    to_label VARCHAR(60) NOT NULL,
    spot_price_at_transition NUMERIC(10, 2) NOT NULL,
    option_ltp_at_transition NUMERIC(10, 2),
    new_trailing_sl NUMERIC(10, 2) NOT NULL,
    pnl_locked NUMERIC(12, 2) DEFAULT 0,
    timestamp_ist VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tsl_position_id ON public.tsl_audit_trail(position_id);

-- ---------------------------------------------------------------------
-- 4. DAILY_PNL_JOURNAL TABLE (Post-Market Performance & Journal)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_pnl_journal (
    trading_date DATE PRIMARY KEY,
    total_trades INT DEFAULT 0,
    winning_trades INT DEFAULT 0,
    losing_trades INT DEFAULT 0,
    win_rate_pct NUMERIC(5, 2) DEFAULT 0,
    gross_realized_pnl NUMERIC(12, 2) DEFAULT 0,
    max_drawdown NUMERIC(12, 2) DEFAULT 0,
    symbols_traded TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ---------------------------------------------------------------------
-- 5. LIVE_TICK_SNAPSHOTS TABLE (Intraday Telemetry Snapshots)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_tick_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker VARCHAR(20) NOT NULL,
    timestamp_ist VARCHAR(30) NOT NULL,
    spot_ltp NUMERIC(10, 2) NOT NULL,
    today_vol_m NUMERIC(10, 3) NOT NULL,
    avg_vol_20d_m NUMERIC(10, 3) NOT NULL,
    rvol_ratio NUMERIC(6, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tick_ticker_created ON public.live_tick_snapshots(ticker, created_at DESC);

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.trade_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tsl_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_pnl_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_tick_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow anonymous select on all telemetry tables
CREATE POLICY "Allow anonymous select on trade_logs" ON public.trade_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert on trade_logs" ON public.trade_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update on trade_logs" ON public.trade_logs FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous select on tsl_audit_trail" ON public.tsl_audit_trail FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert on tsl_audit_trail" ON public.tsl_audit_trail FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous select on daily_pnl_journal" ON public.daily_pnl_journal FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert/update on daily_pnl_journal" ON public.daily_pnl_journal FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous select on live_tick_snapshots" ON public.live_tick_snapshots FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert on live_tick_snapshots" ON public.live_tick_snapshots FOR INSERT TO anon WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 7. ENABLE REALTIME REPLICATION (Instant Multi-Device Sync)
-- ---------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tsl_audit_trail;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_pnl_journal;
