import type { ActivityItem } from '../types/activity';

/**
 * Deterministic, immutable shared-activity fixtures — sanitized shared
 * process facts only. Timestamps mirror the already-fixed historical data
 * seeded in mocks/negotiation.ts / mocks/agreements.ts, kept here as
 * independent parallel constants (not reads) per the "seed phase-7
 * independently" strategy. Never imports positionsService or PositionItem,
 * and never includes private-position readiness — that's a personal
 * notice only (see mocks/notices.ts).
 */
export function buildInitialActivity(): ActivityItem[] {
  return [
    // case-1 — Custodia compartida
    { id: 'activity-case-1-created', eventKey: 'case_created', createdAt: '2026-06-01T09:00:00.000Z', caseId: 'case-1', destination: { type: 'case', caseId: 'case-1' } },
    { id: 'activity-case-1-invitation-sent', eventKey: 'invitation_sent', createdAt: '2026-06-01T09:05:00.000Z', caseId: 'case-1', destination: { type: 'case', caseId: 'case-1' } },
    { id: 'activity-case-1-invitation-accepted', eventKey: 'invitation_accepted', createdAt: '2026-06-05T10:00:00.000Z', caseId: 'case-1', destination: { type: 'case', caseId: 'case-1' } },
    { id: 'activity-case-1-negotiation-started', eventKey: 'negotiation_started', createdAt: '2026-06-10T14:00:00.000Z', caseId: 'case-1', destination: { type: 'negotiation', caseId: 'case-1' } },
    { id: 'activity-case-1-proposal-ready-1', eventKey: 'proposal_ready', createdAt: '2026-06-10T14:05:00.000Z', caseId: 'case-1', destination: { type: 'negotiation', caseId: 'case-1' }, params: { number: 1 } },
    { id: 'activity-case-1-own-response-1', eventKey: 'own_response_registered', createdAt: '2026-06-17T09:00:00.000Z', caseId: 'case-1', destination: { type: 'negotiation', caseId: 'case-1' } },
    { id: 'activity-case-1-round-completed-1', eventKey: 'round_completed', createdAt: '2026-06-17T09:30:00.000Z', caseId: 'case-1', destination: { type: 'negotiation', caseId: 'case-1' }, params: { number: 1 } },

    // case-2 — Reparto de bienes
    { id: 'activity-case-2-created', eventKey: 'case_created', createdAt: '2026-06-25T09:00:00.000Z', caseId: 'case-2', destination: { type: 'case', caseId: 'case-2' } },
    { id: 'activity-case-2-invitation-sent', eventKey: 'invitation_sent', createdAt: '2026-06-25T09:05:00.000Z', caseId: 'case-2', destination: { type: 'case', caseId: 'case-2' } },
    { id: 'activity-case-2-invitation-accepted', eventKey: 'invitation_accepted', createdAt: '2026-06-28T12:00:00.000Z', caseId: 'case-2', destination: { type: 'case', caseId: 'case-2' } },
    { id: 'activity-case-2-negotiation-started', eventKey: 'negotiation_started', createdAt: '2026-07-01T11:00:00.000Z', caseId: 'case-2', destination: { type: 'negotiation', caseId: 'case-2' } },
    { id: 'activity-case-2-proposal-ready-1', eventKey: 'proposal_ready', createdAt: '2026-07-01T11:05:00.000Z', caseId: 'case-2', destination: { type: 'negotiation', caseId: 'case-2' }, params: { number: 1 } },

    // case-3 — Pensión de alimentos (already fully resolved)
    { id: 'activity-case-3-created', eventKey: 'case_created', createdAt: '2026-05-10T09:00:00.000Z', caseId: 'case-3', destination: { type: 'case', caseId: 'case-3' } },
    { id: 'activity-case-3-invitation-sent', eventKey: 'invitation_sent', createdAt: '2026-05-10T09:05:00.000Z', caseId: 'case-3', destination: { type: 'case', caseId: 'case-3' } },
    { id: 'activity-case-3-invitation-accepted', eventKey: 'invitation_accepted', createdAt: '2026-05-14T10:00:00.000Z', caseId: 'case-3', destination: { type: 'case', caseId: 'case-3' } },
    { id: 'activity-case-3-negotiation-started', eventKey: 'negotiation_started', createdAt: '2026-05-20T10:00:00.000Z', caseId: 'case-3', destination: { type: 'negotiation', caseId: 'case-3' } },
    { id: 'activity-case-3-proposal-ready-1', eventKey: 'proposal_ready', createdAt: '2026-05-20T10:05:00.000Z', caseId: 'case-3', destination: { type: 'negotiation', caseId: 'case-3' }, params: { number: 1 } },
    { id: 'activity-case-3-own-response-1', eventKey: 'own_response_registered', createdAt: '2026-05-28T16:30:00.000Z', caseId: 'case-3', destination: { type: 'negotiation', caseId: 'case-3' } },
    { id: 'activity-case-3-round-completed-1', eventKey: 'round_completed', createdAt: '2026-05-28T16:45:00.000Z', caseId: 'case-3', destination: { type: 'negotiation', caseId: 'case-3' }, params: { number: 1 } },
    { id: 'activity-case-3-agreement-reached', eventKey: 'agreement_reached', createdAt: '2026-05-28T17:00:00.000Z', caseId: 'case-3', destination: { type: 'agreement', caseId: 'case-3' } },
    { id: 'activity-case-3-signature-ready', eventKey: 'signature_ready', createdAt: '2026-05-28T17:10:00.000Z', caseId: 'case-3', destination: { type: 'signature', caseId: 'case-3' } },
    { id: 'activity-case-3-own-signature', eventKey: 'own_mock_signature_registered', createdAt: '2026-05-28T18:00:00.000Z', caseId: 'case-3', destination: { type: 'agreement', caseId: 'case-3' } },
    { id: 'activity-case-3-process-completed', eventKey: 'process_completed', createdAt: '2026-05-29T12:00:00.000Z', caseId: 'case-3', destination: { type: 'case', caseId: 'case-3' } },
  ];
}
