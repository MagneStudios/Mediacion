/**
 * Domain types for the legal module (TyC + Privacidad, instructivo Golosetti).
 *
 * These mirror the *agreed* shape of the future `legal_documents` /
 * `user_agreements` tables (`docs/reparto-tyc-devs.md` §05 — "contratos
 * congelados"), which do not exist in the schema yet. They are deliberately
 * standalone, like every other type in this folder — no import from
 * `packages/db-types` — so the app keeps compiling while DB lands theirs.
 */

/** Documents that have a full versioned text of their own. */
export type LegalDocumentType = 'terms' | 'privacy';

/**
 * Everything an acceptance row can be about. `marketing` has no document
 * text — it is the optional comms opt-in, stored as its own row (instructivo
 * §3: "Qué se aceptó: Términos, Privacidad, marketing. Cada uno como un
 * registro distinto").
 */
export type ConsentType = LegalDocumentType | 'marketing';

/**
 * One frozen version of a legal document, as the future `legal_documents`
 * row. `contenido` is the full text — the page renders from data, never from
 * JSX (instructivo error #4).
 */
export type LegalDocument = {
  tipo: LegalDocumentType;
  /** 'v1.0', 'v1.1', 'v2.0' … */
  version: string;
  /** Full normalized text. "## X. TITLE" lines are section headings. */
  contenido: string;
  /** ISO timestamp. The visible "última actualización" date comes from here. */
  validFrom: string;
  /** ISO timestamp, null while the version is the current one. */
  validTo: string | null;
  /** Substantial changes force a blocking re-acceptance (instructivo §4.9). */
  isSubstantial: boolean;
  /** Plain-language summary of what changed vs the previous version. */
  resumenCambios: string | null;
};

/** What the re-acceptance gate needs to decide whether to block. */
export type AcceptanceStatus = {
  /** Document types whose current version this user has not accepted. */
  pendientes: LegalDocumentType[];
  /**
   * True when at least one pending version is substantial — the UI must then
   * block until the user re-accepts (instructivo §4.9).
   */
  requiereReaceptacion: boolean;
};

/**
 * What the client sends when registering an acceptance. Deliberately tiny:
 * IP, user agent, timestamp and document version are resolved SERVER-side
 * from the request (instructivo error #3 — client-supplied proof is
 * forgeable and worthless). The only client-owned fact is the optional
 * marketing opt-in.
 */
export type AcceptanceInput = {
  /**
   * The optional comms checkbox. `false` is also recorded, as its own row.
   * Omitted entirely on re-acceptance of a new version — that flow must not
   * silently rewrite a marketing choice the user already made.
   */
  marketing?: boolean;
};

/** Botón de arrepentimiento (Res. 424/2020) — reachable without a session. */
export type WithdrawalRequestInput = {
  nombre: string;
  email: string;
  /** Free-text description of the purchase being revoked. */
  detalle: string;
};

/**
 * Canal de contacto (instructivo §5, punto #23) — also reachable without a
 * session. Separate from the withdrawal request: this one is the general
 * support channel with a declared response time, not a revocation.
 */
export type ContactRequestInput = {
  nombre: string;
  email: string;
  mensaje: string;
};

/**
 * Acknowledgement for a public request. Mirrors BE's `SolicitudReceipt`
 * (`apps/api/src/legal/legal.types.ts`) — both `/legal/arrepentimiento` and
 * `/legal/contacto` answer with this same shape.
 */
export type SolicitudReceipt = {
  /** Tracking code the user can quote in a follow-up: `ARR-0001`, `CON-0001`. */
  id: string;
  /** ISO timestamp assigned by the server. */
  receivedAt: string;
};

export type WithdrawalRequestResult = SolicitudReceipt;
export type ContactRequestResult = SolicitudReceipt;

/**
 * Datos societarios (Ley 24.240 / instructivo §5). Values are `null` until
 * Administración provides them — the UI shows the pending state instead of
 * inventing data.
 */
export type CompanyInfo = {
  razonSocial: string | null;
  cuit: string | null;
  domicilio: string | null;
  /** Canal de contacto real, con plazo de respuesta declarado. */
  emailContacto: string | null;
  plazoRespuestaDias: number;
};
