import { mockCaseDetails } from '../mocks/cases';
import { buildMockMediatorProfile } from '../mocks/mediator';
import type { MediatorActivityEventKey, MediatorActivityItem, MediatorState, MockMediation } from '../types/mediator';
import type { NegotiationState } from '../types/negotiation';
import { generateMockMediationId, generateMockMediatorEventId } from '../utils/mock-id';
import { getMediatorEligibility } from '../utils/mediator-eligibility';
import { resolveMediatorAssignment } from '../utils/mediator-assignment';
import { appendMediatorActivity } from './activity.service';
import { createBackedMediatorService } from './api/mediator.backed-service';
import { backend } from './backend-instance';
import { casesService } from './cases.service';
import { createFailureController, delay, rejectAfter } from './mock-utils';
import { negotiationService } from './negotiation.service';
import { appendMediatorNotice } from './notices.service';

/**
 * Replaceable service boundary for the mocked mediator-accompaniment
 * feature (phase 8).
 *
 * PRIVACY BOUNDARY: this file never imports positionsService or any
 * PositionItem field. Round-3 eligibility comes only from
 * negotiationService.getNegotiationState()'s already-sanitized
 * currentRound.number — never from private position data, message content,
 * simulated party behavior, or AI reasoning. This file never mutates
 * negotiation rounds or case state (only reads negotiationService and
 * mockCaseDetails), and never logs a request or profile payload.
 *
 * BACKEND ALIGNMENT: mirrors `mediaciones` (caso_id, mediador_id, estado,
 * ronda, fecha_solicitud, fecha_aceptacion) — see types/mediator.ts. There
 * is no write RLS policy for that table in the real schema at all, so this
 * stays fully mocked. `estado_mediacion` has no `cancelada` value and the
 * backend defines no cancellation workflow, so this phase never mutates a
 * committed mediation record after creation — there is no
 * cancelMediatorRequest here.
 */
export type MediatorService = {
  getMediatorState(caseId: string): Promise<MediatorState | null>;
  requestMediator(caseId: string): Promise<MediatorState>;
  getMediatorActivity(caseId: string): Promise<MediatorActivityItem[]>;
};

/** In-memory only — cleared on app restart, never written to disk, never logged. At most one mediation record per case (duplicate requests are rejected). */
const mockMediations: Record<string, MockMediation> = {};

/** In-memory only. Case-scoped milestone feed backing getMediatorActivity() — distinct from the app-wide Actividad timeline (see appendMediatorActivity in activity.service.ts for the 3-key subset also mirrored there). */
const mockMediatorMilestones: Record<string, MediatorActivityItem[]> = {};

const failures = createFailureController<'requestMediator'>();

export function __mockForceMediatorFailure(operation: 'requestMediator'): void {
  failures.force(operation);
}

function appendMilestone(caseId: string, eventKey: MediatorActivityEventKey): void {
  const list = mockMediatorMilestones[caseId] ?? (mockMediatorMilestones[caseId] = []);
  list.push({ id: generateMockMediatorEventId(), caseId, eventKey, createdAt: new Date().toISOString() });
}

function buildMediatorState(caseId: string, mediation: MockMediation | null, negotiationState: NegotiationState): MediatorState {
  const detail = mockCaseDetails[caseId];
  const roundNumber = negotiationState.currentRound?.number ?? null;
  const eligibility = getMediatorEligibility(detail?.estado ?? 'nuevo', roundNumber, mediation);
  const canRequest = eligibility === 'available';

  return {
    caseId,
    eligibility,
    mediation,
    mediator: mediation && (mediation.estado === 'aceptada' || mediation.estado === 'activa') ? buildMockMediatorProfile() : undefined,
    canRequest,
    readOnly: !canRequest,
  };
}

export function createMockMediatorService(): MediatorService {
  return {
    async getMediatorState(caseId) {
      const detail = mockCaseDetails[caseId];
      if (!detail) return null;

      const negotiationState = await negotiationService.getNegotiationState(caseId);
      return buildMediatorState(caseId, mockMediations[caseId] ?? null, negotiationState);
    },

    async requestMediator(caseId) {
      if (failures.consume('requestMediator')) {
        return rejectAfter('mediator_request_failed', 700);
      }

      const detail = mockCaseDetails[caseId];
      if (!detail) return rejectAfter('mediator_case_not_found', 300);

      const negotiationState = await negotiationService.getNegotiationState(caseId);
      const roundNumber = negotiationState.currentRound?.number ?? null;
      const existing = mockMediations[caseId] ?? null;
      const eligibility = getMediatorEligibility(detail.estado, roundNumber, existing);

      // Single eligibility gate — the same function the UI uses — rejects
      // all of: case not in an active negotiation state, round < 3, an
      // already-existing mediation (pending/assigned/unavailable/finalizada
      // all fail 'available'), and any agreed/terminal case.
      if (eligibility !== 'available' || roundNumber == null) {
        return rejectAfter('mediator_not_eligible', 300);
      }

      // Calculate the complete final next state before the single commit —
      // the deterministic outcome is resolved now, only after every
      // rejection path above has already been ruled out, and applied
      // directly into the one record that gets committed. A pending
      // outcome commits 'solicitada' as-is; an 'aceptada'/'rechazada'
      // outcome is decided and written in this same mutation, never as a
      // follow-up update to an already-committed 'solicitada' record.
      const outcome = resolveMediatorAssignment(caseId);
      const requestedAt = new Date().toISOString();
      const mediation: MockMediation = {
        id: generateMockMediationId(),
        caseId,
        estado: outcome,
        ronda: roundNumber,
        requestedAt,
        acceptedAt: outcome === 'aceptada' ? requestedAt : undefined,
      };

      const committed = await delay(mediation, 900);
      // Only written after the mock "request" resolves — a forced failure
      // above never leaves a partial mediation record behind.
      mockMediations[caseId] = committed;

      appendMilestone(caseId, 'request_submitted');
      if (outcome === 'aceptada') {
        appendMilestone(caseId, 'mediator_assigned');
      } else if (outcome === 'solicitada') {
        appendMilestone(caseId, 'request_pending');
      } else {
        appendMilestone(caseId, 'request_unavailable');
      }

      // Best-effort side effects only, strictly after the commit above —
      // a notice/activity failure here never rolls back the already-
      // committed mediation record. Deterministic dedup keys (caseId +
      // eventKey) inside each narrow append function make a retried call
      // idempotent, so this can never create duplicate side effects.
      try {
        await appendMediatorNotice({ caseId, eventKey: 'mediator_request_submitted' });
        if (outcome === 'aceptada') {
          await appendMediatorNotice({ caseId, eventKey: 'mediator_assigned' });
        } else if (outcome === 'solicitada') {
          await appendMediatorNotice({ caseId, eventKey: 'mediator_request_pending' });
        } else {
          await appendMediatorNotice({ caseId, eventKey: 'mediator_unavailable' });
        }
      } catch {
        // Best-effort mock side effect — never surfaced, never rolled back.
      }
      try {
        await appendMediatorActivity({ caseId, eventKey: 'mediator_requested' });
        if (outcome === 'aceptada') {
          await appendMediatorActivity({ caseId, eventKey: 'mediator_assigned' });
        }
        // 'accompaniment_started' is only ever appended if estado
        // transitions to 'activa' — no path in this phase does that.
      } catch {
        // Best-effort mock side effect — never surfaced, never rolled back.
      }

      return buildMediatorState(caseId, committed, negotiationState);
    },

    async getMediatorActivity(caseId) {
      const detail = mockCaseDetails[caseId];
      if (!detail) return delay([], 200);

      const items = [...(mockMediatorMilestones[caseId] ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return delay(items, 400);
    },
  };
}

/** Default instance consumed by the feature hooks — the single place to swap in a real API-backed implementation later. */
export const mediatorService: MediatorService = backend
  ? createBackedMediatorService(backend.mediator, {
      getCaseEstado: async (caseId) => {
        const detail = await casesService.getCaseDetail(caseId);
        return detail?.estado ?? null;
      },
      getCurrentRoundNumber: async (caseId) => {
        const state = await negotiationService.getNegotiationState(caseId);
        return state.currentRound?.number ?? null;
      },
      // The profile has no backend counterpart — no mediator-profile table
      // exists — so it stays demo content on both paths rather than being
      // fabricated from the mediador's real name.
      buildProfile: () => buildMockMediatorProfile(),
    })
  : createMockMediatorService();
