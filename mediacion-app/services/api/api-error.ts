/**
 * Every API failure arrives as `{ error: { code, message } }` (see
 * `apps/api/src/common/filters/all-exceptions.filter.ts`). Screens branch on
 * `code`, never on the human-facing `message`, so the wording can change
 * without breaking behaviour.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  /**
   * Everything the error envelope carried beyond `code` and `message`.
   *
   * Most errors carry nothing else, so this is usually `{}`. The quota error
   * does: it reports how much was used, of what limit, and until when
   * (`docs/plan-frontend-monetizacion.md` §4.2). Dropping those numbers here
   * would force the screen to ask a second endpoint for what the failure
   * already told it.
   *
   * Left as an untyped bag on purpose: this is the transport layer, and it
   * has no business knowing what billing means. Readers parse their own
   * shape out of it — see `utils/quota-limit.ts`.
   */
  readonly detail: Readonly<Record<string, unknown>>;

  constructor(
    code: string,
    message: string,
    status: number,
    detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/** The caller's Supabase user has no row in `public.usuarios` yet. */
export const codeUserNotProvisioned = 'user_not_provisioned';
export const codeUnauthorized = 'unauthorized';
export const codeNotFound = 'not_found';
export const codeCasoNotFound = 'caso_not_found';
export const codeAcuerdoNotFound = 'acuerdo_not_found';
export const codeMediacionNotFound = 'mediacion_not_found';
export const codeItemNotFound = 'item_not_found';
export const codePropuestaNotReady = 'propuesta_not_ready';
export const codePropuestaAlreadyExists = 'propuesta_already_exists';
export const codeBothPartiesRequired = 'both_parties_required';
export const codeInvalidToken = 'invalid_token';
export const codeNetworkUnavailable = 'network_unavailable';
/** R-04: an invitation token that existed but is past its TTL (72 h) — kept
 * distinct from `codeInvalidToken` so the join screen can show "this
 * invitation expired" instead of a generic "check the code" message. */
export const codeInvitationExpired = 'invitation_expired';
/**
 * C-01: el gate `trg_casos_gate_suscripciones` rechazó activar el caso porque
 * alguna de las dos partes no tiene suscripción activa
 * (`20260902120000_c01_gate_suscripciones.sql`, tipado en
 * `apps/api/src/common/db/pg-error.ts`).
 *
 * Se distingue del error genérico de `joinCase` por la misma razón que
 * `codeInvitationExpired`: reintentar no lo arregla, y "revisá el código" es
 * un consejo activamente equivocado — el código está bien, lo que falta es
 * una suscripción.
 */
export const codeCasoBloqueadoSuscripciones = 'caso_bloqueado_suscripciones';
/**
 * No published version of a legal document (`GET /legal/documentos/:tipo`).
 * A real, calm outcome — not a failure: the legal page renders its empty
 * state for it, so the backed service maps this code to `undefined` rather
 * than letting it surface as an error.
 */
export const codeLegalDocumentNotFound = 'legal_document_not_found';
/**
 * The per-IP limiter on the two public legal routes (`rate-limiter.ts`,
 * window configured by `LEGAL_PUBLIC_WINDOW_MS`). Distinct from a generic
 * failure on purpose: retrying immediately is guaranteed to fail again, so
 * the public forms say "esperá un momento" instead of offering a retry that
 * cannot work.
 */
export const codeTooManyRequests = 'too_many_requests';
/**
 * The caller has no subscription (`GET /suscripciones/vigente`), or has one
 * that is not theirs — BE answers 404 for both so an outsider cannot probe
 * which subscriptions exist. "No tengo plan" is a normal state of the Mi plan
 * screen, so the backed service maps this to `null` rather than an error.
 */
export const codeSuscripcionNotFound = 'suscripcion_not_found';
/**
 * The plan's period quota is spent (`consume_quota`, `P0002`) — the flow limit
 * of the Pactum spec §5.1: N negociaciones created per billing period.
 *
 * **Does not exist on the API yet.** `20260821120000_monetizacion_fase1.sql`
 * ships the function, but nothing in `apps/api` calls it
 * (`docs/plan-frontend-monetizacion.md` §0). The code is declared here so the
 * screen that has to react is written once and keeps working the day BE wires
 * it, instead of being retrofitted then.
 */
export const codeQuotaExceeded = 'quota_exceeded';
/**
 * The plan's case limit is reached (`PlanLimitService.assertCanCreateCase`,
 * `403`). This one **is** live today, and until this change nothing in the app
 * handled it: hitting your plan limit showed the generic error with a retry
 * button that could only fail again.
 *
 * It is a *stock* limit (simultaneous cases) where `quota_exceeded` is a *flow*
 * limit (created per period). The two coexist and nobody has decided which
 * governs case creation (`docs/plan-frontend-monetizacion.md` §1.4) — for the
 * user they are the same wall, so they get the same screen.
 */
export const codePlanLimitExceeded = 'plan_limit_exceeded';

const unknownErrorCode = 'internal_error';
const unknownErrorMessage = 'Unexpected error';

type ErrorEnvelope = { error?: Record<string, unknown> };

/**
 * A gateway or proxy can answer with HTML or an empty body, so the envelope is
 * treated as untrusted rather than assumed well formed.
 */
export function toApiError(status: number, body: unknown): ApiError {
  const envelope = (body ?? {}) as ErrorEnvelope;
  const error = typeof envelope.error === 'object' && envelope.error !== null ? envelope.error : {};
  const code = typeof error.code === 'string' ? error.code : unknownErrorCode;
  const message = typeof error.message === 'string' ? error.message : unknownErrorMessage;
  // The whole error object travels, `code` and `message` included: stripping
  // them would only cost a second lookup for a reader that already has the
  // typed fields, and keeping the bag intact means a field BE adds later
  // arrives without touching this function.
  return new ApiError(code, message, status, error);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function hasCode(error: unknown, code: string): boolean {
  return isApiError(error) && error.code === code;
}
