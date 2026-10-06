import { centralMarketDataService } from '../lib/services/centralMarketDataService';
import { hasTodayMarketSessionStarted, getISTDate } from '../lib/services/marketHoursService';

const WORKER_ID = `WORKER_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;
const POLLING_INTERVAL_ACTIVE_MS = 2000;
const POLLING_INTERVAL_IDLE_MS = 10000;

let isRunning = true;

async function runWorkerLoop() {
  console.log(`[QuantPulse Worker] Starting Central Market Data Ingestion Worker (${WORKER_ID})`);

  while (isRunning) {
    const loopStart = Date.now();
    try {
      // 1. Acquire or renew distributed lease
      const hasLease = await centralMarketDataService.acquireOrRenewLease(WORKER_ID, 15);

      if (!hasLease) {
        console.log(`[QuantPulse Worker] Standby: Another instance holds the active lease. Retrying in 5s...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      // 2. Execute centralized tick ingestion
      const result = await centralMarketDataService.ingestMarketTick(WORKER_ID);
      const ist = getISTDate();
      console.log(
        `[QuantPulse Worker] Ingestion tick complete: ${result.count} stocks from ${result.source} (${result.latencyMs}ms) at ${ist.timeStr} IST`
      );
    } catch (err: any) {
      console.error(`[QuantPulse Worker] Error during ingestion loop:`, err.message);
    }

    // Determine sleep interval based on market session
    const sessionActive = hasTodayMarketSessionStarted();
    const targetInterval = sessionActive ? POLLING_INTERVAL_ACTIVE_MS : POLLING_INTERVAL_IDLE_MS;
    const elapsed = Date.now() - loopStart;
    const sleepTime = Math.max(200, targetInterval - elapsed);

    await new Promise((resolve) => setTimeout(resolve, sleepTime));
  }

  // Graceful shutdown: release lease
  console.log(`[QuantPulse Worker] Releasing lease and exiting...`);
  await centralMarketDataService.releaseLease(WORKER_ID);
}

// Handle termination signals
process.on('SIGINT', async () => {
  console.log('\n[QuantPulse Worker] Received SIGINT. Shutting down gracefully...');
  isRunning = false;
  await centralMarketDataService.releaseLease(WORKER_ID);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[QuantPulse Worker] Received SIGTERM. Shutting down gracefully...');
  isRunning = false;
  await centralMarketDataService.releaseLease(WORKER_ID);
  process.exit(0);
});

runWorkerLoop();
