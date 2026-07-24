import type { Semaforo } from "./casos.types";

const ROJO_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const AMARILLO_THRESHOLD_MS = 72 * 60 * 60 * 1000;

export function computeSemaforo(
  plazo: Date | null,
  now: Date,
): Semaforo | null {
  if (plazo === null) {
    return null;
  }

  const remainingMs = plazo.getTime() - now.getTime();

  if (remainingMs <= ROJO_THRESHOLD_MS) {
    return "rojo";
  }
  if (remainingMs <= AMARILLO_THRESHOLD_MS) {
    return "amarillo";
  }
  return "verde";
}
