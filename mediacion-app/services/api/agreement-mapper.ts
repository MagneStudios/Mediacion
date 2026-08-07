import type {
  AgreementState,
  EstadoAcuerdo,
  MockSignatureStatus,
  SharedAgreement,
  SharedAgreementTerm,
  SharedSignerStatus,
} from '@/types/agreement';
import type { MeetingPointEntry } from '@/types/negotiation';

/** `acuerdos.contenido`, built by apps/api/src/acuerdos/agreement-content.ts. */
export type ApiAcuerdoContenido = {
  propuesta_id?: string;
  contenido?: { meetingPoint?: MeetingPointEntry[]; narrative?: string | null } | null;
  fundamentacion?: string | null;
  modelo_ia?: string | null;
};

export type ApiAcuerdo = {
  id: string;
  caso_id: string;
  contenido: ApiAcuerdoContenido | null;
  documento_url: string | null;
  docusign_envelope_id: string | null;
  estado: EstadoAcuerdo;
  fecha: string | null;
  created_at: string;
  updated_at: string;
};

/** `GET /casos/:casoId/acuerdo` answers `{acuerdo, firmas}` — firmas as FirmaStatus. */
export type ApiFirmaStatus = {
  id: string;
  usuario_id: string;
  docusign_status: string;
  fecha_firma: string | null;
};

const signedDocusignStatus = 'signed';

/**
 * DocuSign carries six delivery states (pending/sent/delivered/signed/declined/
 * voided) but the UI only distinguishes "this party has signed" from "has not".
 * Anything that is not `signed` is `pendiente`: a declined envelope is
 * emphatically not a signature, and collapsing it to "pendiente" understates
 * rather than overstates progress.
 */
export function toSignatureStatus(docusignStatus: string): MockSignatureStatus {
  return docusignStatus === signedDocusignStatus ? 'firmado' : 'pendiente';
}

/**
 * The meeting point is the only structured content an acuerdo carries, so each
 * category becomes one term. `punto` is null for descriptive categories, which
 * is why the description falls back to the category's estado rather than
 * printing "null".
 */
export function toTerms(meetingPoint: MeetingPointEntry[]): SharedAgreementTerm[] {
  return meetingPoint.map((entry, index) => ({
    id: `${index}-${entry.categoria}`,
    title: entry.categoria,
    description: entry.punto === null ? entry.estado : String(entry.punto),
  }));
}

/**
 * `title` has no column. The caso's own name is used rather than a fabricated
 * one — it is the only truthful name this agreement has, and it is what the
 * party already recognises the case by.
 */
export function toSharedAgreement(
  row: ApiAcuerdo,
  caseTitle: string,
  roundNumber: number,
): SharedAgreement {
  const embedded = row.contenido?.contenido ?? null;
  const fundamentacion = row.contenido?.fundamentacion ?? null;
  return {
    id: row.id,
    caseId: row.caso_id,
    sourceProposalId: row.contenido?.propuesta_id ?? '',
    sourceRoundNumber: roundNumber,
    title: caseTitle,
    summary: embedded?.narrative ?? '',
    terms: toTerms(embedded?.meetingPoint ?? []),
    ...(fundamentacion === null ? {} : { rationale: fundamentacion }),
    estado: row.estado,
    createdAt: row.created_at,
    // readyAt/completedAt are set only when the corresponding transition really
    // happened. `fecha` is the acuerdo's own timestamp column, which the API
    // stamps when it moves to signature.
    ...(row.estado === 'borrador' || row.fecha === null ? {} : { readyAt: row.fecha }),
  };
}

const terminalEstados: readonly EstadoAcuerdo[] = ['firmado', 'con_aviso'];

/**
 * Signers are reported by usuario_id; the UI wants roles. The caller is
 * `authenticated_party`, everyone else collapses to `other_party` — the shared
 * shape deliberately carries no identifier for the counterparty.
 */
export function toAgreementState(
  agreement: SharedAgreement,
  firmas: ApiFirmaStatus[],
  callerId: string,
): AgreementState {
  const own = firmas.find((firma) => firma.usuario_id === callerId) ?? null;
  const others = firmas.filter((firma) => firma.usuario_id !== callerId);

  const ownStatus: MockSignatureStatus =
    own === null ? 'pendiente' : toSignatureStatus(own.docusign_status);
  // Both roles are always present, even before the server has created the
  // counterparty's firma row — the UI contract requires it and an omitted
  // signer would read as "nobody else needs to sign".
  const otherStatus: MockSignatureStatus =
    others.length > 0 && others.every((firma) => toSignatureStatus(firma.docusign_status) === 'firmado')
      ? 'firmado'
      : 'pendiente';

  const signers: SharedSignerStatus[] = [
    {
      role: 'authenticated_party',
      status: ownStatus,
      ...(own?.fecha_firma ? { signedAt: own.fecha_firma } : {}),
    },
    { role: 'other_party', status: otherStatus },
  ];

  const ownSignatureComplete = ownStatus === 'firmado';
  const allSignaturesComplete = ownSignatureComplete && otherStatus === 'firmado';
  const readOnly = terminalEstados.includes(agreement.estado);

  return {
    agreement: allSignaturesComplete
      ? { ...agreement, completedAt: agreement.readyAt ?? agreement.createdAt }
      : agreement,
    signers,
    ownSignatureComplete,
    waitingForOtherParty: ownSignatureComplete && !allSignaturesComplete,
    allSignaturesComplete,
    canPrepareDocument: agreement.estado === 'borrador',
    canSign: agreement.estado === 'enviado_a_firma' && !ownSignatureComplete && !readOnly,
    readOnly,
  };
}
