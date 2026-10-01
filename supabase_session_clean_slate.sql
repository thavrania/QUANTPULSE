-- =====================================================================
-- QUANTPULSE — Immediate Session Clean Slate & Anonymous DELETE Enablement
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/cmcgvadapaoapxrxdcau/sql
-- =====================================================================

-- 1. Enable DELETE policies for anonymous access across all trading tables
DROP POLICY IF EXISTS "Allow anonymous delete on active_positions" ON public.active_positions;
CREATE POLICY "Allow anonymous delete on active_positions" 
ON public.active_positions FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous delete on trade_logs" ON public.trade_logs;
CREATE POLICY "Allow anonymous delete on trade_logs" 
ON public.trade_logs FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous delete on tsl_audit_trail" ON public.tsl_audit_trail;
CREATE POLICY "Allow anonymous delete on tsl_audit_trail" 
ON public.tsl_audit_trail FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous delete on crossover_events" ON public.crossover_events;
CREATE POLICY "Allow anonymous delete on crossover_events" 
ON public.crossover_events FOR DELETE TO anon USING (true);

-- 2. Permanently purge existing stale records
TRUNCATE TABLE public.active_positions;
TRUNCATE TABLE public.trade_logs;
TRUNCATE TABLE public.tsl_audit_trail;
TRUNCATE TABLE public.crossover_events;

-- 3. Reset watchlist volumes and crossover latch flags for today's session
UPDATE public.watchlist
SET
  today_vol_m = 0.000,
  has_crossed_20d = false,
  crossover_time = null,
  crossover_spot_price = null,
  updated_at = NOW();

-- 4. Verify all tables are zeroed
SELECT 'active_positions' AS table_name, count(*) AS remaining_rows FROM public.active_positions
UNION ALL
SELECT 'trade_logs', count(*) FROM public.trade_logs
UNION ALL
SELECT 'tsl_audit_trail', count(*) FROM public.tsl_audit_trail
UNION ALL
SELECT 'crossover_events', count(*) FROM public.crossover_events;
