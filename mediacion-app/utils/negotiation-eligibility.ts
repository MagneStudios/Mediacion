import type { EstadoCaso } from '../types/case';
import type { NegotiationEligibility, NegotiationRound, SharedProposal } from '../types/negotiation';

/**
 * Single source of truth for what a case's negotiation state allows —
 * consumed by both the UI (to show/hide actions) and negotiation.service.ts
 * (to enforce independently of UI gating). Mirrors utils/position-eligibility.ts's role for the positions feature.
 */
export function getNegotiationEligibility(
  estado: EstadoCaso,
  ownPositionCount: number,
  counterpartyReady: boolean,
  currentRound: NegotiationRound | null,
  currentProposal: SharedProposal | null,
): NegotiationEligibility {
  if (estado === 'nuevo') return 'waiting_counterparty';

  if (estado === 'activo' || estado === 'en_negociacion') {
    if (ownPositionCount === 0) return 'positions_incomplete';
    if (!counterpartyReady) return 'waiting_other_party';
    if (currentRound?.estado === 'activa' && currentProposal?.estado === 'pendiente') {
      return 'in_progress';
    }
    return 'ready';
  }

  // 'acordado' and any other terminal/unknown state (cerrado, terminado,
  // vencido) share the same answer: read-only. This is the same fallback
  // utils/position-eligibility.ts uses, for the same reason — the product
  // hasn't defined bespoke rules for those states, so we never guess.
  return 'read_only';
}
