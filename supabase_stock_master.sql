-- =====================================================================
-- QUANTPULSE — Stock Master Directory & Watchlist Alignment Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/cmcgvadapaoapxrxdcau/sql
-- =====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. CREATE ALL STOCKS MASTER TABLE (stock_master)
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
    is_active_watchlist BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ensure short_name and isin columns exist if table was already created
ALTER TABLE public.stock_master ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);
ALTER TABLE public.stock_master ADD COLUMN IF NOT EXISTS isin VARCHAR(30);

-- Index for fast lookup by sector & segment
CREATE INDEX IF NOT EXISTS idx_stock_master_sector ON public.stock_master(sector);
CREATE INDEX IF NOT EXISTS idx_stock_master_segment ON public.stock_master(segment);

-- ---------------------------------------------------------------------
-- 2. SEED ALL 22+ HIGH LIQUIDITY STOCKS INTO MASTER REPOSITORY
-- ---------------------------------------------------------------------
INSERT INTO public.stock_master (
    ticker, short_name, name, isin, segment, exchange, sector, security_id, lot_size, strike_step, avg_vol_20d_m, approx_ltp, is_fno, is_active_watchlist
)
VALUES
    ('RELIANCE', 'Reliance', 'Reliance Industries Limited', 'INE002A01018', 'NSE_FNO', 'NSE', 'Oil & Gas / Conglomerate', '1330', 250, 50, 5.200, 2968.50, true, true),
    ('TCS', 'TCS', 'Tata Consultancy Services Limited', 'INE467B01029', 'NSE_FNO', 'NSE', 'Information Technology', '11536', 175, 50, 1.500, 4126.00, true, true),
    ('HDFCBANK', 'HDFC Bank', 'HDFC Bank Limited', 'INE040A01034', 'NSE_FNO', 'NSE', 'Private Banking & Financials', '1333', 550, 20, 6.000, 1644.20, true, true),
    ('ICICIBANK', 'ICICI Bank', 'ICICI Bank Limited', 'INE090A01021', 'NSE_FNO', 'NSE', 'Private Banking & Financials', '4963', 700, 20, 7.000, 1258.00, true, true),
    ('INFY', 'Infosys', 'Infosys Limited', 'INE009A01021', 'NSE_FNO', 'NSE', 'Information Technology', '1594', 400, 20, 6.800, 1890.00, true, false),
    ('SBIN', 'SBI', 'State Bank of India', 'INE062A01020', 'NSE_FNO', 'NSE', 'Public Sector Banking', '3045', 750, 10, 14.500, 785.00, true, false),
    ('BHARTIARTL', 'Bharti Airtel', 'Bharti Airtel Limited', 'INE397D01024', 'NSE_FNO', 'NSE', 'Telecommunications', '10604', 475, 20, 6.200, 1540.00, true, false),
    ('KOTAKBANK', 'Kotak Bank', 'Kotak Mahindra Bank Limited', 'INE237A01028', 'NSE_FNO', 'NSE', 'Private Banking', '1922', 400, 20, 4.800, 1820.00, true, false),
    ('LT', 'L&T', 'Larsen & Toubro Limited', 'INE018A01030', 'NSE_FNO', 'NSE', 'Infrastructure & Engineering', '11483', 150, 50, 2.100, 3560.00, true, false),
    ('AXISBANK', 'Axis Bank', 'Axis Bank Limited', 'INE238A01034', 'NSE_FNO', 'NSE', 'Private Banking', '5900', 625, 20, 7.400, 1180.00, true, false),
    ('TATAMOTORS', 'Tata Motors', 'Tata Motors Limited', 'INE155A01022', 'NSE_FNO', 'NSE', 'Automobile Manufacturers', '3456', 550, 20, 8.900, 984.40, true, false),
    ('MARUTI', 'Maruti Suzuki', 'Maruti Suzuki India Limited', 'INE585B01010', 'NSE_FNO', 'NSE', 'Automobile Manufacturers', '10999', 50, 200, 0.650, 12450.00, true, false),
    ('BAJFINANCE', 'Bajaj Finance', 'Bajaj Finance Limited', 'INE296A01024', 'NSE_FNO', 'NSE', 'Non-Banking Financial Services (NBFC)', '317', 125, 100, 1.100, 7240.00, true, false),
    ('TATASTEEL', 'Tata Steel', 'Tata Steel Limited', 'INE081A01020', 'NSE_FNO', 'NSE', 'Iron & Steel / Metals', '3499', 5500, 2.5, 32.000, 154.50, true, false),
    ('ITC', 'ITC', 'ITC Limited', 'INE154A01025', 'NSE_FNO', 'NSE', 'FMCG & Cigarettes / Hotels', '1660', 1600, 10, 12.000, 495.00, true, false),
    ('SUNPHARMA', 'Sun Pharma', 'Sun Pharmaceutical Industries Limited', 'INE044A01036', 'NSE_FNO', 'NSE', 'Pharmaceuticals', '3351', 350, 20, 2.800, 1860.00, true, false),
    ('WIPRO', 'Wipro', 'Wipro Limited', 'INE075A01022', 'NSE_FNO', 'NSE', 'Information Technology', '3787', 1500, 10, 8.500, 535.00, true, false),
    ('HINDUNILVR', 'Hindustan Unilever', 'Hindustan Unilever Limited', 'INE030A01027', 'NSE_FNO', 'NSE', 'FMCG & Consumer Goods', '1394', 300, 50, 1.800, 2780.00, true, false),
    ('TITAN', 'Titan Company', 'Titan Company Limited', 'INE280A01028', 'NSE_FNO', 'NSE', 'Gems, Jewellery & Luxury', '3506', 175, 50, 1.200, 3680.00, true, false),
    ('ADANIENT', 'Adani Enterprises', 'Adani Enterprises Limited', 'INE423A01024', 'NSE_FNO', 'NSE', 'Metals, Mining & Trading', '25', 300, 50, 2.600, 3050.00, true, false),
    ('ADANIPORTS', 'Adani Ports', 'Adani Ports and Special Economic Zone Limited', 'INE742F01042', 'NSE_FNO', 'NSE', 'Ports & Infrastructure', '15083', 400, 20, 3.400, 1420.00, true, false),
    ('ZOMATO', 'Zomato', 'Zomato Limited', 'INE758T01015', 'NSE_EQ', 'NSE', 'Online Food Delivery & Quick Commerce', '5097', 1, 5, 19.000, 264.80, false, false)
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
    is_active_watchlist = EXCLUDED.is_active_watchlist;

-- ---------------------------------------------------------------------
-- 3. ALIGN PUBLIC.WATCHLIST TABLE TO STRICTLY HAVE 4 SPECIFIED STOCKS
-- (TCS, ICICIBANK, RELIANCE, HDFCBANK)
-- ---------------------------------------------------------------------
-- Ensure columns exist
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS isin VARCHAR(30);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS segment VARCHAR(20) DEFAULT 'NSE_FNO';
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS security_id VARCHAR(20);

-- Clear old stocks not in requested list
DELETE FROM public.watchlist WHERE ticker NOT IN ('RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK');

-- Upsert the 4 active stocks with exact real market names
INSERT INTO public.watchlist (
    ticker, short_name, name, isin, is_fno, segment, sector, security_id, lot_size, strike_step, spot_ltp, today_vol_m, avg_vol_20d_m, has_crossed_20d, crossover_time, crossover_spot_price, iv_pct
)
VALUES
    ('RELIANCE', 'Reliance', 'Reliance Industries Limited', 'INE002A01018', true, 'NSE_FNO', 'Oil & Gas / Conglomerate', '1330', 250, 50, 2968.50, 5.820, 5.200, true, '09:48:12', 2954.00, 18.4),
    ('TCS', 'TCS', 'Tata Consultancy Services Limited', 'INE467B01029', true, 'NSE_FNO', 'Information Technology', '11536', 175, 50, 4126.00, 1.450, 1.500, false, NULL, NULL, 16.2),
    ('HDFCBANK', 'HDFC Bank', 'HDFC Bank Limited', 'INE040A01034', true, 'NSE_FNO', 'Private Banking & Financials', '1333', 550, 20, 1644.20, 4.700, 6.000, false, NULL, NULL, 14.9),
    ('ICICIBANK', 'ICICI Bank', 'ICICI Bank Limited', 'INE090A01021', true, 'NSE_FNO', 'Private Banking & Financials', '4963', 700, 20, 1258.00, 6.440, 7.000, false, NULL, NULL, 15.6)
ON CONFLICT (ticker) DO UPDATE SET
    short_name = EXCLUDED.short_name,
    name = EXCLUDED.name,
    isin = EXCLUDED.isin,
    is_fno = EXCLUDED.is_fno,
    segment = EXCLUDED.segment,
    sector = EXCLUDED.sector,
    security_id = EXCLUDED.security_id,
    lot_size = EXCLUDED.lot_size,
    strike_step = EXCLUDED.strike_step,
    spot_ltp = EXCLUDED.spot_ltp,
    avg_vol_20d_m = EXCLUDED.avg_vol_20d_m;

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES FOR STOCK_MASTER
-- ---------------------------------------------------------------------
ALTER TABLE public.stock_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous select on stock_master" 
    ON public.stock_master FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert on stock_master" 
    ON public.stock_master FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update on stock_master" 
    ON public.stock_master FOR UPDATE TO anon USING (true);

-- ---------------------------------------------------------------------
-- 5. REALTIME REPLICATION (Instant Sync)
-- ---------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_master;
