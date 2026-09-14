import type { LawyerFee, LawyerRequest, LawyerRequestCheckout, LawyerServiceOffer } from '../types/lawyer';

import { createBackedLawyerService } from './api/lawyer.backed-service';
import { backend } from './backend-instance';
import { createFailureController, delay, rejectAfter } from './mock-utils';

/**
 * Escalamiento a abogado (spec de monetización §7).
 *
 * Contra backend real el contrato lo implementa `createBackedLawyerService`
 * sobre `POST/GET /casos/:id/solicitud-abogado` (`apps/api/src/abogado`); el
 * singleton del final elige uno u otro, como `cases.service.ts`. Lo que no
 * tiene contraparte de backend —`scope`/`responseHours` del offer, y el
 * handoff con el número del estudio— se mantiene en su estado honesto (`null`)
 * porque son decisiones del estudio/Administración, no del frontend.
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
  /**
   * Crea (o reusa) la solicitud y devuelve el checkout para pagarla. Contra el
   * mock `checkoutUrl` es `null` y el pago se completa con la afordancia de
   * demo; contra backend real siempre trae la URL de Mercado Pago.
   */
  requestLawyer(casoId: string): Promise<LawyerRequestCheckout>;
  /**
   * Afordancia de demo, sólo front — igual que
   * `casesService.simulateInvitationAcceptance`.
   *
   * En producción **esto no lo dispara nadie desde la app**: el pago se
   * confirma en el webhook de Mercado Pago (§7.4), que es de BE. El backed
   * service lo implementa como un re-read no-op; la UI lo esconde con
   * `isBackendLive`.
   */
  simulatePaymentConfirmation(casoId: string): Promise<LawyerRequest>;
};

/**
 * El precio del spec §7.3, en unidades mínimas. En producción lo congela el
 * backend desde config (`LAWYER_FEE_ARS_MINOR`) al crear la solicitud — acá es
 * el fixture que comparten mock y backed service, y coincide con ese valor.
 *
 * El precio se congela al crear la solicitud: si el usuario paga dos horas
 * después, paga el que vio.
 */
export const lawyerFeeFixture: LawyerFee = { currency: 'ARS', amountMinor: 5_000_000 };

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
          fee: lawyerFeeFixture,
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
        const reused = await delay(existing, 400);
        return { request: reused, checkoutUrl: null };
      }

      requestCounter += 1;
      const created: LawyerRequest = {
        id: `lawreq-${String(requestCounter).padStart(4, '0')}`,
        casoId,
        estado: 'pendiente_pago',
        fee: lawyerFeeFixture,
        createdAt: new Date().toISOString(),
        // Sin pago no hay handoff: el mensaje que se le manda al estudio es
        // de "pago confirmado", y mandarlo antes es avisar de algo que no pasó.
        handoff: null,
      };
      const committed = await delay(created, 700);
      requestsByCase[casoId] = committed;
      // El mock no abre Mercado Pago: el pago se completa con la afordancia de
      // demo (`simulatePaymentConfirmation`), no con un checkout real.
      return { request: committed, checkoutUrl: null };
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
 * Default instance. Con backend configurado usa el cliente real; sin él, el
 * mock. El mismo patrón que `cases.service.ts`.
 */
export const lawyerService: LawyerService = backend
  ? createBackedLawyerService(backend.lawyer)
  : createMockLawyerService();
