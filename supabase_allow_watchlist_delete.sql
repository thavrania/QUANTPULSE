-- =====================================================================
-- QUANTPULSE — Supabase Watchlist Table Permissions & Policies
-- Run this in your Supabase SQL Editor to grant DELETE permissions
-- to the anonymous/public role on the watchlist table.
-- =====================================================================

-- 1. Ensure RLS is enabled on watchlist
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policy if present and recreate with DELETE permission
DROP POLICY IF EXISTS "Allow anonymous delete on watchlist" ON public.watchlist;
CREATE POLICY "Allow anonymous delete on watchlist" ON public.watchlist FOR DELETE TO anon USING (true);

-- 3. Also grant full ALL policy for anon demo access (INSERT, SELECT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Allow anon all on watchlist" ON public.watchlist;
CREATE POLICY "Allow anon all on watchlist" ON public.watchlist FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. Ensure optional is_active_watchlist column exists if needed
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS is_active_watchlist BOOLEAN DEFAULT TRUE;

-- 5. Force schema cache reload
NOTIFY pgrst, 'reload schema';
