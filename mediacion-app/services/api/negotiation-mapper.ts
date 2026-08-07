import type {
  EstadoPropuesta,
  EstadoRonda,
  MeetingPointEntry,
  NegotiationRound,
  RoundHistoryItem,
  SharedProposal,
} from '@/types/negotiation';

/** RN-05: the mediator becomes available from round 3 (negociacion.service.ts). */
const mediatorFromRound = 3;

/** `contenido` mirrors `propuestas.contenido` — see apps/api/src/negociacion/negociacion.types.ts. */
export type ApiPropuestaContenido = {
  meetingPoint: MeetingPointEntry[];
  narrative: string | null;
};

export type ApiPropuestaDetail = {
  id: string;
  caso_id: string;
  ronda_id: string;
  contenido: ApiPropuestaContenido | null;
  fundamentacion: string | null;
  estado: EstadoPropuesta;
  modelo_ia: string | null;
  fecha: string;
  ronda_numero: number;
  ronda_estado: EstadoRonda;
  own_decision: 'acepta' | 'rechaza' | null;
};

/**
 * `POST /casos/:id/propuestas` and `POST /propuestas/:id/responder` answer with
 * the narrower PropuestaView — no round columns, no own_decision.
 */
export type ApiPropuestaView = Omit<
  ApiPropuestaDetail,
  'ronda_numero' | 'ronda_estado' | 'own_decision'
>;

/**
 * `contenido` is written by the AI engine after the row is inserted, so a
 * just-created propuesta legitimately has none. That is "still generating", not
 * "empty": `narrative: null` is what `isProposalPending` keys on.
 */
export function toSharedProposal(
  row: ApiPropuestaView,
  roundNumber: number,
): SharedProposal {
  return {
    id: row.id,
    caseId: row.caso_id,
    roundId: row.ronda_id,
    roundNumber,
    meetingPoint: row.contenido?.meetingPoint ?? [],
    narrative: row.contenido?.narrative ?? null,
    ...(row.fundamentacion === null ? {} : { rationale: row.fundamentacion }),
    estado: row.estado,
    createdAt: row.fecha,
  };
}

/**
 * The round is reconstructed from the columns that travel with each propuesta.
 * There is no `GET /rondas` — the API deliberately ships round number and state
 * alongside the propuesta rather than exposing a separate snapshot endpoint.
 */
export function toNegotiationRound(row: ApiPropuestaDetail): NegotiationRound {
  return {
    id: row.ronda_id,
    caseId: row.caso_id,
    number: row.ronda_numero,
    estado: row.ronda_estado,
    proposalId: row.id,
    mediatorAvailable: row.ronda_numero >= mediatorFromRound,
    createdAt: row.fecha,
  };
}

/** First line only — the history list shows a summary, never the whole narrative. */
export function toProposalSummary(narrative: string | null): string | null {
  if (narrative === null) {
    return null;
  }
  const [firstLine] = narrative.split('\n');
  return firstLine.trim().length === 0 ? null : firstLine.trim();
}

export function toRoundHistoryItem(row: ApiPropuestaDetail): RoundHistoryItem {
  return {
    roundId: row.ronda_id,
    roundNumber: row.ronda_numero,
    proposalSummary: toProposalSummary(row.contenido?.narrative ?? null),
    finalStatus: row.estado,
    agreementReached: row.estado === 'aceptada',
    // `rondas.completed_at` is not part of PropuestaDetail. The propuesta's own
    // fecha is the closest honest timestamp and is left off rather than
    // presented as a completion time it is not.
  };
}
