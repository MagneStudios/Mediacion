import { mockCompanyInfo, mockLegalDocuments } from '../mocks/legal';
import { createBackedLegalService } from './api/legal.backed-service';
import { backend } from './backend-instance';
import type {
  AcceptanceInput,
  AcceptanceStatus,
  CompanyInfo,
  ContactRequestInput,
  ContactRequestResult,
  LegalDocument,
  LegalDocumentType,
  WithdrawalRequestInput,
  WithdrawalRequestResult,
} from '../types/legal';

import { createFailureController, delay, rejectAfter } from './mock-utils';

/**
 * Legal module (TyC + Privacidad — instructivo Golosetti, reparto
 * `docs/reparto-tyc-devs.md`).
 *
 * **Live as of 16/08/2026.** DB landed the schema
 * (`supabase/migrations/20260814170000_tyc_legal.sql`) and BE published the
 * ficha of every function (`docs/fichas-legal-backend.md`), so the singleton
 * at the bottom of this file now resolves to the real API whenever a backend
 * is configured. The mock below stays as the offline/demo implementation —
 * same role it has in `plans.service.ts` — and is what the tests exercise.
 *
 * The contract, unchanged from `docs/tyc-contrato-frontend.md` §3 and
 * confirmed by BE without deviation:
 * - `GET  /legal/documentos/:tipo`      → current version + `valid_from`;
 *   `404 legal_document_not_found` when nothing is published (the backed
 *   service maps it to `undefined`, which is this mock's empty answer too)
 * - `POST /legal/aceptaciones`          → body `{ marketing?: boolean }` ONLY.
 *   IP, user agent, timestamp and version are read from the request
 *   server-side (instructivo error #3: client-supplied proof is forgeable);
 *   the API rejects any extra key with 400. The DB trigger — not this call,
 *   not any checkbox — is what guarantees "no contratás sin aceptar".
 * - `GET  /legal/aceptaciones/vigente`  → what's pending, for the gate
 * - `POST /legal/arrepentimiento`       → public, no session (Res. 424/2020)
 * - `POST /legal/contacto`              → public, canal de contacto (#23)
 *
 * `getCompanyInfo` has no endpoint on either side: the datos societarios are
 * still pending from Administración, so both implementations serve the same
 * all-null record and the UI says so out loud.
 */
export type LegalService = {
  getCurrentDocument(tipo: LegalDocumentType): Promise<LegalDocument | undefined>;
  /**
   * The version scheduled to take effect but not yet in force — the symmetric
   * read of `getCurrentDocument`, and the only source the 10-day in-product
   * notice banner can be fed from (instructivo §4.8, reparto FE #16).
   *
   * `undefined` is the normal answer almost all the time: there is usually no
   * publication pending. The API says so with
   * `404 legal_document_not_found`, the same code and the same meaning as its
   * sibling endpoint.
   */
  getScheduledDocument(tipo: LegalDocumentType): Promise<LegalDocument | undefined>;
  registerAcceptance(input: AcceptanceInput): Promise<void>;
  getAcceptanceStatus(): Promise<AcceptanceStatus>;
  requestWithdrawal(input: WithdrawalRequestInput): Promise<WithdrawalRequestResult>;
  requestContact(input: ContactRequestInput): Promise<ContactRequestResult>;
  getCompanyInfo(): Promise<CompanyInfo>;
};

type FailableOperation =
  | 'getCurrentDocument'
  | 'getScheduledDocument'
  | 'registerAcceptance'
  | 'requestWithdrawal'
  | 'requestContact';

const failures = createFailureController<FailableOperation>();

export function __mockForceLegalFailure(operation: FailableOperation): void {
  failures.force(operation);
}

/** In-memory only — mirrors what the append-only `user_agreements` rows would record. */
let acceptedTypes: Set<LegalDocumentType> = new Set();

/** Test-only: back to "nothing accepted yet". Never imported by a screen. */
export function __resetMockLegalState(): void {
  acceptedTypes = new Set();
}

/** Trailing counter formatted the way BE's trigger does: `ARR-0001`. */
function formatSolicitudCode(prefix: string, counter: number): string {
  return `${prefix}-${String(counter).padStart(4, '0')}`;
}

/**
 * "In force right now", matching `LegalRepository.findVigente` exactly:
 * `valid_from <= now AND (valid_to IS NULL OR valid_to > now)`.
 *
 * The `valid_from` half is not decorative. Publishing a version schedules it
 * ahead of time — the aviso job looks for rows with `valid_from > now()` and
 * mails users the required 10 days in advance — so a mock that only checked
 * `valid_to === null` would show the new text the moment it is seeded, days
 * before it legally applies. That is the one scenario this whole flow exists
 * to get right.
 */
function isVigente(doc: LegalDocument, now: number): boolean {
  const from = doc.validFrom ? Date.parse(doc.validFrom) : Number.NaN;
  if (Number.isNaN(from) || from > now) {
    return false;
  }
  if (doc.validTo === null) {
    return true;
  }
  const to = Date.parse(doc.validTo);
  return Number.isNaN(to) ? false : to > now;
}

/**
 * "Published but not in force yet", matching `LegalRepository.findProgramada`:
 * `valid_from > now`. A document with an unusable `validFrom` is not scheduled
 * — announcing a change without a date is worse than not announcing it.
 */
function isProgramada(doc: LegalDocument, now: number): boolean {
  const from = doc.validFrom ? Date.parse(doc.validFrom) : Number.NaN;
  return !Number.isNaN(from) && from > now;
}

// Mirror BE's per-table sequences: `ARR-0001…` and `CON-0001…` are generated
// by their own triggers, so they never share a counter.
let withdrawalCounter = 0;
let contactCounter = 0;

export function createMockLegalService(): LegalService {
  return {
    async getCurrentDocument(tipo) {
      if (failures.consume('getCurrentDocument')) {
        return rejectAfter('mock_get_legal_document_failed', 400);
      }
      const now = Date.now();
      const current = mockLegalDocuments.find((doc) => doc.tipo === tipo && isVigente(doc, now));
      return delay(current, 400);
    },

    async getScheduledDocument(tipo) {
      if (failures.consume('getScheduledDocument')) {
        return rejectAfter('mock_get_scheduled_legal_document_failed', 400);
      }
      const now = Date.now();
      // The mirror of `isVigente`'s first half: a version is "scheduled" while
      // its `validFrom` is still in the future. With today's mock data (v1.0,
      // published in the past) there is none, so the banner never shows —
      // exactly like production until someone publishes ahead of time.
      const scheduled = mockLegalDocuments
        .filter((doc) => doc.tipo === tipo && isProgramada(doc, now))
        .sort((first, second) => Date.parse(first.validFrom ?? '') - Date.parse(second.validFrom ?? ''));
      return delay(scheduled[0], 400);
    },

    async registerAcceptance(_input) {
      if (failures.consume('registerAcceptance')) {
        return rejectAfter('mock_register_acceptance_failed', 500);
      }
      // The marketing opt-in (true or false) would be its own row too; the
      // mock only tracks what the gate reads back.
      await delay(undefined, 400);
      acceptedTypes = new Set(['terms', 'privacy']);
    },

    async getAcceptanceStatus() {
      const now = Date.now();
      // Only versions already in force can be pending: a scheduled one is
      // not something the user can fail to have accepted yet.
      const vigentes = mockLegalDocuments.filter((doc) => isVigente(doc, now));
      const pendientes = vigentes
        .filter((doc) => !acceptedTypes.has(doc.tipo))
        .map((doc) => doc.tipo);
      const requiereReaceptacion = vigentes.some(
        (doc) => doc.isSubstantial && !acceptedTypes.has(doc.tipo),
      );
      return delay({ pendientes, requiereReaceptacion }, 300);
    },

    async requestWithdrawal(input) {
      if (failures.consume('requestWithdrawal')) {
        return rejectAfter('mock_request_withdrawal_failed', 500);
      }
      if (!input.nombre.trim() || !input.email.trim() || !input.detalle.trim()) {
        return rejectAfter('withdrawal_missing_fields', 300);
      }
      withdrawalCounter += 1;
      return delay(
        {
          // Uppercase to match BE's trigger (`'ARR-' || lpad(...)`), so the
          // tracking code a user reads in the demo has the same shape as the
          // one they would quote in a real follow-up.
          id: formatSolicitudCode('ARR', withdrawalCounter),
          receivedAt: new Date().toISOString(),
        },
        600,
      );
    },

    async requestContact(input) {
      if (failures.consume('requestContact')) {
        return rejectAfter('mock_request_contact_failed', 500);
      }
      if (!input.nombre.trim() || !input.email.trim() || !input.mensaje.trim()) {
        return rejectAfter('contact_missing_fields', 300);
      }
      contactCounter += 1;
      return delay(
        { id: formatSolicitudCode('CON', contactCounter), receivedAt: new Date().toISOString() },
        600,
      );
    },

    async getCompanyInfo() {
      return delay(mockCompanyInfo, 200);
    },
  };
}

/**
 * Default instance consumed by the legal screens and checkboxes — the real
 * API when one is configured, the mock otherwise (same selection idiom as
 * `profile.service.ts` and `cases.service.ts`).
 */
export const legalService: LegalService = backend
  ? createBackedLegalService(backend.legal)
  : createMockLegalService();
