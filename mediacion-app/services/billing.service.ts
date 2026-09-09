import { createBackedBillingService } from './api/billing.backed-service';
import { backend } from './backend-instance';
import { computeTaxBreakdown } from '../utils/compute-tax-breakdown';
import { generateMockInvoiceId, generateMockPaymentId, generateMockSubscriptionId } from '../utils/mock-id';
import type {
  CheckoutStart,
  MockInvoice,
  MockPayment,
  MockSubscription,
  SubscriptionUsage,
} from '../types/billing';
import { plansService } from './plans.service';
import { createFailureController, delay, rejectAfter } from './mock-utils';

/**
 * R-09 checkout.
 *
 * **Partly live as of 17/08/2026.** BE published `GET /suscripciones/vigente`
 * and `POST /suscripciones/:id/baja` (`docs/fichas-legal-backend.md` §7 y §10),
 * so the singleton at the bottom of this file resolves those two members to the
 * real API whenever a backend is configured. The checkout and the facturas stay
 * on the mock below: there is no factura endpoint, and
 * `POST /suscripciones/:id/pago` answers with a Mercado Pago redirect rather
 * than a confirmed payment, so a "real" checkout here would have to fabricate
 * an approved payment. `services/api/billing.backed-service.ts` states the
 * split and its visible consequence.
 *
 * Single-persona simplification: this app has exactly one authenticated
 * party (`mocks/profile.ts`), so there is one current subscription, not a
 * list keyed by user id — mirrors `profile.service.ts`'s single
 * `mockProfile` module-level store for the same reason.
 */
export type BillingService = {
  getCurrentSubscription(): Promise<MockSubscription | null>;
  /**
   * What the caller consumed of their plan this billing period
   * (`GET /suscripciones/uso`, live since 03/09).
   *
   * `null` is a **successful** answer meaning "no plan to report against" —
   * the same normal state `getCurrentSubscription` returns `null` for, and the
   * same 404 BE answers with. Screens must not render it as a failure.
   */
  getUsage(): Promise<SubscriptionUsage | null>;
  getInvoiceForSubscription(subscriptionId: string): Promise<MockInvoice | null>;
  /**
   * R-09: "todo pago aprobado genera factura" — approval and invoicing are
   * one atomic mock step, never a subscription left dangling without its
   * invoice. Rejects if `planId` doesn't match a real plan (never invents
   * pricing). The tax breakdown is computed from the plan's current
   * `precio`, exactly what a real checkout would send to ARCA.
   */
  subscribeToPlan(planId: string): Promise<{ subscription: MockSubscription; invoice: MockInvoice }>;
  /**
   * Arranca el checkout, que termina distinto según haya backend o no — ver
   * `CheckoutStart`.
   *
   * **Existe aparte de `subscribeToPlan` y no lo reemplaza.** El mock sigue
   * necesitando el camino de un paso para que el flujo de demo funcione sin
   * red, y el camino real no puede devolver una factura porque todavía no hubo
   * cobro. Un solo método obligaría a que uno de los dos mienta.
   */
  startCheckout(planId: string): Promise<CheckoutStart>;
  /**
   * Mock-only "download" — there is no real PDF anywhere in this phase
   * (`invoice.urlPdf` stays null), so this never touches the filesystem or
   * a share sheet. Mirrors the existing `tasks.calendar` "preparar evento"
   * idiom: a delay, then a success state whose copy says plainly that
   * nothing left this sandbox.
   */
  prepareInvoiceDownload(invoiceId: string): Promise<void>;
  /**
   * Botón de baja online (Ley 24.240 art. 10 ter, instructivo TyC §5):
   * cancels the recurring charge by the same medium the user contracted.
   * Distinct from account deactivation (`profile.service`'s R-06 flow) —
   * this ends the billing relationship, not the account. Live against
   * `POST /suscripciones/:id/baja` when a backend is configured; the mock below
   * flips the local subscription so the screen flow also works offline.
   *
   * Takes no id: the backed implementation reads the vigente subscription to
   * get one, and the mock has exactly one. A screen holding an id across a plan
   * change could cancel the wrong row.
   */
  cancelSubscription(): Promise<MockSubscription>;
};

/**
 * The 30-day window BE writes on an approved payment (`apps/api/src/pagos/
 * billing-period.ts`). Mirrored rather than guessed so the mock's period ends
 * on the same day the real one would.
 */
const billingPeriodDays = 30;
const dayInMs = 24 * 60 * 60 * 1000;

/** In-memory only — cleared on app restart, never written to disk. */
let currentSubscription: MockSubscription | null = null;
const invoicesBySubscriptionId: Record<string, MockInvoice> = {};

const failures = createFailureController<'subscribeToPlan' | 'prepareInvoiceDownload' | 'cancelSubscription'>();

export function __mockForceBillingFailure(
  operation: 'subscribeToPlan' | 'prepareInvoiceDownload' | 'cancelSubscription',
): void {
  failures.force(operation);
}

/**
 * How much of the period quota the mock reports as spent.
 *
 * Nothing in this app consumes it on its own: quota is consumed by `POST
 * /casos` on the server, and the mock case service knows nothing about
 * billing. So the honest default is 0 — which is also what BE returns when
 * `usage_counters` has no row yet. The setter below exists so tests and manual
 * checks can reach the states that only appear with a non-zero counter.
 */
let negotiationsUsed = 0;

/** Test-only: drives the usage counter. Never imported by a screen. */
export function __mockSetNegotiationsUsed(used: number): void {
  negotiationsUsed = used;
}

/** Test-only: resets the in-memory store back to its initial (no subscription) state. Never imported by a screen. */
export function __resetMockBilling(): void {
  currentSubscription = null;
  negotiationsUsed = 0;
  for (const key of Object.keys(invoicesBySubscriptionId)) {
    delete invoicesBySubscriptionId[key];
  }
}

export function createMockBillingService(): BillingService {
  // Nombrado en vez de devuelto directo para que `startCheckout` pueda reusar
  // `subscribeToPlan` sin depender de `this`, que se pierde en cuanto alguien
  // desestructura el servicio.
  const service: BillingService = {
    async getCurrentSubscription() {
      return delay(currentSubscription, 300);
    },

    async getUsage() {
      // Mirrors BE's gate: it reports usage for `activa`/`vencida` only — the
      // same set `consume_quota` accepts — and answers 404 for everything else,
      // which the backed service turns into `null`.
      const subscription = currentSubscription;
      if (!subscription || (subscription.estado !== 'activa' && subscription.estado !== 'vencida')) {
        return delay(null, 300);
      }
      const plan = await plansService.getPlan(subscription.planId);
      if (!plan) {
        return delay(null, 300);
      }
      const start = subscription.fechaInicio ?? new Date().toISOString();
      const end = new Date(Date.parse(start) + billingPeriodDays * dayInMs).toISOString();
      return delay(
        {
          periodStart: start,
          periodEnd: end,
          negotiations: { used: negotiationsUsed, limit: plan.maxNegotiationsPerPeriod },
          // **The mock's rule is not BE's, on purpose.** BE returns `clientes`
          // only for the titular of an estudio; this app has exactly one
          // persona and no estudio concept (`mocks/profile.ts`), so there is
          // nothing here to resolve titularidad from. Keying off the plan
          // carrying a client quota at all is the closest derivable stand-in —
          // subscribe to `estudio` and the row appears, to `base` and it does
          // not — rather than hardcoding one of the two states.
          clients:
            plan.maxClientsPerPeriod === null
              ? null
              : { used: 0, limit: plan.maxClientsPerPeriod },
        },
        300,
      );
    },

    async getInvoiceForSubscription(subscriptionId) {
      return delay(invoicesBySubscriptionId[subscriptionId] ?? null, 300);
    },

    async subscribeToPlan(planId) {
      if (failures.consume('subscribeToPlan')) {
        return rejectAfter('mock_subscribe_failed', 700);
      }

      const plan = await plansService.getPlan(planId);
      if (!plan) {
        return rejectAfter('plan_not_found', 300);
      }

      const now = new Date().toISOString();
      const subscriptionId = generateMockSubscriptionId();
      const paymentId = generateMockPaymentId();
      const breakdown = computeTaxBreakdown(plan.precio);

      // Built complete before committing anything — a forced failure above
      // never leaves a subscription without its payment/invoice, or vice
      // versa (same build-full-next-state → delay → commit convention as
      // every other mock service in this app).
      const subscription: MockSubscription = {
        id: subscriptionId,
        planId: plan.id,
        estado: 'activa',
        fechaInicio: now,
        fechaFin: null,
      };
      const payment: MockPayment = {
        id: paymentId,
        suscripcionId: subscriptionId,
        estado: 'aprobado',
        monto: breakdown.total,
        createdAt: now,
      };
      const invoice: MockInvoice = {
        id: generateMockInvoiceId(),
        pagoId: payment.id,
        numero: null,
        cae: null,
        urlPdf: null,
        neto: breakdown.neto,
        iva: breakdown.iva,
        impuestos: breakdown.otrosImpuestos,
        total: breakdown.total,
        moneda: plan.moneda,
        estado: 'emitida',
        createdAt: now,
      };

      const committed = await delay({ subscription, invoice }, 900);
      currentSubscription = committed.subscription;
      invoicesBySubscriptionId[committed.subscription.id] = committed.invoice;
      return committed;
    },

    async startCheckout(planId) {
      // Contra el mock no hay a dónde redirigir: no existe una preferencia de
      // Mercado Pago sin API. El checkout simulado es el que ya estaba, y se
      // reusa entero para que el flujo de demo no tenga una segunda ruta que
      // mantener.
      const { subscription, invoice } = await service.subscribeToPlan(planId);
      return { kind: 'simulated' as const, subscription, invoice };
    },

    async cancelSubscription() {
      if (failures.consume('cancelSubscription')) {
        return rejectAfter('mock_cancel_subscription_failed', 600);
      }
      if (!currentSubscription || currentSubscription.estado !== 'activa') {
        return rejectAfter('no_active_subscription', 300);
      }
      const cancelled: MockSubscription = {
        ...currentSubscription,
        estado: 'cancelada',
        fechaFin: new Date().toISOString(),
      };
      const committed = await delay(cancelled, 700);
      currentSubscription = committed;
      return committed;
    },

    async prepareInvoiceDownload(invoiceId) {
      if (failures.consume('prepareInvoiceDownload')) {
        return rejectAfter('mock_invoice_download_failed', 500);
      }
      const exists = Object.values(invoicesBySubscriptionId).some((invoice) => invoice.id === invoiceId);
      if (!exists) {
        return rejectAfter('invoice_not_found', 300);
      }
      await delay(undefined, 700);
    },
  };
  return service;
}

/**
 * Default instance consumed by the billing feature hooks — the real API for the
 * two endpoints that exist (the vigente read and the baja online), the mock for
 * the checkout and the facturas, which have no endpoints. Same selection idiom
 * as `legal.service.ts` and `plans.service.ts`; `createBackedBillingService`'s
 * header spells out exactly what is real and what is not.
 */
export const billingService: BillingService = backend
  ? createBackedBillingService(backend.billing, createMockBillingService())
  : createMockBillingService();
