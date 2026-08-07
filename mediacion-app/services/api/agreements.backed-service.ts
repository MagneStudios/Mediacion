import type {
  AgreementHistoryItem,
  AgreementState,
  SharedAgreement,
  SignatureInboxItem,
} from '@/types/agreement';

import type { AgreementsService } from '../agreements.service';
import { toAgreementState, toSharedAgreement } from './agreement-mapper';
import type { ApiAgreementBundle, ApiAgreementsService } from './agreements.api-service';

export type AgreementsDeps = {
  getCaseTitle: (caseId: string) => Promise<string | null>;
  /** Round number of the accepted propuesta — the acuerdo's contenido does not carry it. */
  getAcceptedRoundNumber: (caseId: string) => Promise<number>;
  getCurrentUserId: () => Promise<string | null>;
};

/**
 * Presents the real API under the contract the agreement screens already
 * consume.
 *
 * The honest gaps:
 *
 * - **`getAgreementHistory` has no backing.** The UI's history vocabulary
 *   (`preparation_started`, `waiting_for_other_party`, …) has no server
 *   counterpart: `GET /acuerdos/:id/historial` returns raw `auditoria` rows
 *   (`accion`/`entidad`), the same ambiguous shape the activity feed drops. The
 *   two transitions that CAN be established from the acuerdo row itself are
 *   returned; nothing else is invented. The list is therefore shorter than the
 *   mock's.
 *
 * - **`submitOwnMockSignature` maps to `POST /acuerdos/:id/firmar`**, which
 *   sends the whole acuerdo to signature rather than registering one party's
 *   signature — real signing happens in DocuSign, outside this app. The state
 *   is re-read afterwards so what the screen shows is the server's, not an
 *   optimistic guess.
 */
export function createBackedAgreementsService(
  api: ApiAgreementsService,
  deps: AgreementsDeps,
): AgreementsService {
  async function buildState(
    caseId: string,
    bundle: ApiAgreementBundle,
  ): Promise<AgreementState> {
    const [caseTitle, roundNumber, callerId] = await Promise.all([
      deps.getCaseTitle(caseId),
      deps.getAcceptedRoundNumber(caseId),
      deps.getCurrentUserId(),
    ]);
    const agreement = toSharedAgreement(
      bundle.acuerdo,
      caseTitle ?? '',
      roundNumber,
    );
    return toAgreementState(agreement, bundle.firmas, callerId ?? '');
  }

  async function loadState(caseId: string): Promise<AgreementState | null> {
    const bundle = await api.getForCase(caseId);
    return bundle === null ? null : buildState(caseId, bundle);
  }

  async function reload(caseId: string): Promise<AgreementState> {
    const state = await loadState(caseId);
    if (state === null) {
      throw new Error(`Acuerdo for caso ${caseId} was not readable`);
    }
    return state;
  }

  return {
    getAgreementState(caseId: string): Promise<AgreementState | null> {
      return loadState(caseId);
    },

    async getAgreement(caseId: string): Promise<SharedAgreement | null> {
      const state = await loadState(caseId);
      return state?.agreement ?? null;
    },

    /**
     * "Preparing the document" is the draft→signature transition. If no acuerdo
     * exists yet it is generated first, because a caso with an accepted
     * propuesta and no acuerdo row is exactly the state this action exists to
     * resolve.
     */
    async prepareSignatureDocument(caseId: string): Promise<AgreementState> {
      const existing = await api.getForCase(caseId);
      const acuerdo = existing?.acuerdo ?? (await api.generate(caseId));
      if (acuerdo.estado === 'borrador') {
        await api.sendToSignature(acuerdo.id);
      }
      return reload(caseId);
    },

    async submitOwnMockSignature(
      caseId: string,
      agreementId: string,
    ): Promise<AgreementState> {
      await api.sendToSignature(agreementId);
      return reload(caseId);
    },

    /**
     * Only the two events the acuerdo row itself proves. `agreement_created` is
     * always true once the row exists; `document_ready` only once it left
     * borrador and carries the timestamp that proves it.
     */
    async getAgreementHistory(caseId: string): Promise<AgreementHistoryItem[]> {
      const state = await loadState(caseId);
      if (state === null) {
        return [];
      }
      const { agreement } = state;
      const items: AgreementHistoryItem[] = [
        {
          id: `${agreement.id}-created`,
          eventKey: 'agreement_created',
          timestamp: agreement.createdAt,
          status: agreement.estado,
        },
      ];
      if (agreement.readyAt) {
        items.push({
          id: `${agreement.id}-ready`,
          eventKey: 'document_ready',
          timestamp: agreement.readyAt,
          status: agreement.estado,
        });
      }
      if (state.allSignaturesComplete && agreement.completedAt) {
        items.push({
          id: `${agreement.id}-completed`,
          eventKey: 'both_signatures_completed',
          timestamp: agreement.completedAt,
          status: agreement.estado,
        });
      }
      return items;
    },

    getSignatureInbox(): Promise<SignatureInboxItem[]> {
      return api.listSignatureInbox();
    },
  };
}
