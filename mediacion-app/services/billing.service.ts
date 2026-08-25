import { createBackedBillingService } from './api/billing.backed-service';
import { backend } from './backend-instance';
import { computeTaxBreakdown } from '../utils/compute-tax-breakdown';
import { generateMockInvoiceId, generateMockPaymentId, generateMockSubscriptionId } from '../utils/mock-id';
import type { MockInvoice, MockPayment, MockSubscription } from '../types/billing';
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

/** In-memory only — cleared on app restart, never written to disk. */
let currentSubscription: MockSubscription | null = null;
const invoicesBySubscriptionId: Record<string, MockInvoice> = {};

const failures = createFailureController<'subscribeToPlan' | 'prepareInvoiceDownload' | 'cancelSubscription'>();

export function __mockForceBillingFailure(
  operation: 'subscribeToPlan' | 'prepareInvoiceDownload' | 'cancelSubscription',
): void {
  failures.force(operation);
}

/** Test-only: resets the in-memory store back to its initial (no subscription) state. Never imported by a screen. */
export function __resetMockBilling(): void {
  currentSubscription = null;
  for (const key of Object.keys(invoicesBySubscriptionId)) {
    delete invoicesBySubscriptionId[key];
  }
}

export function createMockBillingService(): BillingService {
  return {
    async getCurrentSubscription() {
      return delay(currentSubscription, 300);
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
