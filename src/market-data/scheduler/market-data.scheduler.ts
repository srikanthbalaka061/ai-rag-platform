import { randomUUID } from "node:crypto";
import cron from "node-cron";
import { marketDataConfig } from "../market-data.config.js";
import {
  acquireMarketDataJobLock,
  releaseMarketDataJobLock,
} from "../repositories/market-data.repository.js";
import { syncDailyMarketData } from "../services/daily-market-data.service.js";

const JOB_NAME = "nightly_market_data_sync";
const LOCK_LEASE_SECONDS = 6 * 60 * 60;

export function startMarketDataScheduler(): void {
  cron.schedule(
    "0 23 * * *",
    async () => {
      const leaseToken = randomUUID();
      let lockAcquired = false;
      try {
        lockAcquired = await acquireMarketDataJobLock(
          JOB_NAME,
          leaseToken,
          LOCK_LEASE_SECONDS
        );
        if (!lockAcquired) {
          console.info("Nightly market-data sync is already running elsewhere");
          return;
        }

        await syncDailyMarketData();
        console.info("Nightly market-data sync completed");
      } catch (error) {
        console.error("Nightly market-data sync failed:", error);
      } finally {
        if (lockAcquired) {
          try {
            await releaseMarketDataJobLock(JOB_NAME, leaseToken);
          } catch (error) {
            console.error("Failed to release market-data sync lock:", error);
          }
        }
      }
    },
    {
      timezone: marketDataConfig.scheduleTimezone,
      noOverlap: true,
    }
  );
  console.info(
    `Nightly market-data sync scheduled for 11:00 PM ${marketDataConfig.scheduleTimezone}`
  );
}
