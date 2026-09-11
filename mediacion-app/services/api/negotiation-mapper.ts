import type {
  EstadoNegociacion,
  EstadoPropuesta,
  EstadoRonda,
  MateriaAcuerdo,
  MeetingPointEntry,
  Negotiation,
  NegotiationAgreementRef,
  NegotiationRound,
  RoundHistoryItem,
  SharedProposal,
} from '@/types/negotiation';
import type { EstadoAcuerdo } from '@/types/agreement';
import type { MetodoCaso } from '@/types/case';

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
  /** Ahora viaja de verdad (10/09) — ver `propuestaViewColumns` del lado de Backend. */
  negociacion_id: string;
};

/**
 * `NegociacionView` — `GET /casos/:casoId/negociaciones`. Three fields are
 * aliased server-side to the names the rest of the wire already uses:
 * `subject_type` ← `materia`, `metodo` ← `method`, `ronda_actual` ← `round`.
 */
export type ApiNegociacion = {
  id: string;
  caso_id: string;
  subject_type: MateriaAcuerdo | null;
  metodo: MetodoCaso;
  estado: EstadoNegociacion;
  ronda_actual: number;
  acuerdo_vigente: { id: string; estado: EstadoAcuerdo; version: number } | null;
  created_at: string;
};

/** `RenegociacionView` — `POST /negociaciones/:id/renegociar`. Only the two ids; everything else is re-read. */
export type ApiRenegociacion = {
  negotiation_id: string;
  agreement_id: string;
};

/**
 * Neither nullable is normalized. `subject_type: null` is the legacy model,
 * not `'otro'`; `acuerdo_vigente: null` is "no acuerdo in force", and turning
 * it into an empty object would change which button the card draws.
 */
export function toNegotiation(row: ApiNegociacion): Negotiation {
  const currentAgreement: NegotiationAgreementRef | null =
    row.acuerdo_vigente === null
      ? null
      : { id: row.acuerdo_vigente.id, estado: row.acuerdo_vigente.estado, version: row.acuerdo_vigente.version };
  return {
    id: row.id,
    caseId: row.caso_id,
    subjectType: row.subject_type,
    metodo: row.metodo,
    estado: row.estado,
    roundNumber: row.ronda_actual,
    currentAgreement,
    createdAt: row.created_at,
  };
}

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
    negotiationId: row.negociacion_id,
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
    negotiationId: row.negociacion_id,
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
