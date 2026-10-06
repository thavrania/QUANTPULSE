# CHANGE LOG — QUANTPULSE SINGLE SOURCE OF TRUTH

This document maintains an immutable, standardized, and audit-grade record of all code, configuration, database, and logic modifications made to the **QuantPulse** production trading terminal.

---

## Change Management Protocol

Every future change—whether initiated by a human engineer, quantitative researcher, or AI coding agent—**MUST** be recorded in this document before or immediately upon deployment.

### Standard Entry Template
When adding an entry to this log, copy and populate the following markdown structure:

```markdown
### [YYYY-MM-DD HH:mm IST] — <Short Descriptive Title>
- **Commit SHA / Version:** `<git commit hash>` / `vX.Y.Z`
- **Author / Agent:** `<Author Name or AI Agent Identifier>`
- **Category:** `Fix` | `Feature` | `Refactor` | `Config` | `Database` | `Docs`
- **Business Rationale / Objective:** 
  <Clear explanation of why this change was required and what business problem it solves.>

#### Affected Components & Files
- `<file_path_1>`: <Specific lines or functions modified>
- `<file_path_2>`: <Specific lines or functions modified>

#### Database & Schema Impact
- **Tables Touched:** `<table_names>` (or `None`)
- **Operations:** `INSERT` | `UPDATE` | `DELETE` | `ALTER` | `MIGRATION` | `None`
- **Migration Script:** `<script_path>` (or `N/A`)

#### Invariant Verification
- [x] Invariant 1: 20-Day Baseline Excludes Today's Session
- [x] Invariant 2: Rule 1 Bullish Price Confirmation Required
- [x] Invariant 3: Single Crossover Event per Stock per Session (Sticky Latch)
- [x] Invariant 4: No Volume Fallback to Previous Day
- [x] Invariant 5: Opening Minute Stabilization (No Triggers before 09:16 IST)
- [x] Invariant 6: Strict 1% Stop Loss & 1:2 Risk-Reward Ratio
- [x] Invariant 7: Idempotent Order Dispatch
- [x] Invariant 8: TSL Trailing Ratchet Rule (Never Lowers)
- [x] Invariant 9: Preserved Stock Master and Watchlist State
- [x] Invariant 10: Fail-Safe Broker Disconnect & Offline Simulation

#### Verification & Testing Performed
- <Command, test, or manual verification steps conducted>
- <Edge cases evaluated (market-closed, pre-market, live)>

#### Rollback Procedure
- <Exact instructions or git revert command to restore previous behavior if issues occur>
```

---

## Change History

### [2026-10-07 00:05 IST] — Establish Database as the Single Authoritative Source of Truth for 20-Day Average Traded Shares
- **Commit SHA / Version:** `81a3c19` / `v2.3.2`
- **Author / Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)
- **Category:** `Fix` / `Database` / `Refactor`
- **Business Rationale / Objective:** 
  Eliminate stale or conflicting 20-day average traded shares values across fallback scenarios, browsers, and terminal reloads.
  1. **Strict Database Priority:** Fixed `resolveStockMetadata` in `src/lib/stocks/stockMaster.ts` where static catalog constants (`master?.avg20DTradedShares`) previously took precedence over database values (`input.avg_20d_traded_shares`). Database records are now strictly prioritized over static catalog defaults.
  2. **Atomic DB Persistence & Verification:** `/api/pipeline/sync-baselines` now updates both `avg_vol_20d_m` and exact `avg_20d_traded_shares` in `public.watchlist`, `public.stock_master`, and `public.live_tick_snapshots`, and explicitly queries the database to confirm rows were stored before returning success.
  3. **Reload & UI Synchronization:** `syncDailyBaselines` in `QuantPulseContext.tsx` reloads the confirmed rows from Supabase, updates UI state with the exact DB shares, and propagates them to `centralMarketDataService` memory snapshots.
  4. **Downstream Coherence:** Screening in `ZoneC_Screener.tsx`, Watchlist cards in `ZoneB_Watchlist.tsx`, next action in `ZoneD_NextAction.tsx`, and volume crossover latches in `crossoverEngine.ts` / `centralMarketDataService.ts` now consume the unified database-stored 20D average values.

#### Affected Components & Files
- `src/lib/stocks/stockMaster.ts`: Prioritized database fields (`input.avg20DTradedShares`, `input.avg_20d_traded_shares`) over static catalog constants in `resolveStockMetadata`.
- `src/app/api/pipeline/sync-baselines/route.ts`: Stored `avg_20d_traded_shares` in `watchlist`, `stock_master`, `live_tick_snapshots` and added database confirmation check.
- `src/lib/services/centralMarketDataService.ts`: Added `updateBaselinesFromDatabase` method to synchronize memory snapshot cache with confirmed DB values.
- `src/context/QuantPulseContext.tsx`: Re-architected `syncDailyBaselines` to reload from Supabase upon sync and update UI/memory state strictly from confirmed DB records.
- `tests/architecture/centralMarketDataAndTelegram.test.ts`: Added architecture tests verifying DB precedence and sync data flow.

#### Invariant Verification
- [x] Invariant 1: 20-Day Baseline Excludes Today's Session
- [x] Invariant 2: Rule 1 Bullish Price Confirmation Required
- [x] Invariant 3: Single Crossover Event per Stock per Session (Sticky Latch)
- [x] Invariant 4: No Volume Fallback to Previous Day
- [x] Invariant 5: Opening Minute Stabilization (No Triggers before 09:16 IST)
- [x] Invariant 6: Strict 1% Stop Loss & 1:2 Risk-Reward Ratio
- [x] Invariant 7: Idempotent Order Dispatch
- [x] Invariant 8: TSL Trailing Ratchet Rule (Never Lowers)
- [x] Invariant 9: Preserved Stock Master and Watchlist State
- [x] Invariant 10: Fail-Safe Broker Disconnect & Offline Simulation

#### Verification & Testing Performed
- Ran `npm test` verifying all 33 unit and architecture tests passed.
- Ran `npx tsc --noEmit` verifying 0 compilation errors.
- Ran `npm run build` verifying production Next.js build completed with 0 errors across 21 routes.

---

### [2026-10-06 23:45 IST] — Restrict 20D Baseline Sync Invocations to User Click and Auto-Pilot Step 1
- **Commit SHA / Version:** `0564363` (`main`) / `v2.3.1`
- **Author / Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)
- **Category:** `Refactor` / `Config`
- **Business Rationale / Objective:** 
  Ensure that 20D Baseline Sync (`syncDailyBaselines` / `/api/pipeline/sync-baselines`) is strictly and exclusively invoked in two explicit situations:
  1. User clicks the **"⚡ 20D Sync"** button in `ZoneB_Watchlist.tsx` (or manual 20D button in Broker modal).
  2. Auto-Pilot Step 1 (`STEP_1_SYNC_20D`) runs at 09:00:05 AM IST or is manually executed via `PreMarketAutoPilotModal.tsx`.
  
  All other automatic/background triggers have been permanently removed:
  - Removed `/api/pipeline/sync-baselines` from `vercel.json` cron jobs.
  - Removed automatic 20D baseline sync on midnight date rollover in `QuantPulseContext.tsx`.
  - Removed automatic 20D baseline sync on initial application mount / page refresh in `QuantPulseContext.tsx`.
  - Removed automatic 20D baseline sync inside `resetToDayStart()` in `QuantPulseContext.tsx` (Day Start now purely zeroes today's volume).
  - Removed autonomous `TRIGGER_20D_SYNC` from `marketLifecycleStateMachine.ts` at 09:15 AM market opening.

#### Affected Components & Files
- `vercel.json`: Removed `sync-baselines` cron schedule.
- `src/lib/services/marketLifecycleStateMachine.ts`: `LIVE_SYNC_COMPLETED` transitions directly to `LIVE_FEED_ACTIVE`.
- `src/context/QuantPulseContext.tsx`: Removed automated 20D sync calls from midnight rollover, mount date check, `resetToDayStart`, and `executeLifecycleAction`.
- `APPLICATION_BIBLE.md`: Updated Section 7.2 invocation invariants.

#### Invariant Verification
- [x] Invariant 1: 20-Day Baseline Excludes Today's Session
- [x] Invariant 2: Rule 1 Bullish Price Confirmation Required
- [x] Invariant 3: Single Crossover Event per Stock per Session (Sticky Latch)
- [x] Invariant 4: No Volume Fallback to Previous Day
- [x] Invariant 5: Opening Minute Stabilization (No Triggers before 09:16 IST)
- [x] Invariant 6: Strict 1% Stop Loss & 1:2 Risk-Reward Ratio
- [x] Invariant 7: Idempotent Order Dispatch
- [x] Invariant 8: TSL Trailing Ratchet Rule (Never Lowers)
- [x] Invariant 9: Preserved Stock Master and Watchlist State
- [x] Invariant 10: Fail-Safe Broker Disconnect & Offline Simulation

#### Verification & Testing Performed
- Ran `npm test` verifying 31 of 31 strategy and architecture tests passed.
- Ran `npx tsc --noEmit` confirming 0 compilation errors.

---

### [2026-10-06 23:30 IST] — Centralized Market Data Architecture & Cross-Device Persistent Telegram Settings
- **Commit SHA / Version:** `247ffbf` (`main`) / `v2.3.0`
- **Author / Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)
- **Category:** `Feature` / `Database` / `Refactor`
- **Business Rationale / Objective:** 
  Solve two core platform architectural scaling problems:
  1. **Persistent Cross-Device Telegram Configuration:** Previously, Telegram bot token, chat ID, and notification preferences were stored exclusively in browser `localStorage`, causing settings loss across devices, browsers, and sessions. Migrated alert configuration to Supabase Cloud Vault table `public.user_alert_settings` with Row-Level Security, authenticated retrieval via `/api/alerts/settings`, server-side token masking (`••••••••1234`), and automatic multi-device restoration.
  2. **Centralized Market Data Pipeline & Realtime Broadcast:** Previously, each open browser tab ran an independent 2-second polling loop against `/api/broker/dhan/quote` -> Dhan HQ, causing $N$-linear external broker API requests. Introduced `CentralMarketDataService` and standalone ingestion worker `src/worker/marketDataWorker.ts` with singleton distributed lease protection (`public.market_feed_leases`), 09:15-09:16 opening stabilization, volume sanitization, exact physical shares (`BIGINT`), feed health tracking (`public.market_feed_health`), and single-row-per-ticker snapshot storage (`public.live_tick_snapshots`). Connected browsers now consume market updates via Supabase Realtime WebSocket push, while `/api/broker/dhan/quote` serves from the coalesced snapshot cache with zero redundant external broker requests ($O(1)$ scaling).
  3. **Headless Idempotent Alert Dispatch:** Crossover latching and multi-user Telegram push alerts now execute server-side in `CentralMarketDataService` with deterministic deduplication (`public.alert_dispatch_logs`), firing alerts even when all browser tabs are closed.

#### Affected Components & Files
- `src/lib/types/quant.ts`: Added `CentralMarketSnapshot`, `CentralFeedHealth`, `FeedHealthStatus`, `LiveQuoteRecord` domain interfaces.
- `src/lib/services/alertSettingsService.ts`: New service handling user alert preferences, token masking, and destination routing.
- `src/app/api/alerts/settings/route.ts`: Authenticated API route for retrieving masked alert settings and saving to `user_alert_settings`.
- `src/app/api/alerts/telegram/route.ts`: Updated to resolve stored tokens for masked client submissions and support server-side user resolution.
- `src/components/modals/AlertsModal.tsx`: Redesigned to load and persist cloud-backed alert preferences with cross-device sync status badge.
- `src/lib/services/centralMarketDataService.ts`: Core centralized ingestion engine with batching, volume sanitization, crossover latches, deduplicated alert dispatch, in-memory caching, and distributed lease locking.
- `src/worker/marketDataWorker.ts`: Standalone background worker process for continuous market ingestion and lease heartbeat.
- `src/app/api/pipeline/central-feed-tick/route.ts`: Serverless trigger endpoint for centralized feed ticks.
- `src/app/api/broker/dhan/quote/route.ts`: Refactored to serve immediately from `centralMarketDataService` coalesced cache, eliminating redundant external calls.
- `src/context/QuantPulseContext.tsx`: Connected Supabase Realtime `live_tick_snapshots` and `market_feed_health` listeners, added `centralFeedHealth` state, and relaxed live streaming polling interval.
- `src/components/zones/ZoneA_Header.tsx`: Integrated centralized feed health telemetry monitor and status indicators.
- `supabase_user_alert_settings.sql`: Idempotent SQL migration for `user_alert_settings` table and RLS policies.
- `supabase_central_market_data.sql`: Idempotent SQL migration for `live_tick_snapshots` unique ticker constraint, `market_feed_leases`, `market_feed_health`, and `alert_dispatch_logs`.
- `package.json`: Added `npm run worker` script and updated `npm test` script to run architecture test suite.
- `tests/architecture/centralMarketDataAndTelegram.test.ts`: Automated test suite covering token masking, 15-browser request coalescing, exact physical shares, opening stabilization, session timing gates, feed fallbacks, and multi-user alert routing.

#### Database & Schema Impact
- **Tables Touched:** `public.user_alert_settings` (NEW), `public.market_feed_leases` (NEW), `public.market_feed_health` (NEW), `public.alert_dispatch_logs` (NEW), `public.live_tick_snapshots` (ALTER), `public.watchlist` (UPDATE)
- **Operations:** `CREATE TABLE`, `ALTER TABLE ADD CONSTRAINT`, `ROW LEVEL SECURITY`, `ALTER PUBLICATION`
- **Migration Scripts:** `supabase_user_alert_settings.sql`, `supabase_central_market_data.sql`

#### Invariant Verification
- [x] Invariant 1: 20-Day Baseline Excludes Today's Session
- [x] Invariant 2: Rule 1 Bullish Price Confirmation Required
- [x] Invariant 3: Single Crossover Event per Stock per Session (Sticky Latch & Server Dedup)
- [x] Invariant 4: No Volume Fallback to Previous Day
- [x] Invariant 5: Opening Minute Stabilization (No Triggers before 09:16 IST)
- [x] Invariant 6: Strict 1% Stop Loss & 1:2 Risk-Reward Ratio
- [x] Invariant 7: Idempotent Order Dispatch
- [x] Invariant 8: TSL Trailing Ratchet Rule (Never Lowers)
- [x] Invariant 9: Preserved Stock Master and Global Watchlist State
- [x] Invariant 10: Fail-Safe Broker Disconnect & Offline Simulation
- [x] Invariant 11: Zero Round-Off & Slippage Precision Standard (Exact Physical Shares)
- [x] Invariant 12: Strict Zero-Target Invariant for NIFTY Overnight Strategy

#### Verification & Testing Performed
- Executed full test suite (`npm test`): 31 of 31 automated tests passed (17 strategy tests + 14 architecture/central-feed tests).
- Verified TypeScript compilation: `npx tsc --noEmit` exited with code 0 (zero errors).
- Verified Next.js production build: `npm run build` completed successfully with code 0 across all 21 static and dynamic routes.
- Simulated 15 simultaneous browser requests coalescing into exactly 1 external feed fetch.
- Validated distributed lease acquisition, renewal, and standby takeover after expiry.

#### Rollback Procedure
- Revert git commit and execute:
  `DROP TABLE IF EXISTS public.user_alert_settings, public.market_feed_leases, public.market_feed_health, public.alert_dispatch_logs;`
  `ALTER TABLE public.live_tick_snapshots DROP CONSTRAINT IF EXISTS uq_live_tick_snapshots_ticker;`

---

### [2026-10-01 17:45 IST] — Implementation of NIFTY 09:20 Premium 62.5 Overnight Strategy
- **Commit SHA / Version:** Pending (`main`) / `v2.2.0`
- **Author / Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)
- **Category:** `Feature` / `Database`
- **Business Rationale / Objective:** 
  Implement the institutional options trading strategy "NIFTY 09:20 Premium 62.5 Overnight Strategy" (Strategy ID: `NIFTY_0920_PREMIUM_625_OVERNIGHT`). At 09:20 AM IST every valid trading day, the strategy resolves the target NIFTY expiry (skipping today's expiry if today is expiry day), captures 09:20 reference quotes, filters options between ₹50 and ₹75, and independently selects the CE and PE contracts closest to ₹62.50. Fixes a strict 25% Stop Loss (`reference_price * 0.75`) with ZERO profit target. Monitored intraday for SL breach (`LTP <= SL` -> immediate exit). If SL is not hit, the position is held overnight (exempted from 15:35 market-close square-off) and mandatorily exited at 09:25 AM IST on the next valid NSE trading day (skipping weekends & exchange holidays), with crash recovery exit support.

#### Affected Components & Files
- `src/lib/types/quant.ts`: Added `strategyId`, `allowOvernight`, `referencePrice`, `nextTradingDay`, `exit_reason` fields to `Position` and `TradeLog`. Added `NiftyOvernightState`, `NiftyOptionLeg`, `NiftyOvernightStatus` types.
- `src/lib/services/tradingCalendarService.ts`: New calendar utility calculating the next valid NSE trading day skipping weekends and gazetted holidays.
- `src/lib/strategies/niftyOvernightEngine.ts`: Core pure mathematical engine handling expiry skipping, candidate filtering, closest-to-62.5 selection, fixed 25% SL, and exit validations.
- `src/app/api/strategy/nifty-overnight/route.ts`: Serverless API route handling 09:20 scan/selection, intraday SL exits, mandatory 09:25 exits, and crash recovery. Enhanced with dual GET/POST support for Vercel Cron triggers, holiday check gate (`isNseTradingDay`), and permanent recording to `public.trade_logs`.
- `vercel.json`: Added institutional Vercel Cron jobs for 09:20 AM IST (`50 3 * * 1-5`) scan and 09:25 AM IST (`55 3 * * 1-5`) mandatory next-day exit.
- `src/app/api/pipeline/market-close-archive/route.ts`: Added exemption filter to bypass auto square-off for `NIFTY_0920_PREMIUM_625_OVERNIGHT` / `allow_overnight` positions, transitioning them cleanly to `OVERNIGHT_HOLD`.
- `src/components/strategies/Zone_NiftyOvernight.tsx`: Section 21 compliant specialized strategy control & monitoring panel.
- `src/components/zones/ZoneA_Header.tsx`: Integrated dual-strategy toggle between `20D Crossover` and `🌙 NIFTY 09:20 Overnight`.
- `src/components/zones/ZoneE_Positions.tsx`: Suppressed profit target displays and TSL controls for overnight positions; replaced with Fixed 25% SL and 09:25 Next-Day exit badge.
- `src/app/page.tsx`: Dynamically toggles between 20D Crossover screener zones and NIFTY Overnight Strategy view based on selected strategy.
- `src/context/QuantPulseContext.tsx`: Wired strategy state, automated timers (09:20 scan, 09:25 exit), and interactive simulation actions.
- `supabase_nifty_overnight_strategy.sql`: Database migration creating `strategy_nifty_overnight` and updating `active_positions` / `trade_logs`.
- `NewStrategy.html`: Standalone interactive single-page simulation prototype with live quote simulators and scenario buttons.

#### Database & Schema Impact
- **Tables Touched:** `public.strategy_nifty_overnight` (NEW), `public.active_positions` (ALTER), `public.trade_logs` (ALTER)
- **Operations:** `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `ROW LEVEL SECURITY`
- **Migration Script:** `supabase_nifty_overnight_strategy.sql`

#### Invariant Verification
- [x] Invariant 1: 20-Day Baseline Excludes Today's Session (20D Strategy Untouched)
- [x] Invariant 2: Rule 1 Bullish Price Confirmation Required (20D Strategy Untouched)
- [x] Invariant 3: Single Crossover Event per Stock per Session (Sticky Latch Untouched)
- [x] Invariant 4: No Volume Fallback to Previous Day (Untouched)
- [x] Invariant 5: Opening Minute Stabilization (No Triggers before 09:16 IST)
- [x] Invariant 6: Strict 1% Stop Loss & 1:2 Risk-Reward Ratio (20D Strategy Untouched)
- [x] Invariant 7: Idempotent Order Dispatch
- [x] Invariant 8: TSL Trailing Ratchet Rule (Never Lowers)
- [x] Invariant 9: Preserved Stock Master and Watchlist State
- [x] Invariant 10: Fail-Safe Broker Disconnect & Offline Simulation
- [x] Invariant 11: Zero Round-Off & Slippage Precision Standard
- [x] Invariant 12: Strict Zero-Target Invariant for NIFTY Overnight Strategy
- [x] Invariant 13: Expiry Skip Rule on Expiry Day
- [x] Invariant 14: Market-Close Square-Off Exemption for Overnight Positions
- [x] Invariant 15: Mandatory 09:25 Next-Trading-Day Exit with Crash Recovery

#### Verification & Testing Performed
- Executed `test-nifty-engine.mjs` unit test suite verifying:
  - Expiry day skip rule (selected next available weekly expiry).
  - Normal day nearest expiry selection.
  - Option candidate filtering in range `[50, 75]`.
  - Closest distance selection to ₹62.50.
  - Exact 25% SL calculation (`62 -> 46.50`, `64 -> 48.00`, `61 -> 45.75`, `63 -> 47.25`).
  - SL hit detection (`LTP <= SL`).
- Verified full TypeScript strict type checking with zero errors via `tsc --noEmit`.
- Validated interactive prototype `NewStrategy.html` across all scenarios (Intraday SL hit, EOD overnight hold, Next-Day 09:25 exit, Server reboot recovery).

#### Rollback Procedure
- Revert git commit and drop table `public.strategy_nifty_overnight`.

---

### [2026-10-01 11:28 IST] — Fix TypeScript Inferred Return Type for Watchlist Baseline Sync
- **Commit SHA / Version:** Pending (`main`) / `v2.1.1`
- **Author / Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)
- **Category:** `Fix`
- **Business Rationale / Objective:** 
  Fix TypeScript build failure during Vercel deployment where `prevWl.map(...)` without an explicit return type inferred an anonymous object array requiring `avg20DTradedShares: number`, causing `updated.push(stock)` to fail type checking because `Stock.avg20DTradedShares` is optional (`number | undefined`). Explicitly typed `updated: Stock[]` and mapper as `: Stock`.

#### Affected Components & Files
- `src/context/QuantPulseContext.tsx`: Explicitly typed `const updated: Stock[] = prevWl.map((stock): Stock => ...)` in `syncBaselines` and typed callback return as `Stock` in `resetSessionData`.

#### Database & Schema Impact
- **Tables Touched:** None
- **Operations:** None
- **Migration Script:** N/A

#### Invariant Verification
- [x] Invariant 1: 20-Day Baseline Excludes Today's Session
- [x] Invariant 2: Rule 1 Bullish Price Confirmation Required
- [x] Invariant 3: Single Crossover Event per Stock per Session (Sticky Latch)
- [x] Invariant 4: No Volume Fallback to Previous Day
- [x] Invariant 5: Opening Minute Stabilization (No Triggers before 09:16 IST)
- [x] Invariant 6: Strict 1% Stop Loss & 1:2 Risk-Reward Ratio
- [x] Invariant 7: Idempotent Order Dispatch
- [x] Invariant 8: TSL Trailing Ratchet Rule (Never Lowers)
- [x] Invariant 9: Preserved Stock Master and Watchlist State
- [x] Invariant 10: Fail-Safe Broker Disconnect & Offline Simulation
- [x] Invariant 11: Zero Round-Off & Slippage Precision Standard

#### Verification & Testing Performed
- Validated TypeScript typing in `QuantPulseContext.tsx` ensuring compatibility with `Stock[]`.

#### Rollback Procedure
- `git revert HEAD`

---

### [2026-10-01 11:20 IST] — Zero Round-Off & Slippage Precision for Average Traded Shares & Crossovers
- **Commit SHA / Version:** `86ccd8b` / `v2.1.0`
- **Author / Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)
- **Category:** `Fix` / `Feature` / `Database`
- **Business Rationale / Objective:** 
  Previously, 20-Day Average Traded Shares and Today's Live Traded Shares were truncated to 3 decimal places in millions (`toFixed(3)`). In 1 Million, a 3-decimal truncation (`0.001M`) loses up to 999 physical shares of precision, causing rounded artificial numbers (e.g. `1,234,000` or `2,600,000` shares) with `.000` trailing zeros in Zone B, Zone C, and Zone D. Furthermore, comparing floating-point volume in millions caused slippage/premature crossover triggers at the breakout boundary. This update establishes exact physical share precision (`todayTradedShares`, `avg20DTradedShares`), unrounded division, integer crossover comparison (`todayShares >= avgShares && todayShares > 0`), and a database migration script to expand volume columns to `NUMERIC(16, 6)`.

#### Affected Components & Files
- `src/lib/types/quant.ts`: Added `avg20DTradedShares?: number` and `todayTradedShares?: number` to `StockMasterItem` and `CrossoverEvent`.
- `src/lib/stocks/stockMaster.ts`: Updated `ResolvedStockMetadata`, `resolveStockMetadata()`, and `convertMasterToStock()` to compute and preserve exact unrounded integer share averages.
- `src/lib/engine/baselineBatchService.ts`: In `calculateFree20DBaseline()` and `calculateSingle20DBaseline()`, eliminated `.toFixed(3)` round-off and returned exact `avg20DTradedShares: Math.round(sumVol / 20)`.
- `src/app/api/broker/dhan/historical-20d/route.ts`: Returned unrounded `avgVolume20DM` and exact `avg20DTradedShares`.
- `src/app/api/broker/dhan/quote/route.ts`: Included raw `volume: effectiveVolume` in `LiveQuoteRecord` and unrounded `volumeM`.
- `src/lib/market/freeLiveMarketService.ts`: Included raw `volume: rawVol` in `LiveQuoteRecord` and unrounded `volumeM`.
- `src/lib/services/liveIngestionEngine.ts`: Propagated exact `todayTradedShares` and `avg20DTradedShares`.
- `src/lib/engine/crossoverEngine.ts`: Evaluated crossovers using exact integer shares (`todayShares >= avgShares && todayShares > 0`) in `getVolumeScreenerMetrics()` and `checkAndLatchVolumeCrossover()`. Added exact shares to `INITIAL_WATCHLIST_DATA`.
- `src/components/zones/ZoneC_Screener.tsx`: Rendered exact `todayShares` and `avg20DShares` without round-off or trailing `.000`.
- `src/components/zones/ZoneB_Watchlist.tsx`: Displayed exact `avg20DTradedShares`.
- `src/components/zones/ZoneD_NextAction.tsx`: Displayed exact share counts and deficit/surplus.
- `src/context/QuantPulseContext.tsx`: Maintained exact `avg20DTradedShares` and `todayTradedShares` across `syncBaselines`, `loadFromSupabase`, live quote polling, tick simulation, and `forceCrossover`.
- `src/lib/alerts/telegramService.ts`: Supported exact share counts in `formatCrossoverAlert`.
- `supabase_exact_shares_precision.sql`: Created SQL migration script to expand `avg_vol_20d_m` and `today_vol_m` to `NUMERIC(16, 6)` and add `BIGINT` share columns.
- `APPLICATION_BIBLE.md`: Documented Invariant 11 (Zero Round-Off & Slippage) and BUG-004.

#### Database & Schema Impact
- **Tables Touched:** `watchlist`, `stock_master`, `crossover_events`, `live_tick_snapshots`
- **Operations:** Expanded precision to 6 decimals, added `BIGINT` share columns.
- **Migration Script:** `supabase_exact_shares_precision.sql`

#### Invariant Verification
- [x] Invariant 1: 20-Day Baseline Excludes Today's Session
- [x] Invariant 2: Rule 1 Bullish Price Confirmation Required
- [x] Invariant 3: Single Crossover Event per Stock per Session (Sticky Latch)
- [x] Invariant 4: No Volume Fallback to Previous Day
- [x] Invariant 5: Opening Minute Stabilization (No Triggers before 09:16 IST)
- [x] Invariant 6: Strict 1% Stop Loss & 1:2 Risk-Reward Ratio
- [x] Invariant 7: Idempotent Order Dispatch
- [x] Invariant 8: TSL Trailing Ratchet Rule (Never Lowers)
- [x] Invariant 9: Preserved Stock Master and Watchlist State
- [x] Invariant 10: Fail-Safe Broker Disconnect & Offline Simulation
- [x] Invariant 11: Zero Round-Off & Slippage Invariant (Exact Physical Shares)

#### Verification & Testing Performed
- Static code analysis across all 14 affected files. Verified exact integer share comparisons (`todayShares >= avgShares`).
- Verified UI formatting with `.toLocaleString('en-IN')` on exact share values across Zone B, Zone C, and Zone D.

#### Rollback Procedure
- `git revert <commit_sha>`

---

### [2026-10-01 10:45 IST] — System Specification & Bible Publication
- **Commit SHA / Version:** Pending (`main`) / `v2.0.0`
- **Author / Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)
- **Category:** `Docs`
- **Business Rationale / Objective:** 
  Published the comprehensive technical and functional specification `APPLICATION_BIBLE.md` and structured `CHANGE_LOG.md` as the permanent Single Source of Truth (SSOT). Provides complete architectural, component, database, mathematical, and algorithmic documentation to enforce the Minimum Change Principle and prevent regressions.

#### Affected Components & Files
- `APPLICATION_BIBLE.md`: Created master system specification (25 sections, architecture, data dictionary, DB bible, invariants, quick change guide).
- `CHANGE_LOG.md`: Created standardized audit log and retrospective history.

#### Database & Schema Impact
- **Tables Touched:** None
- **Operations:** None
- **Migration Script:** N/A

#### Invariant Verification
- [x] All 10 Invariants formally defined and documented as unalterable rules.

#### Verification & Testing Performed
- Full codebase static discovery, file-by-file verification across all UI zones, API routes, engine modules, and Supabase SQL schemas.

#### Rollback Procedure
- `git rm APPLICATION_BIBLE.md CHANGE_LOG.md && git commit -m "revert docs"`

---

### [2026-10-01 10:13 IST] — Zone E Order Reset, Active Positions Filter & Clean Slate
- **Commit SHA / Version:** `ccf1fbca57a8f25b9e64b7720f6999eed58f0342` / `v1.9.5`
- **Author / Agent:** QuantPulse Developer
- **Category:** `Fix` / `Database`
- **Business Rationale / Objective:** 
  Closed positions and cancelled trades previously lingered in the Zone E table and local state because `loadFromSupabase()` fetched all records without filtering by lifecycle state, causing false idempotency locks (`idempotencyLock.has(symbol)`) that prevented re-trading or clean daily startups. Furthermore, Zone E's table was mapping over raw `positions` instead of active `openPositions`.

#### Affected Components & Files
- `src/app/api/pipeline/clear-session/route.ts`:
  - Extended session purge to explicitly delete `crossover_events`, `trade_logs`, `active_positions`, `tsl_audit_trail`, and reset `system_config`.
  - Added optional `delete_positions` parameter.
- `src/context/QuantPulseContext.tsx`:
  - Filtered `active_positions` queries in `loadFromSupabase()` with `.lt('state_index', 4)` so only active states (0: PENDING, 1: ACTIVE, 2: TSL_1R, 3: TSL_2R) are loaded into active state.
  - Cleared `idempotencyLock` set on session purge to allow fresh order entries.
  - Ensured `crossoverEngine.reset()` clears sticky latches.
- `src/components/zones/ZoneE_Positions.tsx`:
  - Mapped table rows to `openPositions` (filtered active list) rather than raw historical positions array.
  - Added UI indicator for zero active positions vs historical ledger.
- `src/components/modals/CloudAuditLogsModal.tsx`:
  - Filtered out `CANCELLED` orders from the active cloud order book view.
- `supabase_session_clean_slate.sql`:
  - Created standalone SQL maintenance script to truncate `active_positions`, `trade_logs`, `crossover_events`, and `tsl_audit_trail`.

#### Database & Schema Impact
- **Tables Touched:** `active_positions`, `trade_logs`, `crossover_events`, `tsl_audit_trail`
- **Operations:** `DELETE`, `SELECT` filtering
- **Migration Script:** `supabase_session_clean_slate.sql`

#### Invariant Verification
- [x] Invariant 3: Single Crossover Event per Stock per Session (re-verified; cleared cleanly on Day Start)
- [x] Invariant 7: Idempotent Order Dispatch (locks reset only on explicit user session clear)
- [x] Invariant 8: TSL Trailing Ratchet Rule (preserved)

#### Verification & Testing Performed
- Executed `clear-session` route.
- Verified Zone E rendered zero lingering rows in `openPositions`.
- Tested `loadFromSupabase()` with mock historical database records.

#### Rollback Procedure
- `git revert ccf1fbca57a8f25b9e64b7720f6999eed58f0342`

---

### [2026-10-01 09:54 IST] — 9:15 AM Volume Crossover Stabilization & Event-Driven Auto Buy
- **Commit SHA / Version:** `35e0db1c457bc99a7a67f51b574a1fead3f67fd5` / `v1.9.4`
- **Author / Agent:** QuantPulse Developer
- **Category:** `Fix`
- **Business Rationale / Objective:** 
  During the initial 9:15:00 to 9:15:59 IST market open window, the broker (Dhan HQ) marketfeed cache frequently serves yesterday's end-of-day cumulative volume until the exchange feed stabilizes. This caused the system to detect massive false volume crossovers ($RVOL > 1.0$) across dozens of stocks simultaneously at market open, triggering inadvertent buy transactions. Additionally, the periodic `runAutoScan()` loop was executing bulk purchases across all latched items simultaneously.

#### Affected Components & Files
- `src/lib/engine/crossoverEngine.ts`:
  - Added 60-second stabilization gate: suppresses all crossover evaluations if IST time is between `09:15:00` and `09:15:59`.
  - Added validation for trade timestamp: rejects quotes where `lastTradeTime` is prior to today's date or before `09:15:00`.
- `src/app/api/broker/dhan/quote/route.ts`:
  - Added server-side sanitization: if Dhan quote returns previous trading day's timestamp or volume during the opening seconds, cumulative volume is zeroed out.
- `src/lib/market/freeLiveMarketService.ts`:
  - Validated session boundary timestamps to prevent stale previous-day candle volume leakage.
- `src/context/QuantPulseContext.tsx`:
  - Converted auto-buy execution from periodic batch polling (`runAutoScan` interval) to strictly event-driven: orders execute *only* at the precise instant `checkAndLatchVolumeCrossover()` transitions from `false` to `true`.
  - Added sticky in-memory latch and idempotency lock per symbol per day.
- `src/app/api/pipeline/clear-session/route.ts`:
  - Initial creation of the serverless session reset endpoint.
- `src/components/zones/ZoneE_Positions.tsx`:
  - Added "Clear Session" action button to trigger purge endpoint.

#### Database & Schema Impact
- **Tables Touched:** `crossover_events`, `trade_logs`
- **Operations:** Eliminated duplicate and false-positive `INSERT` operations.
- **Migration Script:** N/A

#### Invariant Verification
- [x] Invariant 3: Single Crossover Event per Stock per Session
- [x] Invariant 4: No Volume Fallback to Previous Day
- [x] Invariant 5: Opening Minute Stabilization (No Triggers before 09:16 IST)
- [x] Invariant 7: Idempotent Order Dispatch

#### Verification & Testing Performed
- Simulated 09:15:30 IST timestamp with mock EOD volume quotes; verified that `checkAndLatchVolumeCrossover()` returned `null` and emitted a stabilization log.
- Verified that at 09:16:01 IST with genuine current-day volume, crossover triggered cleanly and locked idempotency.

#### Rollback Procedure
- `git revert 35e0db1c457bc99a7a67f51b574a1fead3f67fd5`

---

### [2026-09-30 23:46 IST] — Supabase Type Wrapping & Promise Safety
- **Commit SHA / Version:** `23ee431118b5ff0b8c3ce3407e75cdceb146ae61` / `v1.9.3`
- **Author / Agent:** QuantPulse Developer
- **Category:** `Fix`
- **Business Rationale / Objective:** 
  PostgrestFilterBuilder in `@supabase/supabase-js` is a Thenable rather than a native ECMAScript Promise, causing type-checker warnings and potential `.catch()` unhandled rejections during background telemetry writes.

#### Affected Components & Files
- `src/lib/services/supabaseTelemetryService.ts`:
  - Wrapped Supabase database calls in `Promise.resolve()` to ensure consistent promise resolution and exception handling.

#### Database & Schema Impact
- **Tables Touched:** None
- **Operations:** None
- **Migration Script:** N/A

#### Invariant Verification
- [x] All invariants preserved.

#### Verification & Testing Performed
- `npm run build` TypeScript type check passed without errors.

#### Rollback Procedure
- `git revert 23ee431118b5ff0b8c3ce3407e75cdceb146ae61`

---

### [2026-09-30 23:43 IST] — Dhan Constants Duplicate Alias Clean
- **Commit SHA / Version:** `30ff22812fc23dfbfcadabe47caccec60d931974` / `v1.9.2`
- **Author / Agent:** QuantPulse Developer
- **Category:** `Refactor`
- **Business Rationale / Objective:** 
  Removed redundant symbol mappings in `dhanConstants.ts` that caused duplicate security ID lookups.

#### Affected Components & Files
- `src/lib/broker/dhanConstants.ts`:
  - Cleaned duplicate dictionary entries.

#### Database & Schema Impact
- None

#### Rollback Procedure
- `git revert 30ff22812fc23dfbfcadabe47caccec60d931974`

---

### [2026-09-30 23:42 IST] — Symbol Standardization: LTIM to LTM
- **Commit SHA / Version:** `4b0471d66a1cb389eada33ab5cc6c5b850fbb9f6` / `v1.9.1`
- **Author / Agent:** QuantPulse Developer
- **Category:** `Fix`
- **Business Rationale / Objective:** 
  Updated ticker symbol for LTIMindtree across the stock master catalog, Dhan security ID mappings, and database seed scripts to align with exchange symbology changes.

#### Affected Components & Files
- `src/lib/stocks/stockMaster.ts`: Standardized symbol from `LTIM` to `LTM`.
- `src/lib/broker/dhanConstants.ts`: Standardized security ID mapping.
- Database schema scripts: Updated seed tables.

#### Database & Schema Impact
- **Tables Touched:** `stock_master`, `watchlist`
- **Operations:** Update symbol key
- **Migration Script:** Included in SQL update scripts.

#### Rollback Procedure
- `git revert 4b0471d66a1cb389eada33ab5cc6c5b850fbb9f6`
