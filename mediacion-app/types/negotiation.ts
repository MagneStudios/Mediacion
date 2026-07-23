/**
 * Domain types for the negotiation feature (rounds, shared proposals,
 * responses). Value unions mirror the real Supabase enums exactly —
 * `estado_ronda`, `estado_propuesta`, `decision_propuesta` — rather than the
 * richer status vocabulary a UI might want (e.g. "generating", "awaiting
 * response", "draft"). Those extra concepts are never persisted states on
 * the backend, so they are represented here as local mutation state
 * (idle/generating/error, idle/submitting/error) or as derived booleans on
 * `NegotiationState`, never as invented enum members.
 *
 * This file does not import from packages/db-types or apps/api.
 */

/** Matches `rondas.estado`. */
export type EstadoRonda = 'activa' | 'completada';

/** Matches `propuestas.estado`. */
export type EstadoPropuesta = 'pendiente' | 'aceptada' | 'rechazada';

/** Matches `respuestas_propuesta.decision`. */
export type DecisionPropuesta = 'acepta' | 'rechaza';

/**
 * Product-level "what can this party do right now" state — not a backend
 * column, a derived read used to gate UI and, independently, service writes.
 */
export type NegotiationEligibility =
  | 'waiting_counterparty'
  | 'positions_incomplete'
  | 'waiting_other_party'
  | 'ready'
  | 'in_progress'
  | 'read_only';

export type NegotiationRound = {
  id: string;
  caseId: string;
  /** Matches `rondas.numero` — unique and sequential per case. */
  number: number;
  estado: EstadoRonda;
  proposalId?: string;
  /** Derived: number >= 3. Informational only — no mediator is assigned in phase 4. */
  mediatorAvailable: boolean;
  createdAt: string;
  completedAt?: string;
};

export type SharedProposalTerm = {
  id: string;
  title: string;
  description: string;
};

/**
 * Sanitized shared content only — see services/mocks/negotiation.ts and
 * services/negotiation.service.ts for the privacy boundary this type sits
 * behind. Never constructed from a party's raw position values.
 */
export type SharedProposal = {
  id: string;
  caseId: string;
  roundId: string;
  roundNumber: number;
  title: string;
  summary: string;
  terms: SharedProposalTerm[];
  /** Matches nullable `propuestas.fundamentacion`. */
  rationale?: string;
  estado: EstadoPropuesta;
  createdAt: string;
};

/** The authenticated party's own response only — never the counterparty's. */
export type OwnProposalResponse = {
  proposalId: string;
  decision: DecisionPropuesta;
  createdAt: string;
};

/**
 * UI-facing negotiation snapshot. Exposes only derived shared facts
 * (`waitingForOtherParty`, `bothAccepted`, `roundResolved`) — never the
 * counterparty's raw response object, which the service keeps internal.
 */
export type NegotiationState = {
  caseId: string;
  eligibility: NegotiationEligibility;
  currentRound: NegotiationRound | null;
  currentProposal: SharedProposal | null;
  ownResponse: OwnProposalResponse | null;
  waitingForOtherParty: boolean;
  bothAccepted: boolean;
  roundResolved: boolean;
  mediatorAvailable: boolean;
};

export type RoundHistoryItem = {
  roundId: string;
  roundNumber: number;
  proposalTitle: string;
  proposalSummary: string;
  finalStatus: EstadoPropuesta;
  agreementReached: boolean;
  completedAt?: string;
};
