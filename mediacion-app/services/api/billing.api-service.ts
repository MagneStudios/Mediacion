import type {
  EstadoSuscripcion,
  MockSubscription,
  SubscriptionUsage,
  UsageCounter,
} from '@/types/billing';

import type { HttpClient } from './http-client';

/**
 * The billing reads/writes that exist on the real API today:
 * `GET /suscripciones/vigente` (`docs/fichas-legal-backend.md` §10),
 * `GET /suscripciones/uso` (§11, added 03/09) and
 * `POST /suscripciones/:id/baja` (§7, the baja online of Ley 24.240 art. 10
 * ter). Wire shapes are snake_case, matching the `suscripciones` columns.
 *
 * There is deliberately nothing here for the checkout: `POST /suscripciones`
 * and `POST /suscripciones/:id/pago` exist, but `pago` answers with a Mercado
 * Pago `init_point` the user has to be sent to, and no factura endpoint exists
 * at all. Wiring them would mean this app inventing an approved payment and an
 * invoice — see `billing.backed-service.ts`.
 */
export type ApiSuscripcion = {
  id: string;
  plan_id: string;
  estado: EstadoSuscripcion;
  /** Nullable on the wire: BE normalizes timestamps and returns null for unusable values. */
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

export function toSubscription(row: ApiSuscripcion): MockSubscription {
  return {
    id: row.id,
    planId: row.plan_id,
    estado: row.estado,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
  };
}

/** BE's `UsoMedidor`. `limite: null` is unlimited, never "zero allowed". */
export type ApiUsoMedidor = {
  usado: number;
  limite: number | null;
};

/**
 * BE's `UsoView` (`apps/api/src/pagos/pagos.types.ts`). `clientes` is `null`
 * for anyone who is not the titular of an estudio.
 */
export type ApiUso = {
  period_start: string;
  period_end: string;
  negociaciones: ApiUsoMedidor;
  clientes: ApiUsoMedidor | null;
};

/**
 * A count only means something if it is a non-negative whole number; a limit
 * additionally accepts `null` for unlimited. Anything else came from a bug on
 * the wire, and "usaste 2.5 de 3" reads as a broken product — so an unusable
 * count degrades to 0 and an unusable limit to `null` (unlimited), which is the
 * direction that never invents a wall the server did not report.
 *
 * Same rule as `utils/quota-limit.ts`'s `readCount`, applied at the other end
 * of the same feature.
 */
function toCounter(row: ApiUsoMedidor): UsageCounter {
  const usable = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0;
  return {
    used: usable(row?.usado) ? row.usado : 0,
    limit: usable(row?.limite) ? row.limite : null,
  };
}

/** Mirrors `readInstant` in `utils/quota-limit.ts`: an unparseable date is no date. */
function toInstant(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

export function toSubscriptionUsage(row: ApiUso): SubscriptionUsage {
  return {
    periodStart: toInstant(row.period_start),
    periodEnd: toInstant(row.period_end),
    negotiations: toCounter(row.negociaciones),
    // `null` travels: it is "you are not an estudio titular", which is not the
    // same as a counter sitting at zero.
    clients: row.clientes === null || row.clientes === undefined ? null : toCounter(row.clientes),
  };
}

/** BE's `SuscripcionCancelada` — the baja answers with less than the read does. */
export type ApiSuscripcionCancelada = {
  id: string;
  estado: EstadoSuscripcion;
  fecha_fin: string | null;
};

/** BE's `SuscripcionCreated` — a subscription starts at `pendiente_pago`. */
export type ApiSuscripcionCreated = {
  id: string;
  estado: EstadoSuscripcion;
};

/**
 * BE's `PreferenceResult`. The `init_point` is Mercado Pago's hosted checkout;
 * it is validated by `utils/checkout-url.ts` before anything opens it.
 */
export type ApiPreference = {
  /**
   * `null` en el único caso sin nada que cobrar: un plan de precio 0, que BE
   * activa sin pasar por Mercado Pago porque rechaza con 400 toda preferencia
   * de monto cero. Ahí viene `estado: 'activa'`, que es lo que distingue "no
   * hay que pagar" de "la preferencia no se pudo armar".
   */
  init_point: string | null;
  estado?: MockSubscription['estado'];
};

export type ApiBillingService = {
  getCurrentSubscription(): Promise<MockSubscription>;
  getUsage(): Promise<SubscriptionUsage>;
  createSubscription(planId: string): Promise<ApiSuscripcionCreated>;
  startPayment(subscriptionId: string): Promise<ApiPreference>;
  cancelSubscription(id: string): Promise<ApiSuscripcionCancelada>;
};

export function createApiBillingService(http: HttpClient): ApiBillingService {
  return {
    async getCurrentSubscription() {
      // No id in the path: the server resolves titularidad from the token,
      // personal first and estudio after, the same criterion the baja uses.
      // A client-supplied owner would be a way to read someone else's plan.
      const row = await http.request<ApiSuscripcion>('/suscripciones/vigente');
      return toSubscription(row);
    },

    async getUsage() {
      // No id and no query, for the same reason as the read above: the server
      // resolves titularidad from the token — personal first, estudio after,
      // and only for its titular. A client-supplied owner would be a way to
      // read someone else's consumption.
      const row = await http.request<ApiUso>('/suscripciones/uso');
      return toSubscriptionUsage(row);
    },

    async createSubscription(planId) {
      // No `estudio_id`: the server resolves titularidad from the token, the
      // same criterion every other route in this file uses. A client-supplied
      // owner would be a way to charge a plan to somebody else's estudio.
      return http.request<ApiSuscripcionCreated>('/suscripciones', {
        method: 'POST',
        body: { plan_id: planId },
      });
    },

    async startPayment(subscriptionId) {
      // No body: the preference is built entirely from the subscription row
      // (plan, precio, moneda), so there is nothing here for the client to
      // decide — and nothing it could inflate or discount.
      return http.request<ApiPreference>(`/suscripciones/${subscriptionId}/pago`, {
        method: 'POST',
      });
    },

    async cancelSubscription(id) {
      // No body: there is nothing for the client to decide about a baja.
      return http.request<ApiSuscripcionCancelada>(`/suscripciones/${id}/baja`, {
        method: 'POST',
      });
    },
  };
}
