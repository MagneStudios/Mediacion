import type { EstadoSuscripcion, MockSubscription } from '@/types/billing';

import type { HttpClient } from './http-client';

/**
 * The two billing reads/writes that exist on the real API today:
 * `GET /suscripciones/vigente` (`docs/fichas-legal-backend.md` §10) and
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

/** BE's `SuscripcionCancelada` — the baja answers with less than the read does. */
export type ApiSuscripcionCancelada = {
  id: string;
  estado: EstadoSuscripcion;
  fecha_fin: string | null;
};

export type ApiBillingService = {
  getCurrentSubscription(): Promise<MockSubscription>;
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

    async cancelSubscription(id) {
      // No body: there is nothing for the client to decide about a baja.
      return http.request<ApiSuscripcionCancelada>(`/suscripciones/${id}/baja`, {
        method: 'POST',
      });
    },
  };
}
