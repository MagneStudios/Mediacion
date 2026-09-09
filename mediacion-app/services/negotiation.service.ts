import { mockCaseDetails, mockCases } from '../mocks/cases';
import {
  buildInitialProposals,
  buildInitialRounds,
  getProposalFixture,
  isCounterpartyReady,
  simulatedCounterpartyDecision,
} from '../mocks/negotiation';
import type { EstadoCaso } from '../types/case';
import type {
  DecisionPropuesta,
  EstadoNegociacion,
  Negotiation,
  NegotiationRound,
  NegotiationState,
  OwnProposalResponse,
  RoundHistoryItem,
  SharedProposal,
} from '../types/negotiation';
import { generateMockProposalId, generateMockRoundId } from '../utils/mock-id';
import { getNegotiationEligibility } from '../utils/negotiation-eligibility';
import { codeNegociacionNotAcordada } from './api/api-error';
import { createBackedNegotiationService } from './api/negotiation.backed-service';
import { backend } from './backend-instance';
import { casesService } from './cases.service';
import {
  getAgreementForCase,
  getAgreementVersion,
  materializeFromAcceptedProposal,
  supersedeWithDraft,
} from './mock-agreement-store';
import { createFailureController, delay, rejectAfter } from './mock-utils';
import { positionsService } from './positions.service';

/**
 * Replaceable service boundary for negotiation rounds, shared proposals,
 * and the authenticated party's own responses. Scoped deliberately: there
 * is no getAllPositions, getCounterpartyPositions, comparePositions, or any
 * method that reads a raw counterparty response here, and there never
 * should be.
 *
 * PRIVACY BOUNDARY: this service may only check
 * `(await positionsService.getOwnPositions(caseId)).length > 0` to decide
 * whether the authenticated party has entered at least one private
 * position. It never reads `valueMin`, `valueMax`, `concessionConditions`,
 * `description`, `category`, or `canConcede` from any PositionItem, and no
 * PositionItem is ever passed into proposal-fixture selection — selection
 * depends only on caseId + round number (see mocks/negotiation.ts). Real
 * proposal synthesis — reading each party's private ranges/conditions to
 * find a sanitized middle ground — is backend work; this mock only ever
 * returns predetermined sanitized fixture content.
 */
export type NegotiationService = {
  getNegotiationState(caseId: string): Promise<NegotiationState>;
  generateSharedProposal(caseId: string): Promise<SharedProposal>;
  submitOwnProposalResponse(caseId: string, proposalId: string, decision: DecisionPropuesta): Promise<NegotiationState>;
  startNextRound(caseId: string): Promise<NegotiationRound>;
  getRoundHistory(caseId: string): Promise<RoundHistoryItem[]>;
  /**
   * Read-only accessor for the agreement feature (agreements.service.ts).
   * Returns the case's accepted proposal — estado === 'aceptada' — or null.
   * Never returns a stale rejected/pending proposal, never mutates
   * negotiation state, and never exposes internal responses or the
   * simulated counterparty's raw decision.
   */
  getAcceptedProposal(caseId: string): Promise<SharedProposal | null>;
  /**
   * The caso's negociaciones — one per materia — each with its own estado,
   * round and acuerdo in force. `[]` for a caso that has none yet.
   */
  listNegotiations(caseId: string): Promise<Negotiation[]>;
  /**
   * Opens the next round on a materia whose acuerdo in force is signed: the
   * signed acuerdo stops being in force (it is kept), the next draft is
   * created from its content, and the caso goes back to `en_negociacion`.
   * Rejects with `negociacion_not_acordada` otherwise. Only the two ids come
   * back — the caller re-reads the list and the caso.
   */
  renegotiate(negotiationId: string): Promise<{ negotiationId: string; agreementId: string }>;
};

/** In-memory only — cleared on app restart, never written to disk, never logged. */
const mockRounds: NegotiationRound[] = buildInitialRounds();
const mockProposals: SharedProposal[] = buildInitialProposals();
/** Only ever populated by submitOwnProposalResponse — the authenticated party's own decisions, never the counterparty's. */
const mockOwnResponses: OwnProposalResponse[] = [];

const failures = createFailureController<'generateSharedProposal' | 'submitOwnProposalResponse' | 'startNextRound'>();

export function __mockForceNegotiationFailure(
  operation: 'generateSharedProposal' | 'submitOwnProposalResponse' | 'startNextRound',
): void {
  failures.force(operation);
}

function getMostRecentRound(caseId: string): NegotiationRound | null {
  const rounds = mockRounds.filter((round) => round.caseId === caseId).sort((a, b) => b.number - a.number);
  return rounds[0] ?? null;
}

function getProposalById(proposalId: string): SharedProposal | undefined {
  return mockProposals.find((proposal) => proposal.id === proposalId);
}

function getCurrentProposalForRound(round: NegotiationRound | null): SharedProposal | null {
  if (!round?.proposalId) return null;
  return getProposalById(round.proposalId) ?? null;
}

function getOwnResponseForProposal(proposalId: string): OwnProposalResponse | null {
  return mockOwnResponses.find((response) => response.proposalId === proposalId) ?? null;
}

/** The only own-position access in this file: a count, nothing else. See the privacy-boundary note above. */
async function ownPositionCount(caseId: string): Promise<number> {
  const items = await positionsService.getOwnPositions(caseId);
  return items.length;
}

/**
 * El id de la negociación del mock. Es un fixture determinista, como
 * `agreement-case-3-1`: ahora que la API tiene ids reales, un id de fixture
 * es espejo y no invento. **Nunca viaja a un param de ruta** — las rutas de
 * propuestas siguen siendo por caso.
 */
function mockNegotiationId(caseId: string): string {
  return `negotiation-${caseId}`;
}

function caseIdFromMockNegotiationId(negotiationId: string): string | null {
  return negotiationId.startsWith('negotiation-') ? negotiationId.slice('negotiation-'.length) : null;
}

/**
 * El mock tiene una sola negociación por caso —la del modelo viejo, sin
 * materia— así que su estado se deriva del estado del caso. Contra la API
 * real es una columna propia (`negociaciones.estado`) y no se deriva de nada.
 */
function toMockEstadoNegociacion(estado: EstadoCaso): EstadoNegociacion {
  switch (estado) {
    case 'nuevo':
    case 'pendiente_suscripciones':
      return 'borrador';
    case 'activo':
    case 'en_negociacion':
      return 'activa';
    case 'acordado':
      return 'acordada';
    case 'cerrado':
      return 'cerrada';
    case 'terminado':
    case 'vencido':
    case 'expirado':
      return 'terminada';
  }
}

/** The inverse of `markCaseAsAgreed`: a renegociación reopens the caso. */
function markCaseAsRenegotiating(caseId: string): void {
  const detail = mockCaseDetails[caseId];
  if (detail) {
    mockCaseDetails[caseId] = { ...detail, estado: 'en_negociacion', statusLabelKey: 'inReview', visualStatus: 'info' };
  }
  const summaryIndex = mockCases.findIndex((c) => c.id === caseId);
  if (summaryIndex !== -1) {
    mockCases[summaryIndex] = { ...mockCases[summaryIndex], estado: 'en_negociacion', statusLabelKey: 'inReview', visualStatus: 'info' };
  }
}

/** Mutates only estado/statusLabelKey/visualStatus/roundNumber — every other case field (title, counterpartyName, metodo, caseCode, descripcion, slaHours) is preserved. */
function markCaseAsAgreed(caseId: string): void {
  const detail = mockCaseDetails[caseId];
  if (detail) {
    mockCaseDetails[caseId] = { ...detail, estado: 'acordado', statusLabelKey: 'signed', visualStatus: 'success', roundNumber: null };
  }
  const summaryIndex = mockCases.findIndex((c) => c.id === caseId);
  if (summaryIndex !== -1) {
    mockCases[summaryIndex] = {
      ...mockCases[summaryIndex],
      estado: 'acordado',
      statusLabelKey: 'signed',
      visualStatus: 'success',
      roundNumber: null,
    };
  }
}

async function buildNegotiationState(caseId: string): Promise<NegotiationState> {
  const detail = mockCaseDetails[caseId];
  const currentRound = getMostRecentRound(caseId);
  const currentProposal = getCurrentProposalForRound(currentRound);
  const ownResponse = currentProposal ? getOwnResponseForProposal(currentProposal.id) : null;

  const count = detail ? await ownPositionCount(caseId) : 0;
  const counterpartyReady = isCounterpartyReady(caseId);
  const eligibility = detail
    ? getNegotiationEligibility(detail.estado, count, counterpartyReady, currentRound, currentProposal)
    : 'read_only';

  return {
    caseId,
    eligibility,
    currentRound,
    currentProposal,
    ownResponse,
    waitingForOtherParty: Boolean(currentProposal?.estado === 'pendiente' && ownResponse),
    bothAccepted: currentProposal?.estado === 'aceptada',
    roundResolved: currentRound?.estado === 'completada',
    mediatorAvailable: currentRound?.mediatorAvailable ?? false,
  };
}

export function createMockNegotiationService(): NegotiationService {
  return {
    async getNegotiationState(caseId) {
      return buildNegotiationState(caseId);
    },

    async getRoundHistory(caseId) {
      const items: RoundHistoryItem[] = mockRounds
        .filter((round) => round.caseId === caseId && round.estado === 'completada')
        .sort((a, b) => a.number - b.number)
        .map((round) => {
          const proposal = round.proposalId ? getProposalById(round.proposalId) : undefined;
          return {
            roundId: round.id,
            roundNumber: round.number,
            proposalSummary: proposal?.narrative ?? null,
            finalStatus: proposal?.estado ?? 'rechazada',
            agreementReached: proposal?.estado === 'aceptada',
            completedAt: round.completedAt,
          };
        });
      return delay(items, 500);
    },

    async startNextRound(caseId) {
      if (failures.consume('startNextRound')) {
        return rejectAfter('mock_start_round_failed', 500);
      }

      const detail = mockCaseDetails[caseId];
      if (!detail) return rejectAfter('negotiation_case_not_found', 300);

      const mostRecent = getMostRecentRound(caseId);
      const count = await ownPositionCount(caseId);
      const eligibility = getNegotiationEligibility(
        detail.estado,
        count,
        isCounterpartyReady(caseId),
        mostRecent,
        getCurrentProposalForRound(mostRecent),
      );
      if (eligibility !== 'ready') {
        return rejectAfter('negotiation_not_ready', 300);
      }
      // "Only one active round may exist per case."
      if (mostRecent && mostRecent.estado === 'activa') {
        return rejectAfter('negotiation_round_still_active', 300);
      }
      // Defensive double-guard: never start a next round after a full agreement (eligibility would already be read_only by then, since markCaseAsAgreed flips estado to 'acordado').
      const priorProposal = getCurrentProposalForRound(mostRecent);
      if (priorProposal?.estado === 'aceptada') {
        return rejectAfter('negotiation_already_agreed', 300);
      }

      const round: NegotiationRound = {
        id: generateMockRoundId(),
        caseId,
        number: mostRecent ? mostRecent.number + 1 : 1,
        estado: 'activa',
        proposalId: undefined,
        mediatorAvailable: (mostRecent ? mostRecent.number + 1 : 1) >= 3,
        createdAt: new Date().toISOString(),
      };

      const created = await delay(round, 600);
      const latestAtCommit = getMostRecentRound(caseId);
      if (latestAtCommit?.estado === 'activa' || latestAtCommit?.id !== mostRecent?.id) {
        return rejectAfter('negotiation_round_still_active', 0);
      }
      // Only pushed after the (simulated) request resolves, so a forced
      // failure above never leaves a partially-created round behind.
      mockRounds.push(created);
      return created;
    },

    async generateSharedProposal(caseId) {
      if (failures.consume('generateSharedProposal')) {
        return rejectAfter('mock_generate_proposal_failed', 500);
      }

      const detail = mockCaseDetails[caseId];
      if (!detail) return rejectAfter('negotiation_case_not_found', 300);

      const round = getMostRecentRound(caseId);
      const count = await ownPositionCount(caseId);
      const eligibility = getNegotiationEligibility(
        detail.estado,
        count,
        isCounterpartyReady(caseId),
        round,
        getCurrentProposalForRound(round),
      );
      if (eligibility !== 'ready') {
        return rejectAfter('negotiation_not_ready', 300);
      }
      // "generateSharedProposal(caseId) generates only for the existing
      // active round" — never implicitly creates one; startNextRound is a
      // separate, explicit step.
      if (!round || round.estado !== 'activa') {
        return rejectAfter('negotiation_no_active_round', 300);
      }
      if (round.proposalId) {
        return rejectAfter('negotiation_proposal_already_exists', 300);
      }

      const fixture = getProposalFixture(caseId, round.number);
      const proposal: SharedProposal = {
        id: generateMockProposalId(),
        caseId,
        roundId: round.id,
        roundNumber: round.number,
        meetingPoint: fixture.meetingPoint,
        narrative: fixture.narrative,
        rationale: fixture.rationale,
        estado: 'pendiente',
        createdAt: new Date().toISOString(),
      };

      const created = await delay(proposal, 1500);
      const roundAtCommit = getMostRecentRound(caseId);
      if (roundAtCommit?.id !== round.id || roundAtCommit.estado !== 'activa' || roundAtCommit.proposalId) {
        return rejectAfter('negotiation_proposal_already_exists', 0);
      }
      // Only mutate the round after the mock "request" resolves — a forced
      // failure above never leaves the round pointing at a half-created
      // proposal.
      mockProposals.push(created);
      const roundIndex = mockRounds.findIndex((r) => r.id === round.id);
      mockRounds[roundIndex] = { ...mockRounds[roundIndex], proposalId: created.id };
      return created;
    },

    async submitOwnProposalResponse(caseId, proposalId, decision) {
      if (failures.consume('submitOwnProposalResponse')) {
        return rejectAfter('mock_submit_response_failed', 500);
      }

      const detail = mockCaseDetails[caseId];
      if (!detail) return rejectAfter('negotiation_case_not_found', 300);

      const proposal = getProposalById(proposalId);
      const round = proposal ? mockRounds.find((r) => r.id === proposal.roundId) : undefined;
      const mostRecent = getMostRecentRound(caseId);

      // Reject stale, historical, or non-current proposals: the proposal
      // must be the one attached to the case's most recent round, that
      // round must still be active, and the proposal must still be
      // pendiente.
      if (
        !proposal ||
        proposal.caseId !== caseId ||
        !round ||
        !mostRecent ||
        round.id !== mostRecent.id ||
        round.estado !== 'activa' ||
        proposal.estado !== 'pendiente'
      ) {
        return rejectAfter('negotiation_proposal_stale', 300);
      }
      if (getOwnResponseForProposal(proposalId)) {
        return rejectAfter('negotiation_response_already_submitted', 300);
      }

      const ownDecision: OwnProposalResponse = { proposalId, decision, createdAt: new Date().toISOString() };
      const saved = await delay(ownDecision, 700);
      const proposalAtCommit = getProposalById(proposalId);
      const roundAtCommit = getMostRecentRound(caseId);
      if (
        !proposalAtCommit ||
        proposalAtCommit.estado !== 'pendiente' ||
        roundAtCommit?.id !== round.id ||
        roundAtCommit.estado !== 'activa' ||
        getOwnResponseForProposal(proposalId)
      ) {
        return rejectAfter('negotiation_response_already_submitted', 0);
      }
      mockOwnResponses.push(saved);

      // Reveal + apply the simulated counterparty decision only now — never
      // before the authenticated party has submitted their own response.
      const counterpartyDecision = simulatedCounterpartyDecision(caseId, round.number);
      if (counterpartyDecision != null) {
        const bothAccept = saved.decision === 'acepta' && counterpartyDecision === 'acepta';
        const proposalIndex = mockProposals.findIndex((p) => p.id === proposalId);
        mockProposals[proposalIndex] = { ...mockProposals[proposalIndex], estado: bothAccept ? 'aceptada' : 'rechazada' };
        const roundIndex = mockRounds.findIndex((r) => r.id === round.id);
        mockRounds[roundIndex] = { ...mockRounds[roundIndex], estado: 'completada', completedAt: new Date().toISOString() };

        if (bothAccept) {
          markCaseAsAgreed(caseId);
        }
      }
      // Else: the simulated party hasn't responded in this demo scenario —
      // the proposal stays 'pendiente' and the round stays 'activa';
      // buildNegotiationState reports waitingForOtherParty: true instead.

      return buildNegotiationState(caseId);
    },

    async getAcceptedProposal(caseId) {
      const accepted = mockProposals.find((proposal) => proposal.caseId === caseId && proposal.estado === 'aceptada');
      return delay(accepted ?? null, 300);
    },

    async listNegotiations(caseId) {
      const detail = mockCaseDetails[caseId];
      if (!detail) return delay([], 300);

      // Materializar acá también: con la lista, nadie lee el acuerdo "por
      // caso" antes de que la tarjeta pida su id, así que un acuerdo aceptado
      // en la sesión no existiría hasta que alguien lo pidiera.
      const accepted = mockProposals.find((proposal) => proposal.caseId === caseId && proposal.estado === 'aceptada');
      const agreement = getAgreementForCase(caseId) ?? (accepted ? materializeFromAcceptedProposal(caseId, accepted) : null);
      const round = getMostRecentRound(caseId);

      const negotiation: Negotiation = {
        id: mockNegotiationId(caseId),
        caseId,
        // El mock es el modelo viejo, y eso es verdad: sin materia.
        subjectType: null,
        metodo: detail.metodo,
        estado: toMockEstadoNegociacion(detail.estado),
        roundNumber: round?.number ?? 0,
        currentAgreement: agreement
          ? { id: agreement.id, estado: agreement.estado, version: getAgreementVersion(agreement.id) }
          : null,
        createdAt: round?.createdAt ?? new Date(0).toISOString(),
      };
      return delay([negotiation], 300);
    },

    async renegotiate(negotiationId) {
      const caseId = caseIdFromMockNegotiationId(negotiationId);
      const agreement = caseId === null ? undefined : getAgreementForCase(caseId);
      // Same gate as the server: an acuerdo in force **and signed**. A draft
      // (renegotiating twice) or `con_aviso` is a 409, not a new round.
      if (caseId === null || !agreement || agreement.estado !== 'firmado') {
        return rejectAfter(codeNegociacionNotAcordada, 300);
      }

      const mostRecent = getMostRecentRound(caseId);
      const nextNumber = mostRecent ? mostRecent.number + 1 : 1;
      const round: NegotiationRound = {
        id: generateMockRoundId(),
        caseId,
        number: nextNumber,
        estado: 'activa',
        proposalId: undefined,
        mediatorAvailable: nextNumber >= 3,
        createdAt: new Date().toISOString(),
      };
      const created = await delay(round, 600);

      // One transaction's worth of writes, only after the mock "request"
      // resolved: the draft, the round, and the caso back in negotiation.
      const draft = supersedeWithDraft(agreement.id);
      mockRounds.push(created);
      markCaseAsRenegotiating(caseId);
      return { negotiationId, agreementId: draft.id };
    },
  };
}

/** Default instance consumed by the feature hooks — the single place to swap in a real API-backed implementation later. */
/*
  `live` es `backend` ya estrechado: dentro del closure async TypeScript
  vuelve a verlo como `Backend | null`. Y `casesService` no estaba importado
  — contra backend real, la primera lectura tiraba `ReferenceError`.
*/
const live = backend;
export const negotiationService: NegotiationService = live
  ? createBackedNegotiationService(live.negotiation, {
      getCaseDetail: (caseId) => casesService.getCaseDetail(caseId),
      getOwnPositionCount: async (caseId) => {
        const positions = await live.positions.getOwnPositions(caseId);
        return positions.length;
      },
    })
  : createMockNegotiationService();
