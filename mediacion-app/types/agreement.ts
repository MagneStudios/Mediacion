/**
 * Domain types for the agreement/signature feature. `EstadoAcuerdo` mirrors
 * the real Supabase enum `estado_acuerdo` exactly. There is no separate
 * "document" or "firmante" table on the backend — `acuerdos.documento_url`
 * and `docusign_envelope_id` are just fields on the same row, and signers
 * are rows in `firmas` (one per usuario_id). This file follows that shape:
 * no SignatureDocument type, and no per-signer identifiers exposed to the
 * UI.
 *
 * This file does not import from packages/db-types or apps/api.
 */

/** Matches `acuerdos.estado` exactly. No invented persisted states (no "preparing", "ready", "partially_signed", "completed", or "failed" enum members). */
export type EstadoAcuerdo = 'borrador' | 'enviado_a_firma' | 'firmado' | 'con_aviso';

/**
 * Frontend mock presentation status only — NOT a backend enum and NOT
 * DocuSign's status vocabulary (`firmas.docusign_status` is free text like
 * "sent"/"delivered"/"signed" from a real provider this app never calls).
 * Inventing a fake DocuSign-shaped vocabulary here would misleadingly imply
 * a real integration, so this is deliberately a minimal two-value mock
 * label instead.
 */
export type MockSignatureStatus = 'pendiente' | 'firmado';

export type SignerRole = 'authenticated_party' | 'other_party';

/** No usuario_id, email, or any other identifier — see the privacy notes in agreements.service.ts. */
export type SharedSignerStatus = {
  role: SignerRole;
  status: MockSignatureStatus;
  signedAt?: string;
};

export type SharedAgreementTerm = {
  id: string;
  title: string;
  description: string;
};

/**
 * Sanitized shared agreement content only. Created exclusively from an
 * accepted SharedProposal (negotiation.service.ts's getAcceptedProposal) —
 * never from private position items. `readyAt`/`completedAt` fold in what
 * would otherwise be a separate "document" entity, since the backend has
 * none (see the file header note).
 */
export type SharedAgreement = {
  id: string;
  caseId: string;
  sourceProposalId: string;
  sourceRoundNumber: number;
  title: string;
  summary: string;
  terms: SharedAgreementTerm[];
  /** Matches nullable `propuestas.fundamentacion`, carried over from the accepted proposal. */
  rationale?: string;
  estado: EstadoAcuerdo;
  createdAt: string;
  /** Set only when prepareSignatureDocument succeeds — never populated on a failed/partial preparation. */
  readyAt?: string;
  /** Set only once both signers are 'firmado' — never populated by a single signature. */
  completedAt?: string;
};

export type AgreementState = {
  agreement: SharedAgreement;
  /** Always both roles present; `other_party` stays 'pendiente' until revealed — never omitted or guessed at. */
  signers: SharedSignerStatus[];
  ownSignatureComplete: boolean;
  waitingForOtherParty: boolean;
  allSignaturesComplete: boolean;
  /** True only when estado === 'borrador'. */
  canPrepareDocument: boolean;
  /** True only when estado === 'enviado_a_firma', the own signer is still 'pendiente', and the state isn't read-only. */
  canSign: boolean;
  /** True for 'firmado', 'con_aviso', and any other unrecognized terminal state — never for 'borrador'/'enviado_a_firma'. */
  readOnly: boolean;
};

export type AgreementHistoryEventKey =
  | 'agreement_created'
  | 'preparation_started'
  | 'document_ready'
  | 'own_signature_registered'
  | 'waiting_for_other_party'
  | 'both_signatures_completed';

export type AgreementHistoryItem = {
  id: string;
  eventKey: AgreementHistoryEventKey;
  timestamp: string;
  status: EstadoAcuerdo;
};

/** For the Firmas tab inbox — no provider IDs, no case internals beyond what's needed to open the case. */
export type SignatureInboxItem = {
  caseId: string;
  caseTitle: string;
  agreementTitle: string;
  estado: EstadoAcuerdo;
  ownStatus: MockSignatureStatus;
  completedAt?: string;
};
