import { useCallback, useEffect, useState } from 'react';

import { billingService } from '../../../services/billing.service';
import type { SubscriptionUsage } from '../../../types/billing';

export type UseSubscriptionUsageStatus = 'loading' | 'error' | 'success';

/**
 * Este mes: cuánto consumió el titular de su plan (`GET /suscripciones/uso`).
 *
 * Calcado de `useCurrentSubscription`, y por la misma razón: **`usage: null` en
 * estado `success` es un resultado real** —no hay plan contra el cual medir—
 * nunca confundido con `error`. BE responde 404 tanto para "no tenés plan" como
 * para una suscripción ajena, y el backed service traduce las dos a `null`.
 *
 * Se lee por separado de la suscripción a propósito, aunque las dos pantallas
 * que las usan son la misma: son dos requests distintas del servidor, y
 * fusionarlas obligaría a que un fallo del consumo apagara también el estado
 * del plan. La suscripción es lo que la persona vino a ver.
 */
export function useSubscriptionUsage() {
  const [status, setStatus] = useState<UseSubscriptionUsageStatus>('loading');
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    billingService
      .getUsage()
      .then((result) => {
        if (cancelled) return;
        setUsage(result);
        setStatus('success');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { status, usage, reload };
}
