-- =====================================================================
-- QUANTPULSE — Database Schema Migration
-- Strategy: NIFTY 9:30 ₹180 Premium Breakout Option Buying Strategy
-- Strategy ID: NIFTY_0930_180_BREAKOUT
-- =====================================================================

-- 1. Table for Persistent Backtest Runs & Reproducibility Metadata
CREATE TABLE IF NOT EXISTS public.backtest_runs (
    id VARCHAR(100) PRIMARY KEY, -- e.g. RUN_NIFTY_0930_180_BREAKOUT_YYYYMMDDHHMMSS
    strategy_id VARCHAR(60) NOT NULL DEFAULT 'NIFTY_0930_180_BREAKOUT',
    strategy_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    configuration JSONB NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT NOT NULL DEFAULT 0,
    traded_days INT NOT NULL DEFAULT 0,
    no_trade_days INT NOT NULL DEFAULT 0,
    total_trades INT NOT NULL DEFAULT 0,
    winning_trades INT NOT NULL DEFAULT 0,
    losing_trades INT NOT NULL DEFAULT 0,
    win_rate_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    loss_rate_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    gross_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gross_loss NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    profit_factor NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    max_drawdown NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    max_drawdown_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Table for Executed Backtest Trades (All Part 20 Fields)
CREATE TABLE IF NOT EXISTS public.backtest_trades (
    trade_id VARCHAR(100) PRIMARY KEY,
    run_id VARCHAR(100) REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
    trading_date DATE NOT NULL,
    underlying VARCHAR(30) NOT NULL DEFAULT 'NIFTY',
    expiry VARCHAR(30) NOT NULL,
    selected_ce_symbol VARCHAR(80) NOT NULL,
    selected_ce_strike INT NOT NULL,
    selected_ce_925_premium NUMERIC(10, 2) NOT NULL,
    selected_pe_symbol VARCHAR(80) NOT NULL,
    selected_pe_strike INT NOT NULL,
    selected_pe_925_premium NUMERIC(10, 2) NOT NULL,
    trigger_option VARCHAR(10) NOT NULL, -- 'CE' or 'PE'
    trigger_option_type VARCHAR(10) NOT NULL,
    trigger_timestamp VARCHAR(30) NOT NULL,
    entry_price NUMERIC(10, 2) NOT NULL,
    entry_timestamp VARCHAR(30) NOT NULL,
    stop_loss_price NUMERIC(10, 2) NOT NULL,
    target_price NUMERIC(10, 2) NOT NULL,
    exit_price NUMERIC(10, 2) NOT NULL,
    exit_timestamp VARCHAR(30) NOT NULL,
    exit_reason VARCHAR(40) NOT NULL, -- 'TARGET_HIT', 'SL_HIT', 'TIME_EXIT'
    gross_points NUMERIC(10, 2) NOT NULL,
    gross_pnl NUMERIC(12, 2) NOT NULL,
    brokerage NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    exchange_charges NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    taxes NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    slippage NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    net_pnl NUMERIC(12, 2) NOT NULL,
    return_percentage NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    holding_duration VARCHAR(30) NOT NULL,
    lot_size INT NOT NULL DEFAULT 75,
    quantity INT NOT NULL DEFAULT 75,
    audit_trail JSONB,
    timeline JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Table for No-Trade Records (Part 21)
CREATE TABLE IF NOT EXISTS public.backtest_no_trade_days (
    id BIGSERIAL PRIMARY KEY,
    run_id VARCHAR(100) REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
    trading_date DATE NOT NULL,
    reason VARCHAR(50) NOT NULL, -- NO_CE_CONTRACT, NO_PE_CONTRACT, NO_VALID_925_DATA, NO_BREAKOUT, SIMULTANEOUS_BREAKOUT, etc.
    details TEXT,
    audit_trail JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_bt_trades_run_id ON public.backtest_trades(run_id);
CREATE INDEX IF NOT EXISTS idx_bt_trades_date ON public.backtest_trades(trading_date);
CREATE INDEX IF NOT EXISTS idx_bt_notrades_run_id ON public.backtest_no_trade_days(run_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_no_trade_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read on backtest_runs" ON public.backtest_runs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on backtest_runs" ON public.backtest_runs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon read on backtest_trades" ON public.backtest_trades FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on backtest_trades" ON public.backtest_trades FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon read on backtest_no_trade_days" ON public.backtest_no_trade_days FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on backtest_no_trade_days" ON public.backtest_no_trade_days FOR INSERT TO anon WITH CHECK (true);
