/**
 * Domain types for the mocked mediator-accompaniment feature (phase 8).
 *
 * BACKEND ALIGNMENT: `mediaciones` is a real, unbuilt backend table —
 * `id, caso_id, mediador_id, estado estado_mediacion, ronda, fecha_solicitud,
 * fecha_aceptacion, created_at, updated_at` (see agents/front/AGENTS.md for
 * the full schema notes). `EstadoMediacion` below mirrors `estado_mediacion`
 * exactly — no persisted value outside those 5 is ever introduced. There is
 * no write RLS policy for `mediaciones` at all in the real schema (only
 * SELECT), so this feature stays 100% frontend-mocked, same as every other
 * phase. There is no `cancelada` value in the backend enum and no
 * cancellation workflow anywhere in the schema, so this phase never mutates
 * a committed mediation record after creation — there is no cancel
 * operation anywhere in this feature.
 *
 * There is also no mediator-profile table on the backend (no bio/language/
 * credential/license/rating columns exist anywhere) — SharedMediatorProfile
 * is entirely frontend-invented, fictional demo content.
 */

/** Matches `mediaciones.estado` exactly. */
export type EstadoMediacion = 'solicitada' | 'aceptada' | 'rechazada' | 'activa' | 'finalizada';

/**
 * "What this party can do right now" — a derived read, never a persisted
 * column. Computed only from case estado, current negotiation round number,
 * and the mediation record (if any) — never from private position data.
 * Mirrors utils/negotiation-eligibility.ts's role for this feature. See
 * utils/mediator-eligibility.ts for the single source of truth that
 * computes this value.
 */
export type MediatorEligibility =
  | 'unavailable_before_round_3'
  | 'available'
  | 'pending'
  | 'assigned'
  | 'unavailable'
  | 'read_only';

/**
 * Stored/fixture-facing shape — mirrors the `mediaciones` row field-for-
 * field. `id` exists only to key/identify the record internally; it is
 * never rendered and never placed in a route param. There is no
 * `mediador_id` field here at all — the assigned mediator's identity is
 * only ever exposed through the sanitized SharedMediatorProfile, never a
 * raw user id.
 */
export type MockMediation = {
  id: string;
  caseId: string;
  estado: EstadoMediacion;
  /** Matches `mediaciones.ronda` — the round number at request time. */
  ronda: number;
  /** Matches `mediaciones.fecha_solicitud`. */
  requestedAt: string;
  /** Matches nullable `mediaciones.fecha_aceptacion` — set only once estado reaches 'aceptada' (or later). */
  acceptedAt?: string;
};

/**
 * Entirely frontend-invented, fictional demo profile — the backend has no
 * mediator-profile table. Never implies a real professional, a verified
 * credential, a license/matrícula, a rating, or an organization. `id` is
 * internal-only: never rendered, never placed in a route param.
 */
export type SharedMediatorProfile = {
  id: string;
  displayName: string;
  roleLabelKey: string;
  summaryKey: string;
  languageCodes: Array<'es' | 'en'>;
};

/**
 * Curated, already-shared-safe milestone vocabulary for this feature's own
 * case-scoped activity list (see mediator.service.ts's dedicated store —
 * distinct from the app-wide Actividad timeline). Only a 3-key subset of
 * this list (`request_submitted`→`mediator_requested`, `mediator_assigned`,
 * `accompaniment_started`) is ever mirrored into the global
 * ActivityEventKey union — see services/activity.service.ts's
 * appendMediatorActivity. `follow_up_expected` is part of the allowed
 * vocabulary but no code path stores it in this phase (no flow produces a
 * "next review" milestone yet) — same documented-gap idiom already used for
 * `con_aviso` elsewhere in this codebase.
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
