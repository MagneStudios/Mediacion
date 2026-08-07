import type { EstadoCaso } from '@/types/case';
import type { MediatorActivityItem, MediatorState, MockMediation } from '@/types/mediator';

import { getMediatorEligibility } from '@/utils/mediator-eligibility';

import type { MediatorService } from '../mediator.service';
import type { ApiMediatorService } from './mediator.api-service';

export type MediatorDeps = {
  getCaseEstado: (caseId: string) => Promise<EstadoCaso | null>;
  getCurrentRoundNumber: (caseId: string) => Promise<number | null>;
  buildProfile: () => MediatorState['mediator'];
};

const assignedEstados = ['aceptada', 'activa'] as const;

/**
 * Presents the real API under the contract the mediator screens already consume.
 *
 * Two things worth knowing:
 *
 * - **Which mediador gets requested.** `POST /casos/:id/mediacion` requires a
 *   `mediadorId`, but `requestMediator(caseId)` takes none — the mock assigned
 *   one deterministically. Here the first eligible mediador from
 *   `GET /casos/:id/mediadores` is requested. That roster already excludes
 *   anyone who is a party to the caso, and the server re-validates the choice,
 *   so a stale roster cannot produce an invalid assignment — it produces an
 *   error the screen already handles.
 *
 * - **`getMediatorActivity` returns [].** The milestone feed the mock kept
 *   in memory has no backing table; `mediaciones` stores only the current
 *   estado, not a history of transitions. An empty list is the truthful answer
 *   — the alternative would be reconstructing milestones from a single estado,
 *   which would invent timestamps.
 */
export function createBackedMediatorService(
  api: ApiMediatorService,
  deps: MediatorDeps,
): MediatorService {
  async function buildState(
    caseId: string,
    mediation: MockMediation | null,
  ): Promise<MediatorState | null> {
    const estado = await deps.getCaseEstado(caseId);
    if (estado === null) {
      return null;
    }
    const roundNumber = await deps.getCurrentRoundNumber(caseId);
    const eligibility = getMediatorEligibility(estado, roundNumber, mediation);
    const canRequest = eligibility === 'available';
    const assigned =
      mediation !== null &&
      (assignedEstados as readonly string[]).includes(mediation.estado);

    return {
      caseId,
      eligibility,
      mediation,
      ...(assigned ? { mediator: deps.buildProfile() } : {}),
      canRequest,
      readOnly: !canRequest,
    };
  }

  return {
    async getMediatorState(caseId: string): Promise<MediatorState | null> {
      const mediation = await api.getForCase(caseId);
      return buildState(caseId, mediation);
    },

    async requestMediator(caseId: string): Promise<MediatorState> {
      const mediadores = await api.listMediadores(caseId);
      const [first] = mediadores;
      if (first === undefined) {
        throw new Error(`No mediador is available for caso ${caseId}`);
      }
      const mediation = await api.request(caseId, first.id);
      const state = await buildState(caseId, mediation);
      if (state === null) {
        throw new Error(`Caso ${caseId} was not readable after requesting a mediador`);
      }
      return state;
    },

    async getMediatorActivity(): Promise<MediatorActivityItem[]> {
      return [];
    },
  };
}
