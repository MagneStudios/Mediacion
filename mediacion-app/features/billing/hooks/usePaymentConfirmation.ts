import { useEffect, useState } from 'react';

import { billingService } from '../../../services/billing.service';
import type { MockSubscription } from '../../../types/billing';

/**
 * `confirming` while we still expect the webhook to land, `confirmed` once the
 * subscription is really active, `stillPending` when the budget ran out.
 *
 * **There is no error state, and that is deliberate** (Pactum spec §9.6). The
 * user's money already left; a red screen would say the payment failed when
 * what actually happened is that a webhook is a few seconds behind. A read
 * that fails is a reason to try again, not a reason to tell them something
 * went wrong.
 */
export type PaymentConfirmationStatus = 'confirming' | 'confirmed' | 'stillPending';

/** Spec §9.6: "polling cada 3 s durante 60 s". */
const pollIntervalMs = 3000;
const confirmationBudgetMs = 60000;

const activeStatus = 'activa';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a subscription to become active after the user comes back from
 * MercadoPago.
 *
 * The activation happens in the webhook, never in the callback the user lands
 * on (spec §6.3.5) — they can close the browser before the redirect and the
 * subscription still has to activate. So this screen cannot know anything by
 * itself: it asks our own server, repeatedly, until the answer changes.
 *
 * **Nothing MercadoPago puts in the return URL is consulted.** Those
 * parameters are attacker-controlled — anyone can open the callback with
 * `?status=approved` — and the spec is explicit that the webhook decides. The
 * only source of truth is `GET /suscripciones/vigente` through our own API.
 *
 * Polls on a chained timeout rather than `setInterval`: on a slow connection an
 * interval stacks requests that all answer the same question, and the answers
 * can arrive out of order.
 */
export function usePaymentConfirmation() {
  const [status, setStatus] = useState<PaymentConfirmationStatus>('confirming');
  const [subscription, setSubscription] = useState<MockSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + confirmationBudgetMs;

    async function poll() {
      while (!cancelled) {
        try {
          const current = await billingService.getCurrentSubscription();
          if (cancelled) return;
          if (current?.estado === activeStatus) {
            setSubscription(current);
            setStatus('confirmed');
            return;
          }
          // Anything else — no row yet, or `pendiente_pago` — is the expected
          // shape of "the webhook has not landed". Keep the last known row so
          // the screen can name the plan while it waits.
          setSubscription(current ?? null);
        } catch {
          // A dropped request says nothing about the payment. Swallow it and
          // ask again; the budget below is what ends this, not one failure.
        }
        // Measured against the clock, not a count of attempts: with slow
        // answers, twenty attempts would run well past the minute promised.
        if (Date.now() >= deadline) {
          if (!cancelled) setStatus('stillPending');
          return;
        }
        await sleep(pollIntervalMs);
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, subscription };
}
