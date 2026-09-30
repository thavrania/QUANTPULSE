-- =====================================================================
-- QUANTPULSE — Stock Master Directory & Active Watchlist Separation
-- Complete schema with all 55 NIFTY 50 and SENSEX constituents.
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/cmcgvadapaoapxrxdcau/sql
-- =====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. CREATE ALL STOCKS MASTER TABLE (stock_master)
-- Stores the complete market stock universe separately from the watchlist.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_master (
    ticker VARCHAR(20) PRIMARY KEY,
    short_name VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    isin VARCHAR(30),
    segment VARCHAR(20) NOT NULL DEFAULT 'NSE_FNO',
    exchange VARCHAR(10) NOT NULL DEFAULT 'NSE',
    sector VARCHAR(100) NOT NULL,
    security_id VARCHAR(20) NOT NULL,
    lot_size INT NOT NULL DEFAULT 1,
    strike_step NUMERIC(8, 2) NOT NULL DEFAULT 50,
    avg_vol_20d_m NUMERIC(10, 3) NOT NULL DEFAULT 1.000,
    approx_ltp NUMERIC(10, 2) DEFAULT 1000.00,
    is_fno BOOLEAN DEFAULT TRUE,
    indices TEXT[] DEFAULT '{}',
    is_active_watchlist BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ensure columns exist if table was already created
ALTER TABLE public.stock_master ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);
ALTER TABLE public.stock_master ADD COLUMN IF NOT EXISTS isin VARCHAR(30);
ALTER TABLE public.stock_master ADD COLUMN IF NOT EXISTS indices TEXT[] DEFAULT '{}';
ALTER TABLE public.stock_master ADD COLUMN IF NOT EXISTS is_active_watchlist BOOLEAN DEFAULT FALSE;
ALTER TABLE public.stock_master ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_stock_master_sector ON public.stock_master(sector);
CREATE INDEX IF NOT EXISTS idx_stock_master_segment ON public.stock_master(segment);
CREATE INDEX IF NOT EXISTS idx_stock_master_active ON public.stock_master(is_active_watchlist);

-- ---------------------------------------------------------------------
-- 2. SEED ALL 55 NIFTY 50 & SENSEX STOCKS INTO MASTER REPOSITORY
-- ---------------------------------------------------------------------
INSERT INTO public.stock_master (
    ticker, short_name, name, isin, segment, exchange, sector, security_id, lot_size, strike_step, avg_vol_20d_m, approx_ltp, is_fno, indices, is_active_watchlist
)
VALUES
    ('ADANIENT', 'Adani Ent', 'Adani Enterprises Limited', 'INE423A01024', 'NSE_FNO', 'NSE', 'Metals, Mining & Trading', '25', 300, 50, 2.600, 3050.00, true, ARRAY['NIFTY 50'], false),
    ('ADANIPORTS', 'Adani Ports', 'Adani Ports and Special Economic Zone Limited', 'INE742F01042', 'NSE_FNO', 'NSE', 'Ports & Infrastructure', '15083', 400, 20, 3.400, 1420.00, true, ARRAY['NIFTY 50'], false),
    ('APOLLOHOSP', 'Apollo Hosp', 'Apollo Hospitals Enterprise Limited', 'INE437A01024', 'NSE_FNO', 'NSE', 'Healthcare & Hospitals', '157', 125, 50, 0.700, 7100.00, true, ARRAY['NIFTY 50'], false),
    ('ASIANPAINT', 'Asian Paints', 'Asian Paints Limited', 'INE021A01026', 'NSE_FNO', 'NSE', 'Paints & Consumer Goods', '236', 200, 20, 1.100, 3250.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('AXISBANK', 'Axis Bank', 'Axis Bank Limited', 'INE238A01034', 'NSE_FNO', 'NSE', 'Private Banking', '5900', 625, 20, 7.400, 1180.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('BAJAJ-AUTO', 'Bajaj Auto', 'Bajaj Auto Limited', 'INE917I01010', 'NSE_FNO', 'NSE', 'Automobile - 2 & 3 Wheelers', '16669', 75, 100, 0.450, 9650.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('BAJFINANCE', 'Bajaj Finance', 'Bajaj Finance Limited', 'INE296A01024', 'NSE_FNO', 'NSE', 'Non-Banking Financial Services (NBFC)', '317', 125, 100, 1.100, 7240.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('BAJAJFINSV', 'Bajaj Finserv', 'Bajaj Finserv Limited', 'INE918I01018', 'NSE_FNO', 'NSE', 'Financial Services & Insurance', '16675', 500, 20, 1.600, 1820.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('BEL', 'Bharat Electronics', 'Bharat Electronics Limited', 'INE263A01024', 'NSE_FNO', 'NSE', 'Defence & Aerospace Electronics', '383', 2850, 5, 22.000, 295.00, true, ARRAY['NIFTY 50'], false),
    ('BHARTIARTL', 'Bharti Airtel', 'Bharti Airtel Limited', 'INE397D01024', 'NSE_FNO', 'NSE', 'Telecommunications', '10604', 475, 20, 6.200, 1540.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('BPCL', 'BPCL', 'Bharat Petroleum Corporation Limited', 'INE029A01011', 'NSE_FNO', 'NSE', 'Oil Refining & Marketing', '526', 1800, 5, 14.500, 355.00, true, ARRAY['NIFTY 50'], false),
    ('BRITANNIA', 'Britannia', 'Britannia Industries Limited', 'INE216A01030', 'NSE_FNO', 'NSE', 'FMCG & Bakery / Food Products', '547', 100, 50, 0.550, 5900.00, true, ARRAY['NIFTY 50'], false),
    ('CIPLA', 'Cipla', 'Cipla Limited', 'INE059A01026', 'NSE_FNO', 'NSE', 'Pharmaceuticals', '694', 375, 20, 1.700, 1620.00, true, ARRAY['NIFTY 50'], false),
    ('COALINDIA', 'Coal India', 'Coal India Limited', 'INE522F01014', 'NSE_FNO', 'NSE', 'Coal & Mining', '20374', 2100, 5, 12.000, 510.00, true, ARRAY['NIFTY 50'], false),
    ('DIVISLAB', 'Divis Lab', 'Divi''s Laboratories Limited', 'INE361B01024', 'NSE_FNO', 'NSE', 'Pharmaceuticals & Active Ingredients', '10940', 100, 50, 0.600, 5300.00, true, ARRAY['NIFTY 50'], false),
    ('DRREDDY', 'Dr Reddy''s', 'Dr. Reddy''s Laboratories Limited', 'INE089A01023', 'NSE_FNO', 'NSE', 'Pharmaceuticals', '881', 125, 50, 0.700, 6600.00, true, ARRAY['NIFTY 50'], false),
    ('EICHERMOT', 'Eicher Motors', 'Eicher Motors Limited', 'INE066A01021', 'NSE_FNO', 'NSE', 'Automobile Manufacturers (Royal Enfield)', '910', 150, 50, 0.650, 4850.00, true, ARRAY['NIFTY 50'], false),
    ('GRASIM', 'Grasim', 'Grasim Industries Limited', 'INE047A01021', 'NSE_FNO', 'NSE', 'Cement, Chemicals & Diversified', '1232', 250, 20, 1.050, 2650.00, true, ARRAY['NIFTY 50'], false),
    ('HCLTECH', 'HCL Tech', 'HCL Technologies Limited', 'INE860A01027', 'NSE_FNO', 'NSE', 'Information Technology', '7229', 350, 20, 2.900, 1780.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('HDFCBANK', 'HDFC Bank', 'HDFC Bank Limited', 'INE040A01034', 'NSE_FNO', 'NSE', 'Private Banking & Financials', '1333', 550, 20, 6.000, 1644.20, true, ARRAY['NIFTY 50', 'SENSEX'], true),
    ('HDFCLIFE', 'HDFC Life', 'HDFC Life Insurance Company Limited', 'INE795G01014', 'NSE_FNO', 'NSE', 'Life Insurance', '467', 1100, 10, 4.800, 715.00, true, ARRAY['NIFTY 50'], false),
    ('HEROMOTOCO', 'Hero MotoCorp', 'Hero MotoCorp Limited', 'INE158A01026', 'NSE_FNO', 'NSE', 'Automobile - 2 & 3 Wheelers', '1348', 150, 50, 0.550, 5650.00, true, ARRAY['NIFTY 50'], false),
    ('HINDALCO', 'Hindalco', 'Hindalco Industries Limited', 'INE038A01020', 'NSE_FNO', 'NSE', 'Aluminium & Copper / Metals', '1363', 1400, 10, 8.500, 715.00, true, ARRAY['NIFTY 50'], false),
    ('HINDUNILVR', 'Hindustan Unilever', 'Hindustan Unilever Limited', 'INE030A01027', 'NSE_FNO', 'NSE', 'FMCG & Consumer Goods', '1394', 300, 50, 1.800, 2780.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('ICICIBANK', 'ICICI Bank', 'ICICI Bank Limited', 'INE090A01021', 'NSE_FNO', 'NSE', 'Private Banking & Financials', '4963', 700, 20, 7.000, 1258.00, true, ARRAY['NIFTY 50', 'SENSEX'], true),
    ('INDUSINDBK', 'IndusInd Bank', 'IndusInd Bank Limited', 'INE095A01012', 'NSE_FNO', 'NSE', 'Private Banking', '5258', 500, 20, 3.800, 1440.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('INFY', 'Infosys', 'Infosys Limited', 'INE009A01021', 'NSE_FNO', 'NSE', 'Information Technology', '1594', 400, 20, 6.800, 1890.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('ITC', 'ITC', 'ITC Limited', 'INE154A01025', 'NSE_FNO', 'NSE', 'FMCG & Cigarettes / Hotels', '1660', 1600, 10, 12.000, 495.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('JIOFIN', 'Jio Financial', 'Jio Financial Services Limited', 'INE758E01017', 'NSE_EQ', 'NSE', 'Financial Services & NBFC', '18143', 1, 5, 24.000, 340.00, false, ARRAY['NIFTY 50'], false),
    ('JSWSTEEL', 'JSW Steel', 'JSW Steel Limited', 'INE019A01038', 'NSE_FNO', 'NSE', 'Iron & Steel / Metals', '11723', 675, 10, 2.700, 995.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('KOTAKBANK', 'Kotak Bank', 'Kotak Mahindra Bank Limited', 'INE237A01028', 'NSE_FNO', 'NSE', 'Private Banking', '1922', 400, 20, 4.800, 1820.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('LT', 'L&T', 'Larsen & Toubro Limited', 'INE018A01030', 'NSE_FNO', 'NSE', 'Infrastructure & Engineering', '11483', 150, 50, 2.100, 3560.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('LTIM', 'LTIMindtree', 'LTIMindtree Limited', 'INE214T01019', 'NSE_FNO', 'NSE', 'Information Technology', '17818', 150, 50, 0.650, 6150.00, true, ARRAY['NIFTY 50'], false),
    ('M&M', 'Mahindra & Mahindra', 'Mahindra & Mahindra Limited', 'INE101A01026', 'NSE_FNO', 'NSE', 'Automobile Manufacturers (SUVs & Tractors)', '2031', 350, 20, 3.800, 3120.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('MARUTI', 'Maruti Suzuki', 'Maruti Suzuki India Limited', 'INE585B01010', 'NSE_FNO', 'NSE', 'Automobile Manufacturers', '10999', 50, 200, 0.650, 12450.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('NESTLEIND', 'Nestle', 'Nestle India Limited', 'INE239A01024', 'NSE_FNO', 'NSE', 'FMCG & Food Processing', '17963', 250, 20, 0.850, 2650.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('NTPC', 'NTPC', 'NTPC Limited', 'INE733E01010', 'NSE_FNO', 'NSE', 'Power Generation & Utilities', '11630', 1500, 5, 15.000, 425.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('ONGC', 'ONGC', 'Oil & Natural Gas Corporation Limited', 'INE213A01029', 'NSE_FNO', 'NSE', 'Oil Exploration & Production', '2475', 3850, 2.5, 18.000, 295.00, true, ARRAY['NIFTY 50'], false),
    ('POWERGRID', 'Power Grid', 'Power Grid Corporation of India Limited', 'INE752E01010', 'NSE_FNO', 'NSE', 'Power Transmission & Infrastructure', '14977', 1800, 5, 13.000, 340.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('RELIANCE', 'Reliance', 'Reliance Industries Limited', 'INE002A01018', 'NSE_FNO', 'NSE', 'Oil & Gas / Conglomerate', '1330', 250, 50, 5.200, 2968.50, true, ARRAY['NIFTY 50', 'SENSEX'], true),
    ('SBILIFE', 'SBI Life', 'SBI Life Insurance Company Limited', 'INE123W01016', 'NSE_FNO', 'NSE', 'Life Insurance', '21808', 750, 20, 1.500, 1780.00, true, ARRAY['NIFTY 50'], false),
    ('SBIN', 'SBI', 'State Bank of India', 'INE062A01020', 'NSE_FNO', 'NSE', 'Public Sector Banking', '3045', 750, 10, 14.500, 785.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('SHRIRAMFIN', 'Shriram Finance', 'Shriram Finance Limited', 'INE721A01013', 'NSE_FNO', 'NSE', 'Non-Banking Financial Services (NBFC)', '4306', 150, 50, 1.800, 3350.00, true, ARRAY['NIFTY 50'], false),
    ('SUNPHARMA', 'Sun Pharma', 'Sun Pharmaceutical Industries Limited', 'INE044A01036', 'NSE_FNO', 'NSE', 'Pharmaceuticals', '3351', 350, 20, 2.800, 1860.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('TATACONSUM', 'Tata Consumer', 'Tata Consumer Products Limited', 'INE192A01025', 'NSE_FNO', 'NSE', 'FMCG / Beverages & Food', '3432', 900, 10, 2.200, 1180.00, true, ARRAY['NIFTY 50'], false),
    ('TATAMOTORS', 'TMCV', 'TMCV', 'INE155A01022', 'NSE_FNO', 'NSE', 'Automobile Manufacturers (Commercial Vehicles)', '3456', 550, 20, 8.900, 984.40, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('TMCV', 'TMCV', 'TMCV', 'INE155A01022', 'NSE_FNO', 'NSE', 'Automobile Manufacturers (Commercial Vehicles)', '3456', 550, 20, 8.900, 984.40, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('TATASTEEL', 'Tata Steel', 'Tata Steel Limited', 'INE081A01020', 'NSE_FNO', 'NSE', 'Iron & Steel / Metals', '3499', 5500, 2.5, 32.000, 154.50, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('TCS', 'TCS', 'Tata Consultancy Services Limited', 'INE467B01029', 'NSE_FNO', 'NSE', 'Information Technology', '11536', 175, 50, 1.500, 4126.00, true, ARRAY['NIFTY 50', 'SENSEX'], true),
    ('TECHM', 'Tech Mahindra', 'Tech Mahindra Limited', 'INE669C01036', 'NSE_FNO', 'NSE', 'Information Technology', '13538', 600, 20, 2.300, 1620.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('TITAN', 'Titan Company', 'Titan Company Limited', 'INE280A01028', 'NSE_FNO', 'NSE', 'Gems, Jewellery & Luxury', '3506', 175, 50, 1.200, 3680.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('TRENT', 'Trent', 'Trent Limited', 'INE849A01020', 'NSE_FNO', 'NSE', 'Retail / Apparel & Lifestyle', '1964', 100, 50, 1.800, 7450.00, true, ARRAY['NIFTY 50'], false),
    ('ULTRACEMCO', 'UltraTech', 'UltraTech Cement Limited', 'INE481G01011', 'NSE_FNO', 'NSE', 'Cement & Building Materials', '11532', 100, 100, 0.400, 11500.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('UPL', 'UPL', 'UPL Limited', 'INE628A01036', 'NSE_FNO', 'NSE', 'Agrochemicals & Crop Protection', '11287', 1300, 5, 4.200, 570.00, true, ARRAY['NIFTY 50'], false),
    ('WIPRO', 'Wipro', 'Wipro Limited', 'INE075A01022', 'NSE_FNO', 'NSE', 'Information Technology', '3787', 1500, 10, 8.500, 535.00, true, ARRAY['NIFTY 50', 'SENSEX'], false),
    ('ZOMATO', 'ETERNAL', 'ETERNAL', 'INE758T01015', 'NSE_FNO', 'NSE', 'Online Food Delivery & Quick Commerce', '5097', 2500, 5, 19.000, 264.80, true, ARRAY['NIFTY 50'], false),
    ('ETERNAL', 'ETERNAL', 'ETERNAL', 'INE758T01015', 'NSE_FNO', 'NSE', 'Online Food Delivery & Quick Commerce', '5097', 2500, 5, 19.000, 264.80, true, ARRAY['NIFTY 50'], false)
ON CONFLICT (ticker) DO UPDATE SET
    short_name = EXCLUDED.short_name,
    name = EXCLUDED.name,
    isin = EXCLUDED.isin,
    segment = EXCLUDED.segment,
    exchange = EXCLUDED.exchange,
    sector = EXCLUDED.sector,
    security_id = EXCLUDED.security_id,
    lot_size = EXCLUDED.lot_size,
    strike_step = EXCLUDED.strike_step,
    avg_vol_20d_m = EXCLUDED.avg_vol_20d_m,
    approx_ltp = EXCLUDED.approx_ltp,
    is_fno = EXCLUDED.is_fno,
    indices = EXCLUDED.indices,
    updated_at = TIMEZONE('utc'::text, NOW());

-- ---------------------------------------------------------------------
-- 3. ENSURE DEDICATED WATCHLIST TABLE WITH ACTIVE STATUS FLAG
-- Note: Do NOT delete user's custom watchlist entries on sync/day start!
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watchlist (
    ticker VARCHAR(20) PRIMARY KEY,
    short_name VARCHAR(50),
    name VARCHAR(120) NOT NULL,
    isin VARCHAR(30),
    is_fno BOOLEAN DEFAULT TRUE,
    segment VARCHAR(20) DEFAULT 'NSE_FNO',
    sector VARCHAR(100),
    security_id VARCHAR(20),
    lot_size INT NOT NULL DEFAULT 1,
    strike_step NUMERIC(8, 2) NOT NULL DEFAULT 50,
    spot_ltp NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    today_vol_m NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    avg_vol_20d_m NUMERIC(10, 3) NOT NULL DEFAULT 1.000,
    has_crossed_20d BOOLEAN DEFAULT FALSE,
    crossover_time VARCHAR(20),
    crossover_spot_price NUMERIC(10, 2),
    iv_pct NUMERIC(6, 2) DEFAULT 16.50,
    day_open NUMERIC(10, 2),
    day_high NUMERIC(10, 2),
    day_low NUMERIC(10, 2),
    day_close NUMERIC(10, 2),
    change_pct NUMERIC(6, 2),
    feed_source VARCHAR(20) DEFAULT 'LIVE_DHAN',
    is_active_watchlist BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ensure columns exist
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS isin VARCHAR(30);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS segment VARCHAR(20) DEFAULT 'NSE_FNO';
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS security_id VARCHAR(20);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS is_active_watchlist BOOLEAN DEFAULT TRUE;
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.stock_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_master' AND policyname = 'Allow anon select on stock_master') THEN
        CREATE POLICY "Allow anon select on stock_master" ON public.stock_master FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_master' AND policyname = 'Allow anon update on stock_master') THEN
        CREATE POLICY "Allow anon update on stock_master" ON public.stock_master FOR UPDATE TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watchlist' AND policyname = 'Allow anon select on watchlist') THEN
        CREATE POLICY "Allow anon select on watchlist" ON public.watchlist FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watchlist' AND policyname = 'Allow anon all on watchlist') THEN
        CREATE POLICY "Allow anon all on watchlist" ON public.watchlist FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. REALTIME REPLICATION
-- ---------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_master;
EXCEPTION WHEN OTHERS THEN
    -- Table might already be added
END $$;

-- ---------------------------------------------------------------------
-- 6. PREVENT DUPLICATE CROSSOVER EVENTS PER STOCK PER DAY
-- ---------------------------------------------------------------------
-- Clean up historical duplicates in crossover_events, keeping the earliest timestamp per stock per day
DELETE FROM public.crossover_events
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY ticker, (created_at AT TIME ZONE 'UTC')::date 
            ORDER BY created_at ASC
        ) as rnum
        FROM public.crossover_events
    ) t
    WHERE t.rnum > 1
);

-- Ensure a stock can never have duplicate crossover event rows on the same calendar date
CREATE UNIQUE INDEX IF NOT EXISTS idx_crossover_events_ticker_day 
ON public.crossover_events (ticker, ((created_at AT TIME ZONE 'UTC')::date));

