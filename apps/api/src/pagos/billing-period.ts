import type { BillingPeriod } from "./pagos.types";

export const billingPeriodDays = 30;

const millisPerDay = 24 * 60 * 60 * 1000;

export const billingPeriodMs = billingPeriodDays * millisPerDay;

export function billingPeriodStartingAt(start: Date): BillingPeriod {
  return {
    period_start: start.toISOString(),
    period_end: new Date(start.getTime() + billingPeriodMs).toISOString(),
  };
}

export function anchoredBillingPeriod(anchor: Date, now: Date): BillingPeriod {
  const elapsedMs = Math.max(0, now.getTime() - anchor.getTime());
  const periodsElapsed = Math.floor(elapsedMs / billingPeriodMs);
  return billingPeriodStartingAt(
    new Date(anchor.getTime() + periodsElapsed * billingPeriodMs),
  );
}
