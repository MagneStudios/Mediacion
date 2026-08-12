import { useCallback, useEffect, useState } from 'react';

import { billingService } from '../../../services/billing.service';
import type { MockSubscription } from '../../../types/billing';

export type UseCurrentSubscriptionStatus = 'loading' | 'error' | 'success';

/**
 * Mirrors `useCaseDetail`'s shape. `subscription: null` in the `success`
 * state is a real, calm result (no active plan) — never conflated with the
 * `error` status, same distinction `getInvitation`/`getPlan` make elsewhere.
 */
export function useCurrentSubscription() {
  const [status, setStatus] = useState<UseCurrentSubscriptionStatus>('loading');
  const [subscription, setSubscription] = useState<MockSubscription | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    billingService
      .getCurrentSubscription()
      .then((result) => {
        if (cancelled) return;
        setSubscription(result);
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

  return { status, subscription, reload };
}
