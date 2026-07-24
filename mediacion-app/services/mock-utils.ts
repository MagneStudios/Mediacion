/** Shared helpers for the mock service layer (cases, positions, …). */

export function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function rejectAfter(message: string, ms: number): Promise<never> {
  return new Promise((_resolve, reject) => setTimeout(() => reject(new Error(message)), ms));
}

/**
 * Dev/test-only forced-failure controller. Never imported by a screen or UI
 * component — there is no user-facing toggle. A future test file can call
 * `force(operation)` to exercise a service's recoverable-error path once,
 * without touching the normal success path used by everyone else.
 */
export function createFailureController<Operation extends string>() {
  const forced = new Set<Operation>();
  return {
    force(operation: Operation): void {
      forced.add(operation);
    },
    consume(operation: Operation): boolean {
      if (forced.has(operation)) {
        forced.delete(operation);
        return true;
      }
      return false;
    },
  };
}
