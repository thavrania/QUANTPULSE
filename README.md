# QuantPulse — 20-Day Volume Crossover & Options Execution Terminal

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Stack](https://img.shields.io/badge/Stack-Next.js%2014%20%7C%20Supabase%20%7C%20Tailwind-emerald)
![Hosting Cost](https://img.shields.io/badge/Hosting%20Cost-%240%20Free%20Forever-brightgreen)

**QuantPulse** is an institutional-grade intraday algorithmic trading screener and options execution terminal. It tracks real-time equity and derivative volume against 20-Day moving averages, latches immutable timestamps upon volume crossovers, and provides dynamic dual-instrument sizing with a 4-state trailing stop-loss (TSL) risk engine.

---

## 🏗️ 5-Zone Terminal Architecture

* **Zone A: Global Command & Master Toggles Header**
  * Live Market Clock (IST ticker)
  * **Toggle 1 (Instrument Mode)**: `BUY STOCK (EQ)` vs `BUY OPTION (ATM CE)`
  * **Toggle 2 (Execution Mode)**: `MANUAL` (review & click) vs `AUTO TRADE` (automated dispatch upon crossover)
  * Capital allocation per trade & Live daily MTM P&L
  * Simulator Controls: `+ Boost Vol Tick`, `▶ Start Live Vol Stream`, `↺ Reset`
  * Panic Kill-Switch: Instantly turns off Auto Mode and squares off all open positions

* **Zone B: Watchlist & Immutable Crossover Log**
  * Custom stock ingestion form (Symbol, F&O / Cash segment, Spot LTP, 20D Avg Vol, Today Vol)
  * Reverse-chronological event log displaying the exact latched crossover times (`HH:MM:SS IST`)

* **Zone C: 20-Day Volume Screener Table**
  * Real-time comparison of `Today_Vol` vs `20D_Avg_Vol`
  * Relative volume ratio ($x$), surplus/deficit in millions of shares
  * Visual progress bar toward 100% crossover threshold
  * Exact latched crossover timestamp & spot price at cross
  * "Cross 20D Now" quick-test simulation trigger

* **Zone D: Dynamic Next-Action Card**
  * **Stock Mode**: Equity quantity sizing based on capital, 1% risk per share, Stop-Loss, 1:2 Target
  * **Option Mode**: Automatic ATM strike selection (`CE`), lot sizing, premium estimation, Greeks (Delta 0.52, IV%), 20% premium Stop-Loss, and +40% Target
  * **F&O Guardrail**: If a cash-only stock is selected while Option mode is active, automatically falls back to Cash Equity
  * Pre-crossover buy lock and Auto-Mode dispatch audit

* **Zone E: Executed Trades & 4-State Trailing Stop-Loss (TSL) Monitor**
  * Tracks open positions with order time, reference 20D crossover timestamp, entry price, current LTP, and live P&L
  * **4-State Trailing Stop-Loss Machine**:
    * *State 1*: Initial 1R Stop-Loss
    * *State 2*: +1R gain reached $\rightarrow$ Trailing SL moved to Breakeven
    * *State 3*: +2R gain reached $\rightarrow$ Trailing SL trails to lock in +1R profit
    * *State 4*: Target hit / Exited / Squared off
  * Idempotency locks to prevent duplicate buys on the same stock

---

## 🚀 Free Cloud Setup (100% Free Forever)

This application is architected to run with **zero hosting cost**:
* **Frontend Hosting**: [Vercel](https://vercel.com) (Free Hobby Tier — zero cold starts, global CDN)
* **Database & WebSockets**: [Supabase](https://supabase.com) (Free 500MB PostgreSQL with Realtime enabled)

---

### Step 1: Set Up Free Supabase Database (2 Minutes)

1. Create a free account at [supabase.com](https://supabase.com).
2. Click **New Project**, choose a name (e.g. `quantpulse-db`), set a database password, and select the region nearest to you.
3. Once the project is created, click on **SQL Editor** in the left sidebar.
4. Open the [`supabase_schema.sql`](./supabase_schema.sql) file from this repository, copy its entire contents, paste it into the Supabase SQL Editor, and click **Run**.
   * *This will create all 4 tables (`watchlist`, `crossover_events`, `active_positions`, `system_config`), seed the initial data, configure Row Level Security (RLS), and enable Realtime replication.*
5. Go to **Project Settings** (gear icon) $\rightarrow$ **API**.
6. Copy:
   * **Project URL**
   * **Project API Key (`anon` / `public`)**

---

### Step 2: Deploy to Vercel for Free (1-Click Deployment)

#### Method A: Via GitHub (Recommended)
1. Create a free GitHub repository (e.g. `quantpulse-terminal`) and push this project:
   ```bash
   git init
   git add .
   git commit -m "feat: initial QuantPulse terminal release"
   git branch -M main
   git remote add origin https://github.com/<your-username>/quantpulse-terminal.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and log in with GitHub.
3. Click **Add New...** $\rightarrow$ **Project**, then click **Import** next to `quantpulse-terminal`.
4. In the **Environment Variables** section, add:
   * `NEXT_PUBLIC_SUPABASE_URL` = `<your-supabase-project-url>`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<your-supabase-anon-key>`
5. Click **Deploy**.
6. In ~60 seconds, your production terminal will be live at `https://quantpulse-terminal.vercel.app` with free SSL and automatic updates whenever you push code!

#### Method B: Zero-Config Standalone Demo Mode
* If you deploy without setting the Supabase environment variables, QuantPulse **automatically runs in high-fidelity simulation mode**. The entire 5-zone UI, tick simulator, crossover latching, and TSL state machine work instantly in any browser without requiring an external database!

---

## 💻 Local Development (Optional)

If you have Node.js 18+ installed locally:

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional)
cp .env.example .env.local

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Enterprise Risk & Guardrail Matrix

| Risk Scenario | QuantPulse Guardrail | System Response |
| :--- | :--- | :--- |
| Pre-Crossover Buy Attempt | Volume Eligibility Comparator | Buy button disabled; toast warning emitted |
| Option Mode on Cash Stock | F&O Instrument Validation | Fallback to Stock Equity with clear amber notification |
| Duplicate Buy Signal | Idempotency Lock Set | Ignores subsequent ticks once an order is dispatched |
| Market Crash / Outlier Tick | Panic Kill-Switch | Turns off Auto Mode and immediately squares off all active positions |
| Capital Limit Exceeded | Max Open Positions Rule | Rejects orders if open legs reach configured ceiling (default: 5) |

---

## 📄 License
MIT © 2026 QuantPulse Technologies.
