import { buildInitialAgreements, buildInitialHistory, buildInitialSigners } from '../mocks/agreements';
import { mockCaseDetails } from '../mocks/cases';
import type { AgreementHistoryEventKey, AgreementHistoryItem, SharedAgreement, SharedSignerStatus } from '../types/agreement';
import type { SharedProposal } from '../types/negotiation';
import { generateMockAgreementId, generateMockHistoryId } from '../utils/mock-id';

/**
 * El store en memoria de los acuerdos del mock, separado del servicio.
 *
 * Existe por un ciclo que no se puede cerrar de otra forma: `agreements.
 * service.ts` importa `negotiationService` (para saber qué propuesta se
 * aceptó), y `negotiation.service.ts` necesita leer el acuerdo vigente de
 * cada negociación para responder `listNegotiations`. Los dos leen y escriben
 * **el mismo array** a través de este módulo, que no importa a ninguno.
 *
 * Mismo alcance que antes: en memoria, se pierde al reiniciar, nunca se
 * escribe a disco ni se loguea. Y la misma frontera de privacidad — nada de
 * lo que hay acá se construye a partir de una posición privada.
 */

/** In-memory only — cleared on app restart, never written to disk, never logged. */
export const mockAgreements: SharedAgreement[] = buildInitialAgreements();
export const mockSigners: Record<string, SharedSignerStatus[]> = buildInitialSigners();
export const mockHistory: Record<string, AgreementHistoryItem[]> = buildInitialHistory();

/**
 * `acuerdos.version`, por id. El dominio (`SharedAgreement`) no la lleva: la
 * pantalla de acuerdo no la muestra y sumarla ahí sería cargar un campo por
 * un solo lector. La lista de negociaciones sí la necesita, porque es lo que
 * distingue el borrador de una renegociación del acuerdo que reemplazó.
 */
const mockAgreementVersions: Record<string, number> = {};

/**
 * The engine produces no agreement title, so the round it came from is the
 * only honest label. Not localized here: the real agreements service will read
 * `acuerdos.contenido` from the API instead of building this string.
 */
const agreementTitlePrefix = 'Acuerdo — Ronda';

export function getAgreementForCase(caseId: string): SharedAgreement | undefined {
  return mockAgreements.find((agreement) => agreement.caseId === caseId);
}

export function getAgreementById(agreementId: string): SharedAgreement | undefined {
  return mockAgreements.find((agreement) => agreement.id === agreementId);
}

export function getSigners(agreementId: string): SharedSignerStatus[] {
  return mockSigners[agreementId] ?? [];
}

export function getAgreementVersion(agreementId: string): number {
  return mockAgreementVersions[agreementId] ?? 1;
}

export function appendHistory(
  agreementId: string,
  eventKey: AgreementHistoryEventKey,
  status: SharedAgreement['estado'],
  timestamp?: string,
): void {
  const list = mockHistory[agreementId] ?? (mockHistory[agreementId] = []);
  list.push({ id: generateMockHistoryId(), eventKey, timestamp: timestamp ?? new Date().toISOString(), status });
}

/**
 * Deterministic mock materialization: an agreement only ever comes into
 * existence here, the first time it's needed for a case — and only ever from
 * a genuinely accepted shared proposal, which the caller already fetched.
 * Idempotent: repeated calls for the same case return the same agreement,
 * never a duplicate. A negative lookup never mutates anything.
 *
 * Synchronous on purpose: with the proposal in hand there is nothing to
 * await, and that is what keeps two callers from racing each other.
 */
export function materializeFromAcceptedProposal(caseId: string, accepted: SharedProposal): SharedAgreement | null {
  const existing = getAgreementForCase(caseId);
  if (existing) return existing;

  // 1. Validate case existence.
  if (!mockCaseDetails[caseId]) return null;

  // 2 & 3. The only "eligibility" gate is a genuinely accepted proposal —
  // never nuevo, never activo/en_negociacion without joint acceptance,
  // never a terminal state without one either.
  if (accepted.estado !== 'aceptada' || accepted.caseId !== caseId) {
    // 4/5/6. No accepted shared proposal — never invent agreement content.
    return null;
  }

  // 7. Build the complete next object first…
  const now = new Date().toISOString();
  const agreement: SharedAgreement = {
    id: generateMockAgreementId(),
    caseId,
    sourceProposalId: accepted.id,
    sourceRoundNumber: accepted.roundNumber,
    title: `${agreementTitlePrefix} ${accepted.roundNumber}`,
    // The agreed content IS the meeting point the parties accepted — the
    // agreement invents nothing the proposal did not already contain.
    summary: accepted.narrative ?? '',
    terms: accepted.meetingPoint.map((entry) => ({
      id: `${accepted.id}-${entry.categoria}`,
      title: entry.categoria,
      description: entry.punto === null ? entry.estado : String(entry.punto),
    })),
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
}

/**
 * Lo que hace `POST /negociaciones/:id/renegociar` del lado del acuerdo: el
 * vigente deja de serlo y nace el borrador siguiente, `version + 1`, con el
 * contenido del anterior como punto de partida.
 *
 * El mock **reemplaza** en vez de conservar: `SharedAgreement` no tiene
 * `vigente`, y dejar los dos en el array haría que `getAgreementForCase`
 * devolviera el viejo. El real sigue accesible por `GET /acuerdos/:id`; acá
 * no hay quién lo pida.
 */
export function supersedeWithDraft(agreementId: string): SharedAgreement {
  const index = mockAgreements.findIndex((agreement) => agreement.id === agreementId);
  if (index === -1) {
    throw new Error(`mock agreement ${agreementId} not found`);
  }
  const previous = mockAgreements[index];
  const now = new Date().toISOString();
  const draft: SharedAgreement = {
    ...previous,
    id: generateMockAgreementId(),
    estado: 'borrador',
    createdAt: now,
    readyAt: undefined,
    completedAt: undefined,
  };
  mockAgreements[index] = draft;
  mockSigners[draft.id] = [
    { role: 'authenticated_party', status: 'pendiente' },
    { role: 'other_party', status: 'pendiente' },
  ];
  mockAgreementVersions[draft.id] = getAgreementVersion(previous.id) + 1;
  appendHistory(draft.id, 'agreement_created', 'borrador', now);
  return draft;
}
