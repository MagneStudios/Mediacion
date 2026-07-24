import type { EstadoCaso } from '../types/case';
import type { MediatorEligibility, MockMediation } from '../types/mediator';

/**
 * Single source of truth for what a case's mediator-accompaniment state
 * allows — consumed by both the UI (to show/hide the request action) and
 * mediator.service.ts (to enforce independently of UI gating). Mirrors
 * utils/negotiation-eligibility.ts's role. Depends only on case-level
 * estado, the current negotiation round number, and the (optional) mock
 * mediation record — never on private position data, message content, or
 * simulated party behavior.
 */
export function getMediatorEligibility(
  estado: EstadoCaso,
  currentRoundNumber: number | null,
  mediation: MockMediation | null,
): MediatorEligibility {
  if (mediation) {
    switch (mediation.estado) {
      case 'solicitada':
        return 'pending';
      case 'aceptada':
      case 'activa':
        return 'assigned';
      case 'rechazada':
        return 'unavailable';
      case 'finalizada':
        return 'read_only';
      default:
        return 'read_only';
    }
  }

  if (estado === 'acordado' || estado === 'cerrado' || estado === 'terminado' || estado === 'vencido') {
    // No mediation record exists — never invent one, never allow a new
    // request once the case is agreed/terminal.
    return 'read_only';
  }

  if (estado === 'activo' || estado === 'en_negociacion') {
    if (currentRoundNumber == null || currentRoundNumber < 3) {
      return 'unavailable_before_round_3';
    }
    return 'available';
  }

  // 'nuevo': no round has started yet, so accompaniment is never available.
  return 'unavailable_before_round_3';
}
