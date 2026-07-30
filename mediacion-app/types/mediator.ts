/**
 * Domain types for the mediator-accompaniment feature.
 *
 * `SharedMediatorProfile` has no backend counterpart — no mediator-profile
 * table exists — so those fields are demo content, not data.
 */

/** Matches `mediaciones.estado` exactly. */
export type EstadoMediacion = 'solicitada' | 'aceptada' | 'rechazada' | 'activa' | 'finalizada';

/**
 * What this party can do right now — derived, never persisted. Computed from
 * case estado, round number and the mediation record only, never from private
 * position data. See utils/mediator-eligibility.ts.
 */
export type MediatorEligibility =
  | 'unavailable_before_round_3'
  | 'available'
  | 'pending'
  | 'assigned'
  | 'unavailable'
  | 'read_only';

/**
 * Mirrors a `mediaciones` row. Deliberately has no `mediador_id`: the assigned
 * mediator is only ever exposed through SharedMediatorProfile, never as a raw
 * user id. `id` is internal — never rendered, never a route param.
 */
export type MockMediation = {
  id: string;
  caseId: string;
  estado: EstadoMediacion;
  /** The round number at request time. */
  ronda: number;
  requestedAt: string;
  /** Set only once estado reaches 'aceptada' or later. */
  acceptedAt?: string;
};

/**
 * Demo content — no mediator-profile table exists. Must never imply a real
 * professional, a verified credential, a licence or a rating.
 */
export type SharedMediatorProfile = {
  id: string;
  displayName: string;
  roleLabelKey: string;
  summaryKey: string;
  languageCodes: Array<'es' | 'en'>;
};

/**
 * Milestone vocabulary for this feature's own case-scoped activity list, which
 * is separate from the app-wide timeline. Only `request_submitted`,
 * `mediator_assigned` and `accompaniment_started` are mirrored into the global
 * ActivityEventKey union; `follow_up_expected` is allowed but nothing writes it
 * yet.
 */
export type MediatorActivityEventKey =
  | 'request_submitted'
  | 'request_pending'
  | 'mediator_assigned'
  | 'accompaniment_started'
  | 'follow_up_expected'
  | 'request_unavailable';

/** One case-scoped milestone entry — see mediator.service.ts's getMediatorActivity(). */
export type MediatorActivityItem = {
  id: string;
  caseId: string;
  eventKey: MediatorActivityEventKey;
  createdAt: string;
};

/**
 * UI-facing snapshot returned by mediatorService.getMediatorState(). Status
 * lives in exactly one place — `mediation?.estado` (or `mediation === null`
 * for "not requested") — never duplicated into a separate, possibly
 * conflicting status field. `eligibility`, `canRequest`, and `readOnly` are
 * all derived presentation state, computed fresh every read from
 * `mediation` + case/round facts — never stored, never a second source of
 * truth for the same fact.
 */
export type MediatorState = {
  caseId: string;
  eligibility: MediatorEligibility;
  mediation: MockMediation | null;
  /** Present only once `mediation.estado` is 'aceptada' or 'activa'. */
  mediator?: SharedMediatorProfile;
  /** Derived: eligibility === 'available'. */
  canRequest: boolean;
  /** Derived: !canRequest — there is exactly one mutating action in this phase (requestMediator), so "read-only" simply means that action isn't available right now. */
  readOnly: boolean;
};
