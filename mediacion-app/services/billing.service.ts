import { computeTaxBreakdown } from '../utils/compute-tax-breakdown';
import { generateMockInvoiceId, generateMockPaymentId, generateMockSubscriptionId } from '../utils/mock-id';
import type { MockInvoice, MockPayment, MockSubscription } from '../types/billing';
import { plansService } from './plans.service';
import { createFailureController, delay, rejectAfter } from './mock-utils';

/**
 * R-09 checkout — mock-only, same precedent as `plans.service.ts` and
 * `mediator.service.ts`: `apps/api` has no `suscripciones`/`pagos`/
 * `facturas` write endpoints yet (only `GET /planes` exists), so this stays
 * entirely frontend-mocked until a real backend integration phase.
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
};

/** In-memory only — cleared on app restart, never written to disk. */
let currentSubscription: MockSubscription | null = null;
const invoicesBySubscriptionId: Record<string, MockInvoice> = {};

const failures = createFailureController<'subscribeToPlan' | 'prepareInvoiceDownload'>();

export function __mockForceBillingFailure(operation: 'subscribeToPlan' | 'prepareInvoiceDownload'): void {
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
        estado: 'emitida',
        createdAt: now,
      };

      const committed = await delay({ subscription, invoice }, 900);
      currentSubscription = committed.subscription;
      invoicesBySubscriptionId[committed.subscription.id] = committed.invoice;
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

/** Default instance consumed by the billing feature hooks. */
export const billingService: BillingService = createMockBillingService();
