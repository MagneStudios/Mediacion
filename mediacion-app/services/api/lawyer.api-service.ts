import type { EstadoSolicitudAbogado, LawyerRequest } from '@/types/lawyer';

import { codeSolicitudAbogadoNotFound, hasCode } from './api-error';
import type { HttpClient } from './http-client';

/**
 * The frozen `SolicitudAbogadoView` of `GET /casos/:casoId/solicitud-abogado`
 * (`apps/api/src/abogado/abogado.types.ts`). Deliberately without the Mercado
 * Pago identifiers (`mp_preference_id`/`mp_payment_id`) — those are the
 * gateway's business, not the client's, and BE keeps them off the view.
 */
export type ApiSolicitudAbogadoView = {
  id: string;
  caso_id: string;
  status: EstadoSolicitudAbogado;
  moneda: 'ARS' | 'USD';
  monto_minor: number;
  external_reference: string;
  paid_at: string | null;
  created_at: string;
};

/** What `POST /casos/:casoId/solicitud-abogado` returns. */
export type ApiSolicitudAbogadoCheckout = {
  solicitud: ApiSolicitudAbogadoView;
  init_point: string;
};

/**
 * The wire status is passed through untouched: only the three values BE can
 * emit today (`pendiente_pago`, `pagada`, `fallida`) arrive, and the mapper
 * refuses to derive the other four from them (see `types/lawyer.ts`).
 *
 * `handoff` is always `null` here: the backend has no column for the estudio's
 * WhatsApp number yet, and the screen falls back to
 * `EXPO_PUBLIC_ESTUDIO_WHATSAPP` when the payload doesn't carry it — the same
 * honest "blocked until Administración passes the number" state as the mock.
 */
export function toLawyerRequest(row: ApiSolicitudAbogadoView): LawyerRequest {
  return {
    id: row.id,
    casoId: row.caso_id,
    estado: row.status,
    fee: { currency: row.moneda, amountMinor: row.monto_minor },
    createdAt: row.created_at,
    handoff: null,
  };
}

export type ApiLawyerService = {
  /** `404 solicitud_abogado_not_found` → `null`, a calm "no request yet". */
  getRequest(casoId: string): Promise<ApiSolicitudAbogadoView | null>;
  requestLawyer(casoId: string): Promise<ApiSolicitudAbogadoCheckout>;
};

export function createApiLawyerService(http: HttpClient): ApiLawyerService {
  return {
    async getRequest(casoId: string): Promise<ApiSolicitudAbogadoView | null> {
      try {
        return await http.request<ApiSolicitudAbogadoView>(
          `/casos/${casoId}/solicitud-abogado`,
        );
      } catch (error) {
        if (hasCode(error, codeSolicitudAbogadoNotFound)) {
          return null;
        }
        throw error;
      }
    },

    requestLawyer(casoId: string): Promise<ApiSolicitudAbogadoCheckout> {
      return http.request<ApiSolicitudAbogadoCheckout>(
        `/casos/${casoId}/solicitud-abogado`,
        { method: 'POST' },
      );
    },
  };
}
