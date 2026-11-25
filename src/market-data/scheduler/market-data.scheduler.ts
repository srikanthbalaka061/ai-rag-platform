import { randomUUID } from "node:crypto";
import cron from "node-cron";
import { marketDataConfig } from "../config/market-data.config.js";
import {
  acquireMarketDataJobLock,
  releaseMarketDataJobLock,
} from "../repositories/market-data.repository.js";
import { syncDailyMarketData } from "../services/daily-market-data.service.js";

const JOB_NAME = "weekday_current_date_market_data_sync";
const LOCK_LEASE_SECONDS = 6 * 60 * 60;
const CRON_EXPRESSION = "0 23 * * 1-5";

export function startMarketDataScheduler(): void {
  cron.schedule(
    CRON_EXPRESSION,
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
          console.info("Weekday market-data sync is already running elsewhere");
          return;
        }

        await syncDailyMarketData();
        console.info("Weekday current-date market-data sync completed");
      } catch (error) {
        console.error("Weekday current-date market-data sync failed:", error);
      } finally {
        if (lockAcquired) {
          try {
            await releaseMarketDataJobLock(JOB_NAME, leaseToken);
          } catch (error) {
            console.error("Failed to release weekday market-data sync lock:", error);
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
    `Weekday current-date market-data sync scheduled with cron "${CRON_EXPRESSION}" (11:00 PM Monday-Friday, ${marketDataConfig.scheduleTimezone}); weekends are skipped. It fetches market-wide bulk deals, block deals, and insider trades in pages of 200, stops when a page reaches a non-current date, and stores each fetched record with its market date.`
  );
}
