import type { CaseDetail } from '@/types/case';
import type {
  DecisionPropuesta,
  NegotiationRound,
  NegotiationState,
  RoundHistoryItem,
  SharedProposal,
} from '@/types/negotiation';

import { getNegotiationEligibility } from '@/utils/negotiation-eligibility';

import type { NegotiationService } from '../negotiation.service';
import type { ApiNegotiationService } from './negotiation.api-service';
import {
  toNegotiationRound,
  toRoundHistoryItem,
  toSharedProposal,
  type ApiPropuestaDetail,
} from './negotiation-mapper';

export type NegotiationDeps = {
  getCaseDetail: (caseId: string) => Promise<CaseDetail | undefined>;
  getOwnPositionCount: (caseId: string) => Promise<number>;
};

/** Highest round first, so [0] is the current one. */
function byRoundDesc(a: ApiPropuestaDetail, b: ApiPropuestaDetail): number {
  return b.ronda_numero - a.ronda_numero;
}

/**
 * Presents the real API under the contract the negotiation screens already
 * consume. Three mismatches, handled explicitly rather than papered over:
 *
 * - **`counterpartyReady` cannot be read.** No endpoint reports whether the
 *   other party submitted their positions, and that is deliberate: the
 *   actividad module excludes `items` events for exactly this reason — the
 *   timing of a private submission is itself a leak. So this passes `true`
 *   whenever a contraparte exists and lets the server be the authority: it
 *   answers `both_parties_required` when the other side is not ready, which
 *   the screens already handle. The consequence is that `waiting_other_party`
 *   never appears against the real API — the user learns it from the failed
 *   action instead of from a pre-emptively disabled button.
 *
 * - **`startNextRound` has no endpoint.** Server-side, `ensureActiveRondaId`
 *   opens the next round as a side effect of generating a propuesta. So
 *   starting a round IS generating the next proposal, and that is what this
 *   does — rather than faking a round the server does not know about.
 *
 * - **A just-generated propuesta has no narrative yet.** The POST answers with
 *   a pending row, so the state is re-read from the list endpoint, which is
 *   also where the round columns live.
 */
export function createBackedNegotiationService(
  api: ApiNegotiationService,
  deps: NegotiationDeps,
): NegotiationService {
  async function loadState(caseId: string): Promise<NegotiationState> {
    const [detail, propuestas] = await Promise.all([
      deps.getCaseDetail(caseId),
      api.listPropuestas(caseId),
    ]);

    const sorted = [...propuestas].sort(byRoundDesc);
    const latest = sorted[0] ?? null;
    const currentRound: NegotiationRound | null =
      latest === null ? null : toNegotiationRound(latest);
    const currentProposal: SharedProposal | null =
      latest === null ? null : toSharedProposal(latest, latest.ronda_numero);

    const ownPositionCount =
      detail === undefined ? 0 : await deps.getOwnPositionCount(caseId);

    const eligibility =
      detail === undefined
        ? 'read_only'
        : getNegotiationEligibility(
            detail.estado,
            ownPositionCount,
            detail.counterpartyName !== null,
            currentRound,
            currentProposal,
          );

    return {
      caseId,
      eligibility,
      currentRound,
      currentProposal,
      ownResponse:
        latest?.own_decision == null
          ? null
          : {
              proposalId: latest.id,
              decision: latest.own_decision,
              createdAt: latest.fecha,
            },
      waitingForOtherParty: Boolean(
        latest && latest.estado === 'pendiente' && latest.own_decision !== null,
      ),
      bothAccepted: latest?.estado === 'aceptada',
      roundResolved: latest?.ronda_estado === 'completada',
      mediatorAvailable: currentRound?.mediatorAvailable ?? false,
    };
  }

  async function generateAndReread(caseId: string): Promise<SharedProposal> {
    await api.generatePropuesta(caseId);
    const state = await loadState(caseId);
    if (state.currentProposal === null) {
      throw new Error(
        `Propuesta for caso ${caseId} was not readable right after generation`,
      );
    }
    return state.currentProposal;
  }

  return {
    getNegotiationState(caseId: string): Promise<NegotiationState> {
      return loadState(caseId);
    },

    generateSharedProposal(caseId: string): Promise<SharedProposal> {
      return generateAndReread(caseId);
    },

    async submitOwnProposalResponse(
      caseId: string,
      proposalId: string,
      decision: DecisionPropuesta,
    ): Promise<NegotiationState> {
      await api.responder(proposalId, decision);
      // The response may resolve the round and flip the propuesta's estado, so
      // the whole snapshot is re-read instead of being patched locally.
      return loadState(caseId);
    },

    async startNextRound(caseId: string): Promise<NegotiationRound> {
      await generateAndReread(caseId);
      const state = await loadState(caseId);
      if (state.currentRound === null) {
        throw new Error(`Ronda for caso ${caseId} was not readable after starting it`);
      }
      return state.currentRound;
    },

    async getRoundHistory(caseId: string): Promise<RoundHistoryItem[]> {
      const propuestas = await api.listPropuestas(caseId);
      return propuestas
        .filter((row) => row.ronda_estado === 'completada')
        .sort((a, b) => a.ronda_numero - b.ronda_numero)
        .map(toRoundHistoryItem);
    },

    async getAcceptedProposal(caseId: string): Promise<SharedProposal | null> {
      const propuestas = await api.listPropuestas(caseId);
      const accepted = propuestas.find((row) => row.estado === 'aceptada');
      return accepted === undefined
        ? null
        : toSharedProposal(accepted, accepted.ronda_numero);
    },
  };
}
