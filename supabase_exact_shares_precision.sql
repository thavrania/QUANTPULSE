-- =====================================================================
-- QUANTPULSE — Database Schema Migration: Zero Round-Off & Slippage
-- Expands volume precision from NUMERIC(10, 3) to NUMERIC(16, 6)
-- and adds explicit BIGINT share counters to eliminate any round-off
-- or slippage in 20-Day Average Traded Shares.
-- =====================================================================

-- 1. WATCHLIST TABLE
ALTER TABLE public.watchlist 
    ALTER COLUMN avg_vol_20d_m TYPE NUMERIC(16, 6),
    ALTER COLUMN today_vol_m TYPE NUMERIC(16, 6);

ALTER TABLE public.watchlist 
    ADD COLUMN IF NOT EXISTS avg_20d_traded_shares BIGINT,
    ADD COLUMN IF NOT EXISTS today_traded_shares BIGINT;

-- Backfill integer share counts from existing millions if empty
UPDATE public.watchlist 
SET avg_20d_traded_shares = ROUND(avg_vol_20d_m * 1000000)
WHERE avg_20d_traded_shares IS NULL;

UPDATE public.watchlist 
SET today_traded_shares = ROUND(today_vol_m * 1000000)
WHERE today_traded_shares IS NULL;

-- 2. STOCK_MASTER TABLE
ALTER TABLE public.stock_master 
    ALTER COLUMN avg_vol_20d_m TYPE NUMERIC(16, 6);

ALTER TABLE public.stock_master 
    ADD COLUMN IF NOT EXISTS avg_20d_traded_shares BIGINT;

UPDATE public.stock_master 
SET avg_20d_traded_shares = ROUND(avg_vol_20d_m * 1000000)
WHERE avg_20d_traded_shares IS NULL;

-- 3. CROSSOVER_EVENTS TABLE
ALTER TABLE public.crossover_events 
    ALTER COLUMN avg_vol_20d_m TYPE NUMERIC(16, 6);

ALTER TABLE public.crossover_events 
    ADD COLUMN IF NOT EXISTS avg_20d_traded_shares BIGINT,
    ADD COLUMN IF NOT EXISTS today_traded_shares BIGINT;

-- 4. LIVE_TICK_SNAPSHOTS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'live_tick_snapshots') THEN
        ALTER TABLE public.live_tick_snapshots 
            ALTER COLUMN avg_vol_20d_m TYPE NUMERIC(16, 6),
            ALTER COLUMN today_vol_m TYPE NUMERIC(16, 6);
        ALTER TABLE public.live_tick_snapshots 
            ADD COLUMN IF NOT EXISTS avg_20d_traded_shares BIGINT,
            ADD COLUMN IF NOT EXISTS today_traded_shares BIGINT;
    END IF;
END $$;
