import { mockCases, mockCaseDetails } from '../mocks/cases';
import { buildInitialAgreements, buildInitialHistory, buildInitialSigners, simulatedOtherPartySignature } from '../mocks/agreements';
import type {
  AgreementHistoryItem,
  AgreementHistoryEventKey,
  AgreementState,
  SharedAgreement,
  SharedSignerStatus,
  SignatureInboxItem,
} from '../types/agreement';
import { generateMockAgreementId, generateMockHistoryId } from '../utils/mock-id';
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
  getAgreement(caseId: string): Promise<SharedAgreement | null>;
  prepareSignatureDocument(caseId: string): Promise<AgreementState>;
  submitOwnMockSignature(caseId: string, agreementId: string): Promise<AgreementState>;
  getAgreementHistory(caseId: string): Promise<AgreementHistoryItem[]>;
  getSignatureInbox(): Promise<SignatureInboxItem[]>;
};

/** In-memory only — cleared on app restart, never written to disk, never logged. */
const mockAgreements: SharedAgreement[] = buildInitialAgreements();
const mockSigners: Record<string, SharedSignerStatus[]> = buildInitialSigners();
const mockHistory: Record<string, AgreementHistoryItem[]> = buildInitialHistory();

const failures = createFailureController<'prepareSignatureDocument' | 'submitOwnMockSignature'>();

export function __mockForceAgreementFailure(operation: 'prepareSignatureDocument' | 'submitOwnMockSignature'): void {
  failures.force(operation);
}

function getAgreementForCase(caseId: string): SharedAgreement | undefined {
  return mockAgreements.find((agreement) => agreement.caseId === caseId);
}

function getSigners(agreementId: string): SharedSignerStatus[] {
  return mockSigners[agreementId] ?? [];
}

function appendHistory(agreementId: string, eventKey: AgreementHistoryEventKey, status: SharedAgreement['estado'], timestamp?: string): void {
  const list = mockHistory[agreementId] ?? (mockHistory[agreementId] = []);
  list.push({ id: generateMockHistoryId(), eventKey, timestamp: timestamp ?? new Date().toISOString(), status });
}

function buildAgreementState(agreement: SharedAgreement): AgreementState {
  const signers = getSigners(agreement.id);
  const own = signers.find((signer) => signer.role === 'authenticated_party');
  const ownSignatureComplete = own?.status === 'firmado';
  const allSignaturesComplete = agreement.estado === 'firmado';
  const readOnly = agreement.estado === 'firmado' || agreement.estado === 'con_aviso';

  return {
    agreement,
    signers,
    ownSignatureComplete,
    waitingForOtherParty: ownSignatureComplete && !allSignaturesComplete,
    allSignaturesComplete,
    canPrepareDocument: agreement.estado === 'borrador',
    canSign: agreement.estado === 'enviado_a_firma' && own?.status === 'pendiente' && !readOnly,
    readOnly,
  };
}

/** Concurrent callers for the same caseId share one in-flight materialization, so two near-simultaneous reads can never create two agreements. */
const materializationInFlight: Record<string, Promise<SharedAgreement | null> | undefined> = {};

/**
 * Deterministic mock materialization: an agreement only ever comes into
 * existence here, lazily, the first time it's needed for a case — and only
 * ever from a genuinely accepted shared proposal. Idempotent: repeated
 * calls for the same case return the same agreement, never a duplicate. A
 * failed or negative lookup never mutates anything.
 */
async function ensureAgreementFromAcceptedProposal(caseId: string): Promise<SharedAgreement | null> {
  const existing = getAgreementForCase(caseId);
  if (existing) return existing;

  const inFlight = materializationInFlight[caseId];
  if (inFlight) return inFlight;

  const promise = (async (): Promise<SharedAgreement | null> => {
    // 1. Validate case existence.
    const caseDetail = mockCaseDetails[caseId];
    if (!caseDetail) return null;

    // 2 & 3. The only "eligibility" gate is a genuinely accepted proposal —
    // never nuevo, never activo/en_negociacion without joint acceptance,
    // never a terminal state without one either. No case-estado branching
    // beyond this is needed: only an accepted proposal ever exists at all.
    const accepted = await negotiationService.getAcceptedProposal(caseId);
    if (!accepted || accepted.estado !== 'aceptada' || accepted.caseId !== caseId) {
      // 4/5/6. No accepted shared proposal — never invent agreement content.
      return null;
    }

    // Re-check idempotency after the await in case a concurrent call
    // committed while this one was waiting on negotiationService.
    const raceCheck = getAgreementForCase(caseId);
    if (raceCheck) return raceCheck;

    // 7. Build the complete next object first…
    const now = new Date().toISOString();
    const agreement: SharedAgreement = {
      id: generateMockAgreementId(),
      caseId,
      sourceProposalId: accepted.id,
      sourceRoundNumber: accepted.roundNumber,
      title: accepted.title,
      summary: accepted.summary,
      terms: accepted.terms.map((term) => ({ ...term })),
      rationale: accepted.rationale,
      estado: 'borrador',
      createdAt: now,
    };
    const signers: SharedSignerStatus[] = [
      { role: 'authenticated_party', status: 'pendiente' },
      { role: 'other_party', status: 'pendiente' },
    ];

    // 8. …then commit atomically.
    mockAgreements.push(agreement);
    mockSigners[agreement.id] = signers;
    appendHistory(agreement.id, 'agreement_created', 'borrador', now);
    return agreement;
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

    async getAgreement(caseId) {
      return ensureAgreementFromAcceptedProposal(caseId);
    },

    async prepareSignatureDocument(caseId) {
      if (failures.consume('prepareSignatureDocument')) {
        return rejectAfter('agreement_preparation_failed', 600);
      }

      const agreement = await ensureAgreementFromAcceptedProposal(caseId);
      if (!agreement) return rejectAfter('agreement_not_found', 300);
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
    },

    async submitOwnMockSignature(caseId, agreementId) {
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
    },

    async getAgreementHistory(caseId) {
      const agreement = await ensureAgreementFromAcceptedProposal(caseId);
      if (!agreement) return delay([], 300);
      const items = [...(mockHistory[agreement.id] ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return delay(items, 400);
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
          caseId: caseSummary.id,
          caseTitle: caseSummary.title,
          agreementTitle: agreement.title,
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
export const agreementsService: AgreementsService = createMockAgreementsService();
