import type {
  CaseDetail,
  CaseInvitation,
  CaseSummary,
  CreateCaseInput,
  CreateInvitationInput,
  PagoACargo,
} from '@/types/case';

import { codeCasoNotFound, codeNotFound, hasCode } from './api-error';
import {
  toCaseDetail,
  toCaseSummary,
  type ApiCaseDetail,
  type ApiCaseSummary,
} from './case-mapper';
import type { HttpClient } from './http-client';

type ApiInvitation = {
  id: string;
  tipo: CaseInvitation['tipo'];
  token: string | null;
  estado: CaseInvitation['estado'];
};

/**
 * `InvitacionView` of `GET /casos/:id/invitaciones` — richer than what the
 * POST answers with, and the reason this app can finally re-show a code after
 * a reload instead of only within the session that created it.
 *
 * `pago_a_cargo` viaja de verdad desde el 10/09 (antes no estaba en el
 * select y esta app lo completaba con un merge de sesión — ver el historial
 * de `cases.backed-service.ts`). `fecha_envio` sigue sin mapearse a
 * propósito: nada lo renderiza, y un campo que llega al dominio sin
 * consumidor sólo invita a que alguien confíe en él.
 */
type ApiInvitationView = ApiInvitation & {
  caso_id: string;
  email_destino: string | null;
  fecha_envio: string | null;
  created_at: string;
  pago_a_cargo: PagoACargo | null;
};

function toInvitation(row: ApiInvitationView): CaseInvitation {
  return {
    id: row.id,
    caseId: row.caso_id,
    tipo: row.tipo,
    token: row.token,
    emailDestino: row.email_destino,
    estado: row.estado,
    pagoACargo: row.pago_a_cargo,
    createdAt: row.created_at,
  };
}

export type ApiCasesService = {
  listCases(): Promise<CaseSummary[]>;
  getCaseDetail(caseId: string): Promise<CaseDetail | undefined>;
  createCase(input: CreateCaseInput): Promise<CaseSummary>;
  createInvitation(input: CreateInvitationInput): Promise<CaseInvitation>;
  listInvitations(caseId: string): Promise<CaseInvitation[]>;
  getCaseTitle(caseId: string): Promise<string | null>;
  joinCase(token: string): Promise<{ id: string; estado: string; requiresPayment: boolean }>;
  setCaseDeadline(caseId: string, plazo: string): Promise<void>;
  terminateCase(caseId: string): Promise<void>;
};

/** A caso the caller cannot see and a caso that does not exist are the same 404. */
function isMissing(error: unknown): boolean {
  return hasCode(error, codeCasoNotFound) || hasCode(error, codeNotFound);
}

export function createApiCasesService(
  http: HttpClient,
  clock: () => Date = () => new Date(),
): ApiCasesService {
  async function fetchDetail(caseId: string): Promise<CaseDetail | undefined> {
    try {
      const row = await http.request<ApiCaseDetail>(`/casos/${caseId}`);
      return toCaseDetail(row, clock());
    } catch (error) {
      if (isMissing(error)) {
        return undefined;
      }
      throw error;
    }
  }

  return {
    async listCases(): Promise<CaseSummary[]> {
      const rows = await http.request<ApiCaseSummary[]>('/casos');
      const now = clock();
      return rows.map((row) => toCaseSummary(row, now));
    },

    getCaseDetail: fetchDetail,

    /**
     * POST /casos answers with only `{id, estado}`, so the freshly created case
     * is read back to get the shape the list renders — rather than guessing at
     * server-assigned fields.
     */
    async createCase(input: CreateCaseInput): Promise<CaseSummary> {
      const created = await http.request<{ id: string }>('/casos', {
        method: 'POST',
        body: {
          nombre: input.nombre,
          descripcion: input.descripcion ?? null,
          metodo: input.metodo,
        },
      });
      const detail = await fetchDetail(created.id);
      if (detail === undefined) {
        throw new Error(`Caso ${created.id} was not readable right after creation`);
      }
      return detail;
    },

    async createInvitation(input: CreateInvitationInput): Promise<CaseInvitation> {
      const created = await http.request<ApiInvitation>(
        `/casos/${input.casoId}/invitaciones`,
        {
          method: 'POST',
          body: {
            tipo: input.tipo,
            ...(input.emailDestino ? { email_destino: input.emailDestino } : {}),
            // Punto #6 (AJUSTES-PACTUM-2026-09-10): el frontend ya no ofrece
            // elegir quién paga — se manda solo si vino definido (nunca
            // desde la UI actual), en vez de forzar un valor.
            ...(input.pagoACargo ? { pago_a_cargo: input.pagoACargo } : {}),
          },
        },
      );
      // The POST answers with only `{id, tipo, token, estado}`, so caseId and
      // createdAt are completed locally from what we already know — pagoACargo
      // included, since it is exactly what we just sent, and it is the one
      // field the read endpoint cannot give back.
      return {
        id: created.id,
        caseId: input.casoId,
        tipo: created.tipo,
        token: created.token,
        emailDestino: input.emailDestino ?? null,
        estado: created.estado,
        pagoACargo: input.pagoACargo ?? null,
        createdAt: clock().toISOString(),
      };
    },

    /**
     * Every invitation of the caso, newest first. Ordering is applied here
     * rather than trusted from the server: the repository does sort by
     * `created_at desc` today, but no ficha promises it, and the field that
     * decides which code a user is shown should not depend on an undocumented
     * implementation detail. `created_at` travels in the payload, so sorting
     * costs nothing.
     */
    async listInvitations(caseId: string): Promise<CaseInvitation[]> {
      const rows = await http.request<ApiInvitationView[]>(
        `/casos/${caseId}/invitaciones`,
      );
      return rows
        .map(toInvitation)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async getCaseTitle(caseId: string): Promise<string | null> {
      const detail = await fetchDetail(caseId);
      return detail?.title ?? null;
    },

    /**
     * RN-10, `PATCH /casos/:id/plazo`. El servidor exige un ISO **estrictamente
     * futuro** (`casos.service.ts:69-84`); los presets de
     * `utils/case-actions.ts` siempre lo son.
     *
     * Devuelve `{ id, plazo, semaforo }`, que no es un `CaseDetail`. No se mapea
     * a dominio a propósito: `slaHours` y `visualStatus` los deriva
     * `case-mapper` a partir del caso completo, y tener una segunda derivación
     * acá sería tener dos fuentes para el mismo número. Quien lo llama recarga.
     */
    async setCaseDeadline(caseId: string, plazo: string): Promise<void> {
      await http.request(`/casos/${caseId}/plazo`, {
        method: 'PATCH',
        body: { plazo },
      });
    },

    /**
     * RN-08, `PATCH /casos/:id/estado`. El único valor que el servidor acepta es
     * `terminado` (`casos.service.ts:39-49`), así que no viaja como parámetro:
     * un argumento sugeriría que esta ruta puede escribir otros estados.
     */
    async terminateCase(caseId: string): Promise<void> {
      await http.request(`/casos/${caseId}/estado`, {
        method: 'PATCH',
        body: { estado: 'terminado' },
      });
    },

    joinCase(token: string): Promise<{ id: string; estado: string; requiresPayment: boolean }> {
      // R-07: `requiresPayment` is an unchecked cast like every other field
      // here — if the backend's `POST /casos/unirse` doesn't send it yet,
      // this resolves to `undefined`, which the join screen already treats
      // as falsy (no payment gate), a silent no-op rather than a crash.
      return http.request('/casos/unirse', { method: 'POST', body: { token } });
    },
  };
}
