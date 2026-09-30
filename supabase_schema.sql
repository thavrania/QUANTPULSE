-- =====================================================================
-- QUANTPULSE: Supabase PostgreSQL Schema & Realtime Setup
-- Architecture: 20-Day Volume Crossover & Options Execution Terminal
-- Target: Free Supabase Cloud PostgreSQL Instance
-- =====================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. WATCHLIST TABLE (Monitors symbols and volume progress)
CREATE TABLE IF NOT EXISTS public.watchlist (
    ticker VARCHAR(20) PRIMARY KEY,
    short_name VARCHAR(50),
    name VARCHAR(120) NOT NULL,
    isin VARCHAR(30),
    segment VARCHAR(20) DEFAULT 'NSE_FNO',
    sector VARCHAR(100),
    security_id VARCHAR(20),
    is_fno BOOLEAN DEFAULT TRUE,
    lot_size INT DEFAULT 1,
    strike_step NUMERIC(8, 2) DEFAULT 20,
    spot_ltp NUMERIC(10, 2) NOT NULL,
    today_vol_m NUMERIC(10, 3) NOT NULL,
    avg_vol_20d_m NUMERIC(10, 3) NOT NULL,
    has_crossed_20d BOOLEAN DEFAULT FALSE,
    crossover_time VARCHAR(20),
    crossover_spot_price NUMERIC(10, 2),
    iv_pct NUMERIC(5, 2) DEFAULT 0,
    is_active_watchlist BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS isin VARCHAR(30);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS segment VARCHAR(20) DEFAULT 'NSE_FNO';
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS security_id VARCHAR(20);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS is_active_watchlist BOOLEAN DEFAULT TRUE;

-- 2. CROSSOVER_EVENTS TABLE (Immutable audit log of exact HH:MM:SS crossovers)
CREATE TABLE IF NOT EXISTS public.crossover_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker VARCHAR(20) NOT NULL REFERENCES public.watchlist(ticker) ON DELETE CASCADE,
    time_ist VARCHAR(20) NOT NULL,
    avg_vol_20d_m NUMERIC(10, 3) NOT NULL,
    cross_price NUMERIC(10, 2) NOT NULL,
    is_fno BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crossover_events_ticker_day 
ON public.crossover_events (ticker, ((created_at AT TIME ZONE 'UTC')::date));

-- 3. ACTIVE_POSITIONS TABLE (Zone E executed trades & trailing stop-loss state machine)
CREATE TABLE IF NOT EXISTS public.active_positions (
    id VARCHAR(50) PRIMARY KEY,
    order_time VARCHAR(20) NOT NULL,
    crossover_time VARCHAR(20) NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    execution_mode VARCHAR(10) NOT NULL CHECK (execution_mode IN ('MANUAL', 'AUTO')),
    instrument_type VARCHAR(50) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    lots INT,
    entry_price NUMERIC(10, 2) NOT NULL,
    current_ltp NUMERIC(10, 2) NOT NULL,
    risk_per_unit NUMERIC(10, 2) NOT NULL,
    active_trailing_sl NUMERIC(10, 2) NOT NULL,
    target_price NUMERIC(10, 2) NOT NULL,
    state_index INT DEFAULT 1 CHECK (state_index BETWEEN 1 AND 4),
    state_label VARCHAR(50) DEFAULT 'State 1: Initial SL (1R)',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. SYSTEM_CONFIG TABLE (Global master toggles and capital controls)
CREATE TABLE IF NOT EXISTS public.system_config (
    id VARCHAR(20) PRIMARY KEY DEFAULT 'GLOBAL_CONFIG',
    instrument_mode VARCHAR(10) DEFAULT 'STOCK' CHECK (instrument_mode IN ('STOCK', 'OPTION')),
    execution_mode VARCHAR(10) DEFAULT 'MANUAL' CHECK (execution_mode IN ('MANUAL', 'AUTO')),
    capital_per_trade NUMERIC(12, 2) DEFAULT 100000.00,
    max_open_positions INT DEFAULT 5,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================================
-- SEED INITIAL DATA
-- =====================================================================

INSERT INTO public.watchlist (ticker, short_name, name, isin, segment, sector, security_id, is_fno, lot_size, strike_step, spot_ltp, today_vol_m, avg_vol_20d_m, has_crossed_20d, crossover_time, crossover_spot_price, iv_pct, is_active_watchlist)
VALUES
    ('RELIANCE', 'Reliance', 'Reliance Industries Limited', 'INE002A01018', 'NSE_FNO', 'Oil & Gas / Conglomerate', '1330', true, 250, 50, 2968.50, 5.82, 5.20, true, '09:48:12', 2954.00, 18.4, true),
    ('TATAMOTORS', 'Tata Motors', 'Tata Motors Limited', 'INE155A01022', 'NSE_FNO', 'Automobile Manufacturers', '3456', true, 550, 20, 984.40, 9.45, 8.90, true, '10:19:05', 976.50, 23.8, true),
    ('TCS', 'TCS', 'Tata Consultancy Services Limited', 'INE467B01029', 'NSE_FNO', 'Information Technology', '11536', true, 175, 50, 4126.00, 1.45, 1.50, false, NULL, NULL, 16.2, true),
    ('ZOMATO', 'Zomato', 'Zomato Limited', 'INE758T01015', 'NSE_FNO', 'Online Food Delivery & Quick Commerce', '5097', true, 2500, 5, 264.80, 18.47, 19.00, false, NULL, NULL, 28.5, true),
    ('ICICIBANK', 'ICICI Bank', 'ICICI Bank Limited', 'INE090A01021', 'NSE_FNO', 'Private Banking & Financials', '4963', true, 700, 20, 1258.00, 6.44, 7.00, false, NULL, NULL, 15.6, true),
    ('HDFCBANK', 'HDFC Bank', 'HDFC Bank Limited', 'INE040A01034', 'NSE_FNO', 'Private Banking & Financials', '1333', true, 550, 20, 1644.20, 4.70, 6.00, false, NULL, NULL, 14.9, true)
ON CONFLICT (ticker) DO UPDATE SET
    short_name = EXCLUDED.short_name,
    name = EXCLUDED.name,
    isin = EXCLUDED.isin,
    segment = EXCLUDED.segment,
    sector = EXCLUDED.sector,
    security_id = EXCLUDED.security_id;

INSERT INTO public.crossover_events (ticker, time_ist, avg_vol_20d_m, cross_price, is_fno)
VALUES
    ('TATAMOTORS', '10:19:05', 8.90, 976.50, true),
    ('RELIANCE', '09:48:12', 5.20, 2954.00, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.system_config (id, instrument_mode, execution_mode, capital_per_trade, max_open_positions)
VALUES ('GLOBAL_CONFIG', 'STOCK', 'MANUAL', 100000.00, 5)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Free Public / Anonymous Demo Access + Secure Mutation
-- =====================================================================

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crossover_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read on all tables
CREATE POLICY "Allow anonymous select on watchlist" ON public.watchlist FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous select on crossover_events" ON public.crossover_events FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous select on active_positions" ON public.active_positions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous select on system_config" ON public.system_config FOR SELECT TO anon USING (true);

-- Allow anonymous insert/update for demo purposes (can be restricted to authenticated later)
CREATE POLICY "Allow anonymous insert on watchlist" ON public.watchlist FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update on watchlist" ON public.watchlist FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous insert on crossover_events" ON public.crossover_events FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous insert on active_positions" ON public.active_positions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update on active_positions" ON public.active_positions FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anonymous update on system_config" ON public.system_config FOR UPDATE TO anon USING (true);

-- =====================================================================
-- ENABLE SUPABASE REALTIME REPLICATION (Instant WebSocket Push)
-- =====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.watchlist;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crossover_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_config;
