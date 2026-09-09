import { mockCases } from '../mocks/cases';
import { simulatedOtherPartySignature } from '../mocks/agreements';
import type {
  AgreementExport,
  AgreementHistoryItem,
  AgreementState,
  BreachNotice,
  SharedAgreement,
  SharedSignerStatus,
  SignatureInboxItem,
} from '../types/agreement';
import { generateMockBreachNoticeId } from '../utils/mock-id';
import { createBackedAgreementsService } from './api/agreements.backed-service';
import { backend } from './backend-instance';
import { casesService } from './cases.service';
import {
  appendHistory,
  getAgreementById,
  getAgreementForCase,
  getSigners,
  materializeFromAcceptedProposal,
  mockAgreements,
  mockHistory,
  mockSigners,
} from './mock-agreement-store';
import { createFailureController, delay, rejectAfter } from './mock-utils';
import { negotiationService } from './negotiation.service';

/**
 * Replaceable service boundary for shared agreements and mock signatures.
 *
 * PRIVACY / SOURCE BOUNDARY: an agreement is created only from a
 * SharedProposal whose `estado` is exactly `'aceptada'` (see
 * negotiationService.getAcceptedProposal). This file never imports, calls,
 * or reads `positionsService` in any form, and never touches `PositionItem`,
 * `valueMin`, `valueMax`, `concessionConditions`, `canConcede`, or any
 * private description — there is nothing here that could, even by
 * accident. Real legal-document generation and signature-provider
 * (DocuSign) integration belong on the backend; the "signatures" produced
 * here are a local confirmation flag only — never cryptographic, never a
 * provider envelope, and never legally binding.
 */
export type AgreementsService = {
  getAgreementState(caseId: string): Promise<AgreementState | null>;
  /**
   * Lectura por acuerdo, no por caso. Es la que usa la bandeja de firmas: con
   * más de un acuerdo por caso, `caseId` ya no dice cuál abrir — y ésta es la
   * pantalla que firma. `null` si no existe o no es legible por quien pide.
   */
  getAgreementStateById(agreementId: string): Promise<AgreementState | null>;
  getAgreement(caseId: string): Promise<SharedAgreement | null>;
  /** Con `agreementId`, manda ese borrador a firmar tal cual; sin él, el camino por caso (existente o generado). */
  prepareSignatureDocument(caseId: string, agreementId?: string): Promise<AgreementState>;
  submitOwnMockSignature(caseId: string, agreementId: string): Promise<AgreementState>;
  getAgreementHistory(caseId: string, agreementId?: string): Promise<AgreementHistoryItem[]>;
  /**
   * Registers a breach notice and answers with the agreement state **as it is
   * afterwards** — the backend moves the acuerdo to `con_aviso` in the same
   * transaction, so returning the new state is the only way the screen can
   * render the truth without a second guess.
   */
  reportBreach(caseId: string, agreementId: string, description: string): Promise<AgreementState>;
  getBreachNotices(agreementId: string): Promise<BreachNotice[]>;
  exportAgreement(agreementId: string): Promise<AgreementExport>;
  getSignatureInbox(): Promise<SignatureInboxItem[]>;
};

/*
  El store (acuerdos, firmantes, historial) vive en `mock-agreement-store.ts`
  porque `negotiation.service.ts` también lo lee, y este archivo ya lo importa
  a él. Ver el comentario de ese módulo.
*/

/** In-memory only, keyed by agreement id — cleared on app restart, never written to disk. */
const mockBreachNotices: Record<string, BreachNotice[]> = {};

/** The one mock authenticated party, same convention as `positions.service.ts`. */
const mockReporterId = 'party-self';

type ForcibleOperation =
  | 'prepareSignatureDocument'
  | 'submitOwnMockSignature'
  | 'reportBreach'
  | 'exportAgreement';

const failures = createFailureController<ForcibleOperation>();

export function __mockForceAgreementFailure(operation: ForcibleOperation): void {
  failures.force(operation);
}

function buildAgreementState(agreement: SharedAgreement, signers?: SharedSignerStatus[]): AgreementState {
  const currentSigners = signers ?? getSigners(agreement.id);
  const own = currentSigners.find((signer) => signer.role === 'authenticated_party');
  const ownSignatureComplete = own?.status === 'firmado';
  const agreementIsComplete = agreement.estado === 'firmado' || agreement.estado === 'con_aviso';
  const allSignersFirmado = currentSigners.length > 0 && currentSigners.every((signer) => signer.status === 'firmado');
  const allSignaturesComplete = agreementIsComplete || allSignersFirmado;
  const readOnly = agreementIsComplete;

  return {
    agreement,
    signers: currentSigners,
    ownSignatureComplete,
    waitingForOtherParty: ownSignatureComplete && !allSignaturesComplete,
    allSignaturesComplete,
    canPrepareDocument: agreement.estado === 'borrador',
    canSign: agreement.estado === 'enviado_a_firma' && own?.status === 'pendiente' && !readOnly,
    readOnly,
  };
}

/** Exported only for regression tests — calls the real state derivation with explicit signers. */
export function __testDeriveAgreementState(agreement: SharedAgreement, signers: SharedSignerStatus[]): AgreementState {
  return buildAgreementState(agreement, signers);
}

/** Concurrent callers for the same caseId share one in-flight materialization, so two near-simultaneous reads can never create two agreements. */
const materializationInFlight: Record<string, Promise<SharedAgreement | null> | undefined> = {};
const preparationInFlight: Record<string, Promise<AgreementState> | undefined> = {};
const signatureInFlight: Record<string, Promise<AgreementState> | undefined> = {};

/**
 * Lazily materializes the case's agreement from its accepted proposal, at
 * most once per case (`materializeFromAcceptedProposal` is idempotent and the
 * in-flight map covers the await on `negotiationService`). A failed or
 * negative lookup never mutates anything.
 */
async function ensureAgreementFromAcceptedProposal(caseId: string): Promise<SharedAgreement | null> {
  const existing = getAgreementForCase(caseId);
  if (existing) return existing;

  const inFlight = materializationInFlight[caseId];
  if (inFlight) return inFlight;

  const promise = (async (): Promise<SharedAgreement | null> => {
    // The only "eligibility" gate is a genuinely accepted proposal — never
    // nuevo, never activo/en_negociacion without joint acceptance, never a
    // terminal state without one either.
    const accepted = await negotiationService.getAcceptedProposal(caseId);
    if (!accepted) return null;
    return materializeFromAcceptedProposal(caseId, accepted);
  })();

  materializationInFlight[caseId] = promise;
  try {
    return await promise;
  } finally {
    delete materializationInFlight[caseId];
  }
}

export function createMockAgreementsService(): AgreementsService {
  return {
    async getAgreementState(caseId) {
      const agreement = await ensureAgreementFromAcceptedProposal(caseId);
      if (!agreement) return null;
      return buildAgreementState(agreement);
    },

    /**
     * Nunca materializa: no hay caso del cual hacerlo. Un id que no está —una
     * recarga en web con el id de una sesión anterior— es `null`, y la
     * pantalla lo dice como "no encontrado", no como "todavía no hay acuerdo".
     */
    async getAgreementStateById(agreementId) {
      const agreement = getAgreementById(agreementId);
      return delay(agreement ? buildAgreementState(agreement) : null, 300);
    },

    async getAgreement(caseId) {
      return ensureAgreementFromAcceptedProposal(caseId);
    },

    async prepareSignatureDocument(caseId, agreementId) {
      const existing = preparationInFlight[caseId];
      if (existing) return existing;

      const operation = (async () => {
        if (failures.consume('prepareSignatureDocument')) {
          return rejectAfter('agreement_preparation_failed', 600);
        }

        const agreement =
          agreementId === undefined
            ? await ensureAgreementFromAcceptedProposal(caseId)
            : getAgreementById(agreementId);
        if (!agreement || agreement.caseId !== caseId) return rejectAfter('agreement_not_found', 300);
        // Only 'borrador' → 'enviado_a_firma' is allowed here — this alone
        // rejects duplicate preparation and any read-only state ('firmado',
        // 'con_aviso'), and there is no backward transition anywhere in this
        // file.
        if (agreement.estado !== 'borrador') {
          return rejectAfter('agreement_not_preparable', 300);
        }

        const startedAt = new Date().toISOString();
        const updated: SharedAgreement = { ...agreement, estado: 'enviado_a_firma' };

        const committed = await delay(updated, 1200);
        const readyAt = new Date().toISOString();
        const withReadyAt: SharedAgreement = { ...committed, readyAt };

        // Only mutate after the mock "request" resolves — a forced failure
        // above never leaves estado flipped or readyAt set.
        const index = mockAgreements.findIndex((a) => a.id === agreement.id);
        mockAgreements[index] = withReadyAt;
        appendHistory(agreement.id, 'preparation_started', 'borrador', startedAt);
        appendHistory(agreement.id, 'document_ready', 'enviado_a_firma', readyAt);
        return buildAgreementState(withReadyAt);
      })();

      preparationInFlight[caseId] = operation;
      try {
        return await operation;
      } finally {
        if (preparationInFlight[caseId] === operation) delete preparationInFlight[caseId];
      }
    },

    async submitOwnMockSignature(caseId, agreementId) {
      const operationKey = `${caseId}:${agreementId}`;
      const existing = signatureInFlight[operationKey];
      if (existing) return existing;

      const operation = (async () => {
        if (failures.consume('submitOwnMockSignature')) {
          return rejectAfter('agreement_signature_failed', 700);
        }

        const agreement = getAgreementForCase(caseId);
        // Reject mismatched/stale agreement IDs and any case/agreement mismatch.
        if (!agreement || agreement.id !== agreementId || agreement.caseId !== caseId) {
          return rejectAfter('agreement_mismatch', 300);
        }
        if (agreement.estado !== 'enviado_a_firma') {
          return rejectAfter('agreement_not_signable', 300);
        }
        const signers = getSigners(agreement.id);
        const own = signers.find((signer) => signer.role === 'authenticated_party');
        if (own?.status === 'firmado') {
          return rejectAfter('agreement_already_signed', 300);
        }

        const ownSignedAt = new Date().toISOString();
        const updatedOwn: SharedSignerStatus = { role: 'authenticated_party', status: 'firmado', signedAt: ownSignedAt };
        const committedOwn = await delay(updatedOwn, 800);

        // Commit the own signature first — a forced failure above is the only
        // thing that can prevent this. Everything below only ever runs once
        // this mutation has already succeeded.
        const ownIndex = signers.findIndex((signer) => signer.role === 'authenticated_party');
        const nextSigners = [...signers];
        nextSigners[ownIndex] = committedOwn;
        mockSigners[agreement.id] = nextSigners;
        appendHistory(agreement.id, 'own_signature_registered', agreement.estado, committedOwn.signedAt);

        // Reveal + apply the simulated other-party signature only now — never
        // before the authenticated party's own signature has been committed.
        const otherDecision = simulatedOtherPartySignature(caseId);
        if (otherDecision === 'firmado') {
          const otherSignedAt = new Date().toISOString();
          const otherIndex = nextSigners.findIndex((signer) => signer.role === 'other_party');
          nextSigners[otherIndex] = { role: 'other_party', status: 'firmado', signedAt: otherSignedAt };
          mockSigners[agreement.id] = nextSigners;

          const completedAgreement: SharedAgreement = { ...agreement, estado: 'firmado', completedAt: otherSignedAt };
          const agreementIndex = mockAgreements.findIndex((a) => a.id === agreement.id);
          mockAgreements[agreementIndex] = completedAgreement;
          appendHistory(agreement.id, 'both_signatures_completed', 'firmado', otherSignedAt);
          return buildAgreementState(completedAgreement);
        }

        // Else: the simulated other party hasn't signed in this demo
        // scenario — estado stays 'enviado_a_firma'; buildAgreementState
        // reports waitingForOtherParty: true instead.
        appendHistory(agreement.id, 'waiting_for_other_party', agreement.estado);
        return buildAgreementState(agreement);
      })();

      signatureInFlight[operationKey] = operation;
      try {
        return await operation;
      } finally {
        if (signatureInFlight[operationKey] === operation) delete signatureInFlight[operationKey];
      }
    },

    async getAgreementHistory(caseId, agreementId) {
      const agreement =
        agreementId === undefined
          ? await ensureAgreementFromAcceptedProposal(caseId)
          : getAgreementById(agreementId);
      if (!agreement) return delay([], 300);
      const items = [...(mockHistory[agreement.id] ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return delay(items, 400);
    },

    async reportBreach(caseId, agreementId, description) {
      if (failures.consume('reportBreach')) {
        return rejectAfter('mock_report_breach_failed', 500);
      }
      const agreement = mockAgreements.find((candidate) => candidate.id === agreementId);
      if (!agreement || agreement.caseId !== caseId) {
        return rejectAfter('agreement_not_found', 300);
      }
      // Mirrors the server rule: only a signed agreement can be reported.
      // The mock refusing what the API refuses is what keeps a screen from
      // being written against a permissiveness that does not exist.
      if (agreement.estado !== 'firmado' && agreement.estado !== 'con_aviso') {
        return rejectAfter('agreement_not_firmado', 300);
      }
      const trimmed = description.trim();
      if (trimmed.length === 0) {
        return rejectAfter('invalid_input', 300);
      }

      const notice: BreachNotice = {
        id: generateMockBreachNoticeId(),
        agreementId,
        reporterId: mockReporterId,
        description: trimmed,
        fecha: new Date().toISOString(),
      };
      const committed = await delay(notice, 700);
      // Committed together, like the server's transaction: a registered
      // notice always comes with the estado it caused.
      mockBreachNotices[agreementId] = [committed, ...(mockBreachNotices[agreementId] ?? [])];
      agreement.estado = 'con_aviso';
      return buildAgreementState(agreement);
    },

    async getBreachNotices(agreementId) {
      return delay([...(mockBreachNotices[agreementId] ?? [])], 400);
    },

    async exportAgreement(agreementId) {
      if (failures.consume('exportAgreement')) {
        return rejectAfter('mock_export_agreement_failed', 500);
      }
      const agreement = mockAgreements.find((candidate) => candidate.id === agreementId);
      if (!agreement) {
        return rejectAfter('agreement_not_found', 300);
      }
      // A rough stand-in for `buildAgreementDocument` on the server, not a
      // copy of it: the real text is BE's to shape, and mirroring it line by
      // line here would be one more hand-kept mirror to drift.
      const document = [
        'ACUERDO DE MEDIACIÓN',
        '',
        `Identificador: ${agreement.id}`,
        `Caso: ${agreement.caseId}`,
        `Estado: ${agreement.estado}`,
        '',
        'PUNTOS ACORDADOS',
        ...agreement.terms.map((term) => `- ${term.title}: ${term.description}`),
        '',
        'FUNDAMENTACIÓN',
        agreement.rationale ?? '—',
        '',
      ].join('\n');
      return delay({ document }, 700);
    },

    async getSignatureInbox() {
      const items: SignatureInboxItem[] = [];
      for (const caseSummary of mockCases) {
        if (caseSummary.estado !== 'acordado') continue;
        const agreement = await ensureAgreementFromAcceptedProposal(caseSummary.id);
        // acordado but no accepted proposal shouldn't happen given the
        // negotiation service's own invariant (markCaseAsAgreed only runs
        // right after an acceptance), but this is never invented if absent.
        if (!agreement) continue;
        const signers = getSigners(agreement.id);
        const own = signers.find((signer) => signer.role === 'authenticated_party');
        items.push({
          agreementId: agreement.id,
          caseId: caseSummary.id,
          caseTitle: caseSummary.title,
          agreementTitle: agreement.title,
          // Lo que la API devuelve para el modelo viejo, que es el único que
          // el mock tiene: sin materia, primera versión.
          subjectType: null,
          version: 1,
          estado: agreement.estado,
          ownStatus: own?.status ?? 'pendiente',
          completedAt: agreement.completedAt,
        });
      }
      return delay(items, 500);
    },
  };
}

/** Default instance consumed by the feature hooks — the single place to swap in a real API-backed implementation later. */
/*
  `live` es `backend` ya estrechado: dentro del closure async TypeScript
  vuelve a verlo como `Backend | null`.
*/
const live = backend;
export const agreementsService: AgreementsService = live
  ? createBackedAgreementsService(live.agreements, {
      getCaseTitle: (caseId) => casesService.getCaseTitle(caseId),
      getAcceptedRoundNumber: async (caseId) => {
        const accepted = await negotiationService.getAcceptedProposal(caseId);
        return accepted?.roundNumber ?? 0;
      },
      getCurrentUserId: async () => {
        const session = await live.auth.getSession();
        return session?.user?.id ?? null;
      },
    })
  : createMockAgreementsService();
