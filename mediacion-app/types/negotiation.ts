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

/**
 * Whether the engine found an overlap between both parties' ranges for this
 * category (`acordable`) or only a midpoint to keep negotiating from
 * (`negociable`). Mirrors the backend's `MeetingPointEntry`.
 */
export type MeetingPointEstado = 'acordable' | 'negociable';

/**
 * One category of the computed meeting point. `punto` is null when no numeric
 * midpoint could be derived — the category is descriptive ("fines de semana"),
 * not numeric. It is a derived midpoint, never either party's own value.
 */
export type MeetingPointEntry = {
  categoria: string;
  punto: number | null;
  estado: MeetingPointEstado;
};

/**
 * Sanitized shared content only — see services/mocks/negotiation.ts and
 * services/negotiation.service.ts for the privacy boundary this type sits
 * behind. Never constructed from a party's raw position values.
 *
 * Shape mirrors `propuestas.contenido` exactly. There is no title, summary or
 * term list: those were mock inventions with no column and no engine output
 * behind them.
 */
export type SharedProposal = {
  id: string;
  caseId: string;
  roundId: string;
  roundNumber: number;
  meetingPoint: MeetingPointEntry[];
  /**
   * Null while the engine is still generating. `POST /casos/:id/propuestas`
   * returns immediately with a pending row, so the screen must treat null as
   * "in progress", not as "empty".
   */
  narrative: string | null;
  /** Matches nullable `propuestas.fundamentacion`. */
  rationale?: string;
  estado: EstadoPropuesta;
  createdAt: string;
};

/** True while the AI engine has not written the narrative yet. */
export function isProposalPending(proposal: SharedProposal): boolean {
  return proposal.narrative === null;
}

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
  /** First line of the narrative, or null while it is still being generated. */
  proposalSummary: string | null;
  finalStatus: EstadoPropuesta;
  agreementReached: boolean;
  completedAt?: string;
};
