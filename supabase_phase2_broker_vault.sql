-- =====================================================================
-- QUANTPULSE — Phase 2: Broker Credential Cloud Vault & Auto-Auth
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/cmcgvadapaoapxrxdcau/sql
-- =====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. BROKER_VAULT TABLE (Secure Centralized Multi-Device Store)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broker_vault (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_name VARCHAR(50) NOT NULL DEFAULT 'DHAN',
    client_id VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    token_generated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    token_expiry_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
    last_ping_latency_ms INT DEFAULT 0,
    available_margin NUMERIC(14, 2) DEFAULT 0,
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for instant retrieval of the active primary credential
CREATE INDEX IF NOT EXISTS idx_broker_vault_lookup 
ON public.broker_vault(broker_name, is_primary, status);

CREATE INDEX IF NOT EXISTS idx_broker_vault_expiry 
ON public.broker_vault(token_expiry_at);

-- ---------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.broker_vault ENABLE ROW LEVEL SECURITY;

-- Allow public access via Supabase anon / publishable key
DROP POLICY IF EXISTS "Allow anon read broker_vault" ON public.broker_vault;
CREATE POLICY "Allow anon read broker_vault" 
ON public.broker_vault FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert broker_vault" ON public.broker_vault;
CREATE POLICY "Allow anon insert broker_vault" 
ON public.broker_vault FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update broker_vault" ON public.broker_vault;
CREATE POLICY "Allow anon update broker_vault" 
ON public.broker_vault FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow anon delete broker_vault" ON public.broker_vault;
CREATE POLICY "Allow anon delete broker_vault" 
ON public.broker_vault FOR DELETE USING (true);

-- ---------------------------------------------------------------------
-- 3. ENABLE REALTIME BROADCASTING ON BROKER_VAULT
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'broker_vault'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_vault;
    END IF;
END $$;
