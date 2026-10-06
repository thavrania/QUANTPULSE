-- =====================================================================
-- QUANTPULSE — Database Migration: Centralized Market Data & Feed Architecture
-- Single-Row-per-Ticker Snapshots, Distributed Leases, Feed Health & Alert Deduplication
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. LIVE_TICK_SNAPSHOTS TABLE ENHANCEMENT
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_tick_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker VARCHAR(20) NOT NULL,
    security_id VARCHAR(20),
    ltp NUMERIC(10, 2) NOT NULL DEFAULT 0,
    open NUMERIC(10, 2) DEFAULT 0,
    high NUMERIC(10, 2) DEFAULT 0,
    low NUMERIC(10, 2) DEFAULT 0,
    previous_close NUMERIC(10, 2) DEFAULT 0,
    change_pct NUMERIC(6, 2) DEFAULT 0,
    today_traded_shares BIGINT DEFAULT 0,
    today_volume_m NUMERIC(16, 6) DEFAULT 0,
    avg_vol_20d_m NUMERIC(16, 6) DEFAULT 0,
    avg_20d_traded_shares BIGINT DEFAULT 0,
    average_price NUMERIC(10, 2) DEFAULT 0,
    last_trade_time VARCHAR(40),
    source VARCHAR(30) DEFAULT 'DHAN_HQ',
    feed_status VARCHAR(20) DEFAULT 'CONNECTED',
    has_crossed_20d BOOLEAN DEFAULT false,
    crossover_time VARCHAR(20),
    crossover_spot_price NUMERIC(10, 2),
    timestamp_ist VARCHAR(30),
    rvol_ratio NUMERIC(6, 2) DEFAULT 1.0,
    received_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add any missing columns to existing table
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS security_id VARCHAR(20);
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS ltp NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS open NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS high NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS low NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS previous_close NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS change_pct NUMERIC(6, 2) DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS today_traded_shares BIGINT DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS today_volume_m NUMERIC(16, 6) DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS avg_vol_20d_m NUMERIC(16, 6) DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS avg_20d_traded_shares BIGINT DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS average_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS last_trade_time VARCHAR(40);
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'DHAN_HQ';
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS feed_status VARCHAR(20) DEFAULT 'CONNECTED';
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS has_crossed_20d BOOLEAN DEFAULT false;
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS crossover_time VARCHAR(20);
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS crossover_spot_price NUMERIC(10, 2);
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());
ALTER TABLE public.live_tick_snapshots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());

-- Ensure unique constraint on ticker for upserting single latest snapshot per ticker
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_live_tick_snapshots_ticker'
    ) THEN
        -- If duplicate tickers exist from historical audit logs, deduplicate before adding constraint
        DELETE FROM public.live_tick_snapshots a
        USING public.live_tick_snapshots b
        WHERE a.ticker = b.ticker AND a.created_at < b.created_at;

        ALTER TABLE public.live_tick_snapshots ADD CONSTRAINT uq_live_tick_snapshots_ticker UNIQUE (ticker);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_live_tick_snapshots_ticker ON public.live_tick_snapshots(ticker);

-- ---------------------------------------------------------------------
-- 2. MARKET_FEED_LEASES TABLE (Distributed Worker Lock)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_feed_leases (
    lease_name VARCHAR(50) PRIMARY KEY DEFAULT 'CENTRAL_MARKET_FEED',
    owner_id VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    heartbeat_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ---------------------------------------------------------------------
-- 3. MARKET_FEED_HEALTH TABLE (Central Feed Telemetry & Status)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_feed_health (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'FEED_HEALTH',
    status VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED' CHECK (status IN ('CONNECTED', 'DEGRADED', 'FALLBACK', 'DISCONNECTED', 'SIMULATION')),
    source VARCHAR(30) NOT NULL DEFAULT 'DHAN_HQ',
    last_successful_update TIMESTAMPTZ,
    latency_ms INT DEFAULT 0,
    error_count INT DEFAULT 0,
    last_error TEXT,
    worker_id VARCHAR(100),
    active_subscribers INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

INSERT INTO public.market_feed_health (id, status, source)
VALUES ('FEED_HEALTH', 'DISCONNECTED', 'DHAN_HQ')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. ALERT_DISPATCH_LOGS TABLE (Deterministic Deduplication Ledger)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alert_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_key VARCHAR(150) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    destination_chat_id VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    dispatched_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_alert_dispatch_key_dest UNIQUE(event_key, destination_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_dispatch_key ON public.alert_dispatch_logs(event_key);

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.live_tick_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_feed_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_feed_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_dispatch_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access
DROP POLICY IF EXISTS "Allow anon read live_tick_snapshots" ON public.live_tick_snapshots;
CREATE POLICY "Allow anon read live_tick_snapshots" ON public.live_tick_snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon write live_tick_snapshots" ON public.live_tick_snapshots;
CREATE POLICY "Allow anon write live_tick_snapshots" ON public.live_tick_snapshots FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on market_feed_leases" ON public.market_feed_leases;
CREATE POLICY "Allow all on market_feed_leases" ON public.market_feed_leases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on market_feed_health" ON public.market_feed_health;
CREATE POLICY "Allow all on market_feed_health" ON public.market_feed_health FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on alert_dispatch_logs" ON public.alert_dispatch_logs;
CREATE POLICY "Allow all on alert_dispatch_logs" ON public.alert_dispatch_logs FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 6. ENABLE SUPABASE REALTIME PUBLICATION
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'live_tick_snapshots'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.live_tick_snapshots;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'market_feed_health'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.market_feed_health;
    END IF;
END $$;
