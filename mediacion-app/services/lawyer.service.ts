import type { LawyerRequest, LawyerServiceOffer } from '../types/lawyer';

import { createFailureController, delay, rejectAfter } from './mock-utils';

/**
 * Escalamiento a abogado (spec de monetización §7).
 *
 * **Mock puro, y va a seguir siéndolo un rato.** El endpoint del spec
 * (`POST /casos/:id/solicitud-abogado` → `{ init_point }`) no existe en
 * `apps/api`: DB entregó la tabla `lawyer_requests` en la Fase 1 y dejó
 * escrito que los endpoints son ticket aparte. Cuando exista, se cambia el
 * singleton del final del archivo, como en `legal.service.ts`.
 *
 * La ficha del endpoint **todavía no está congelada** a propósito: el alcance
 * del servicio (decisión #1, Solmi) cambia qué campos necesita la pantalla, y
 * congelar un shape antes de saberlo es cómo se arma un contrato que hay que
 * renegociar. Está anotado en `docs/plan-frontend-monetizacion.md` §4.4.
 */
export type LawyerService = {
  /** Qué se ofrece y a qué precio. Lo lee el modal antes de dejar contratar. */
  getOffer(): Promise<LawyerServiceOffer>;
  /**
   * La solicitud vigente de un caso, si la hay.
   *
   * Existe para el riesgo de doble cobro del spec §7.6: ante un segundo
   * intento sobre el mismo caso hay que **reusar la solicitud
   * `pendiente_pago`** en vez de crear otra.
   */
  getRequest(casoId: string): Promise<LawyerRequest | null>;
  requestLawyer(casoId: string): Promise<LawyerRequest>;
  /**
   * Afordancia de demo, sólo front — igual que
   * `casesService.simulateInvitationAcceptance`.
   *
   * En producción **esto no lo dispara nadie desde la app**: el pago se
   * confirma en el webhook de Mercado Pago (§7.4), que es de BE. Acá existe
   * únicamente para poder llegar a la pantalla de handoff sin checkout, que
   * tampoco está construido. Cuando el webhook exista, este método se cae con
   * el resto del mock.
   */
  simulatePaymentConfirmation(casoId: string): Promise<LawyerRequest>;
};

/**
 * El precio del spec §7.3, en unidades mínimas. En producción viene de config
 * (`LAWYER_FEE_ARS_MINOR`), nunca hardcodeado — acá es el fixture del mock.
 *
 * El precio se congela al crear la solicitud: si el usuario paga dos horas
 * después, paga el que vio.
 */
const mockFee = { currency: 'ARS' as const, amountMinor: 5_000_000 };

/**
 * El número del estudio, que **todavía no llegó** (respuestas del cliente del
 * 01/09: pidieron el handoff, no pasaron el número). `null` es el estado real,
 * y la pantalla lo muestra como bloqueo.
 *
 * Cuando llegue, entra por `EXPO_PUBLIC_ESTUDIO_WHATSAPP` o —mejor— en el
 * payload que devuelva BE. Acá se deja explícito para que se vea que falta un
 * dato, no que falte código.
 */
const mockEstudioWhatsapp: string | null = null;

const failures = createFailureController<'requestLawyer' | 'simulatePaymentConfirmation'>();

export function __mockForceLawyerFailure(
  operation: 'requestLawyer' | 'simulatePaymentConfirmation',
): void {
  failures.force(operation);
}

/** In-memory only — cleared on app restart, never written to disk. */
let requestsByCase: Record<string, LawyerRequest> = {};

/** Test-only: back to "no requests". Never imported by a screen. */
export function __resetMockLawyerRequests(): void {
  requestsByCase = {};
}

let requestCounter = 0;

export function createMockLawyerService(): LawyerService {
  return {
    async getOffer() {
      return delay(
        {
          fee: mockFee,
          // Null, no un texto de relleno. Ver `types/lawyer.ts`: el alcance lo
          // debe Solmi y el spec lo marca como bloqueante para publicar. Un
          // placeholder convincente acá es exactamente cómo se termina
          // cobrando por algo que nadie definió.
          scope: null,
          responseHours: null,
        },
        300,
      );
    },

    async getRequest(casoId) {
      return delay(requestsByCase[casoId] ?? null, 300);
    },

    async requestLawyer(casoId) {
      if (failures.consume('requestLawyer')) {
        return rejectAfter('mock_lawyer_request_failed', 600);
      }
      // Reusar la solicitud pendiente de pago del mismo caso es la mitad de la
      // defensa contra el doble cobro (spec §7.6); la otra mitad es el índice
      // único sobre `external_reference`, que es de la base.
      const existing = requestsByCase[casoId];
      if (existing && existing.estado === 'pendiente_pago') {
        return delay(existing, 400);
      }

      requestCounter += 1;
      const created: LawyerRequest = {
        id: `lawreq-${String(requestCounter).padStart(4, '0')}`,
        casoId,
        estado: 'pendiente_pago',
        fee: mockFee,
        createdAt: new Date().toISOString(),
        // Sin pago no hay handoff: el mensaje que se le manda al estudio es
        // de "pago confirmado", y mandarlo antes es avisar de algo que no pasó.
        handoff: null,
      };
      const committed = await delay(created, 700);
      requestsByCase[casoId] = committed;
      return committed;
    },

    async simulatePaymentConfirmation(casoId) {
      if (failures.consume('simulatePaymentConfirmation')) {
        return rejectAfter('mock_lawyer_payment_confirmation_failed', 600);
      }
      const existing = requestsByCase[casoId];
      if (!existing) {
        return rejectAfter('mock_lawyer_request_not_found', 300);
      }
      const paid: LawyerRequest = {
        ...existing,
        estado: 'pagada',
        handoff: { estudioWhatsapp: mockEstudioWhatsapp, codigo: existing.id },
      };
      const committed = await delay(paid, 600);
      requestsByCase[casoId] = committed;
      return committed;
    },
  };
}

/**
 * Default instance. Sin variante backed todavía: no hay endpoint que consumir,
 * y escribir el cliente contra un shape que aún no está acordado sería
 * adelantarse al contrato.
 */
export const lawyerService: LawyerService = createMockLawyerService();
