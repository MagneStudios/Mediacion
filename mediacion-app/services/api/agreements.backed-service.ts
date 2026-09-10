import type {
  AgreementExport,
  AgreementHistoryItem,
  AgreementState,
  BreachNotice,
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

  /** The caso id comes from the bundle itself — nothing is assumed about it. */
  async function loadStateById(agreementId: string): Promise<AgreementState | null> {
    const bundle = await api.getById(agreementId);
    return bundle === null ? null : buildState(bundle.acuerdo.caso_id, bundle);
  }

  /**
   * Every re-read after a write goes by acuerdo id. A caso can hold more than
   * one acuerdo, so re-reading by caso after signing could hand the screen a
   * different document than the one just signed.
   */
  async function reloadById(agreementId: string): Promise<AgreementState> {
    const state = await loadStateById(agreementId);
    if (state === null) {
      throw new Error(`Acuerdo ${agreementId} was not readable`);
    }
    return state;
  }

  async function loadStateFor(caseId: string, agreementId: string | undefined): Promise<AgreementState | null> {
    return agreementId === undefined ? loadState(caseId) : loadStateById(agreementId);
  }

  return {
    getAgreementState(caseId: string): Promise<AgreementState | null> {
      return loadState(caseId);
    },

    getAgreementStateById(agreementId: string): Promise<AgreementState | null> {
      return loadStateById(agreementId);
    },

    async getAgreement(caseId: string): Promise<SharedAgreement | null> {
      const state = await loadState(caseId);
      return state?.agreement ?? null;
    },

    /**
     * "Preparing the document" is the draft→signature transition. Without an
     * id, and with no acuerdo yet, it is generated first: a caso with an
     * accepted propuesta and no acuerdo row is exactly the state this action
     * exists to resolve.
     *
     * With an id the draft already exists and is sent as is — never
     * regenerated. After a renegociación the next draft is created server-side
     * (`POST /negociaciones/:id/renegociar`), and `POST /casos/:id/acuerdo`
     * would answer `409 acuerdo_already_exists` for it.
     */
    async prepareSignatureDocument(caseId: string, agreementId?: string): Promise<AgreementState> {
      if (agreementId !== undefined) {
        const bundle = await api.getById(agreementId);
        if (bundle === null) {
          throw new Error(`Acuerdo ${agreementId} was not readable`);
        }
        if (bundle.acuerdo.estado === 'borrador') {
          await api.sendToSignature(agreementId);
        }
        return reloadById(agreementId);
      }
      const existing = await api.getForCase(caseId);
      const acuerdo = existing?.acuerdo ?? (await api.generate(caseId));
      if (acuerdo.estado === 'borrador') {
        await api.sendToSignature(acuerdo.id);
      }
      return reloadById(acuerdo.id);
    },

    async submitOwnMockSignature(
      caseId: string,
      agreementId: string,
    ): Promise<AgreementState> {
      await api.sendToSignature(agreementId);
      return reloadById(agreementId);
    },

    /**
     * Only the two events the acuerdo row itself proves. `agreement_created` is
     * always true once the row exists; `document_ready` only once it left
     * borrador and carries the timestamp that proves it.
     */
    async getAgreementHistory(caseId: string, agreementId?: string): Promise<AgreementHistoryItem[]> {
      const state = await loadStateFor(caseId, agreementId);
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

    /**
     * The POST also moves the acuerdo to `con_aviso` inside the server's own
     * transaction, so the state is **re-read** rather than patched locally:
     * what the screen renders afterwards is the server's estado, not this
     * app's guess at what the write must have done.
     *
     * The registered notice itself is discarded here on purpose — the caller
     * gets the new state, and anything that wants the notices asks for them.
     * Returning both would let a screen render a list assembled from a write
     * response and a read that disagree.
     */
    async reportBreach(
      caseId: string,
      agreementId: string,
      description: string,
    ): Promise<AgreementState> {
      await api.registerBreach(agreementId, description);
      return reloadById(agreementId);
    },

    getBreachNotices(agreementId: string): Promise<BreachNotice[]> {
      return api.listBreachNotices(agreementId);
    },

    async exportAgreement(agreementId: string): Promise<AgreementExport> {
      return { document: await api.exportAgreement(agreementId) };
    },

    getSignatureInbox(): Promise<SignatureInboxItem[]> {
      return api.listSignatureInbox();
    },
  };
}
