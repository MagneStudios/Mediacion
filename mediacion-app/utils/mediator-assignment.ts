import type { EstadoMediacion } from '../types/mediator';

/**
 * Deterministic mock assignment outcome, keyed only by caseId — no
 * randomness, no timers, no dependence on position values, message
 * content, perceived emotions, party behavior, or AI analysis. The round-3
 * gate itself is enforced separately (see utils/mediator-eligibility.ts);
 * this function only decides how a request that has already passed
 * eligibility resolves.
 *
 * Live-reachable only for case-1 in the current seed data: it's the only
 * demo case that can actually reach round ≥ 3 through interactive play
 * (case-2 never advances past round 1, case-3 is already agreed at round
 * 1 — see agents/front/AGENTS.md). case-2's mapping and the default branch
 * are implemented and enforced but code-review-only, mirroring the same
 * documented-gap pattern already used for NegotiationEligibility's
 * `waiting_other_party` branch — existing case/round seed data was not
 * altered to force every path to be manually reachable.
 */
const ASSIGNMENT_MATRIX: Record<string, EstadoMediacion> = {
  'case-1': 'aceptada',
  'case-2': 'solicitada',
};
const DEFAULT_ASSIGNMENT: EstadoMediacion = 'rechazada';

export function resolveMediatorAssignment(caseId: string): EstadoMediacion {
  return ASSIGNMENT_MATRIX[caseId] ?? DEFAULT_ASSIGNMENT;
}
