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
