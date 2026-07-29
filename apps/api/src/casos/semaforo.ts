import type { Semaforo } from "./casos.types";

const ROJO_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const AMARILLO_THRESHOLD_MS = 72 * 60 * 60 * 1000;

/**
 * An unusable plazo must read as "unknown", never as "verde": every comparison
 * against NaN is false, so falling through would paint an overdue case healthy.
 */
export function computeSemaforo(
  plazo: Date | null | undefined,
  now: Date,
): Semaforo | null {
  if (plazo === null || plazo === undefined) {
    return null;
  }

  const remainingMs = plazo.getTime() - now.getTime();
  if (Number.isNaN(remainingMs)) {
    return null;
  }

  if (remainingMs <= ROJO_THRESHOLD_MS) {
    return "rojo";
  }
  if (remainingMs <= AMARILLO_THRESHOLD_MS) {
    return "amarillo";
  }
  return "verde";
}
