-- =====================================================================
-- QUANTPULSE — Database Schema Migration
-- Strategy: NIFTY 09:20 Premium 62.5 Overnight Strategy
-- Strategy ID: NIFTY_0920_PREMIUM_625_OVERNIGHT
-- =====================================================================

-- 1. Extend active_positions with strategy metadata and overnight flags
ALTER TABLE public.active_positions 
    ADD COLUMN IF NOT EXISTS strategy_id VARCHAR(60) DEFAULT '20D_CROSSOVER',
    ADD COLUMN IF NOT EXISTS allow_overnight BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reference_price NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS next_trading_day DATE;

-- 2. Extend trade_logs with strategy metadata and exit reason
ALTER TABLE public.trade_logs 
    ADD COLUMN IF NOT EXISTS strategy_id VARCHAR(60) DEFAULT '20D_CROSSOVER',
    ADD COLUMN IF NOT EXISTS reference_price NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS exit_reason VARCHAR(60);

-- 3. Dedicated persistent state table for NIFTY 09:20 Overnight Strategy
CREATE TABLE IF NOT EXISTS public.strategy_nifty_overnight (
    id VARCHAR(80) PRIMARY KEY, -- Unique Daily Execution ID: NIFTY_0920_PREMIUM_625_OVERNIGHT_YYYYMMDD
    trading_date DATE NOT NULL,
    strategy_id VARCHAR(60) NOT NULL DEFAULT 'NIFTY_0920_PREMIUM_625_OVERNIGHT',
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING_SELECTION',
    selected_expiry VARCHAR(20) NOT NULL,
    is_expiry_override BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Call Option (CE) Leg
    ce_symbol VARCHAR(60),
    ce_strike INT,
    ce_ref_price NUMERIC(10, 2),
    ce_stop_loss NUMERIC(10, 2),
    ce_current_price NUMERIC(10, 2),
    ce_status VARCHAR(40) DEFAULT 'PENDING',
    ce_quantity INT DEFAULT 75,
    ce_exit_price NUMERIC(10, 2),
    ce_exit_time VARCHAR(30),
    ce_exit_reason VARCHAR(60),
    ce_realized_pnl NUMERIC(10, 2),

    -- Put Option (PE) Leg
    pe_symbol VARCHAR(60),
    pe_strike INT,
    pe_ref_price NUMERIC(10, 2),
    pe_stop_loss NUMERIC(10, 2),
    pe_current_price NUMERIC(10, 2),
    pe_status VARCHAR(40) DEFAULT 'PENDING',
    pe_quantity INT DEFAULT 75,
    pe_exit_price NUMERIC(10, 2),
    pe_exit_time VARCHAR(30),
    pe_exit_reason VARCHAR(60),
    pe_realized_pnl NUMERIC(10, 2),

    -- Overnight Scheduling
    next_trading_day DATE NOT NULL,
    mandatory_exit_time VARCHAR(20) NOT NULL DEFAULT '09:25:00 IST',

    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for rapid hydration of open / overnight positions on boot
CREATE INDEX IF NOT EXISTS idx_nifty_overnight_status 
ON public.strategy_nifty_overnight (status) 
WHERE status IN ('ACTIVE', 'OVERNIGHT_HOLD');

-- Enable Row Level Security (RLS)
ALTER TABLE public.strategy_nifty_overnight ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read, insert, update, delete for client / cron automation
CREATE POLICY "Allow anon select on strategy_nifty_overnight" 
ON public.strategy_nifty_overnight FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on strategy_nifty_overnight" 
ON public.strategy_nifty_overnight FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update on strategy_nifty_overnight" 
ON public.strategy_nifty_overnight FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete on strategy_nifty_overnight" 
ON public.strategy_nifty_overnight FOR DELETE TO anon USING (true);
