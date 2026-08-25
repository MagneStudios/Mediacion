import {
  codePlanLimitExceeded,
  codeQuotaExceeded,
  isApiError,
} from '../services/api/api-error';

/**
 * Which countable ran out. `casos` is what today's live `plan_limit_exceeded`
 * is about; `negociaciones` and `clientes` are the two counters of
 * `usage_counters` (Pactum spec §5.1). They are separated because the copy
 * differs — "no podés crear más casos" and "llegaste a las 20 altas de
 * clientes de este mes" are not the same sentence.
 */
export type QuotaResource = 'negociaciones' | 'clientes' | 'casos';

/**
 * What the server told us about the wall the user just hit.
 *
 * **Every field except the resource is nullable, and that is the normal case
 * today.** The limit error that actually exists (`403 plan_limit_exceeded`)
 * carries only a code and a message — no numbers. The richer `402
 * quota_exceeded` of the spec does not exist yet on the API. So this type is
 * built to render usefully with nothing but the code, and to get better on its
 * own the day BE starts sending the detail.
 */
export type QuotaLimit = {
  resource: QuotaResource;
  used: number | null;
  limit: number | null;
  /** ISO instant when the period rolls over and the counter resets. */
  periodEnd: string | null;
};

const resources: QuotaResource[] = ['negociaciones', 'clientes', 'casos'];

function readResource(value: unknown, fallback: QuotaResource): QuotaResource {
  return resources.includes(value as QuotaResource) ? (value as QuotaResource) : fallback;
}

/**
 * A count is only usable if it is a non-negative whole number. A float or a
 * negative would come from a bug on the wire, and "usaste 2.5 de 3" reads as a
 * broken product — better to fall back to the copy that carries no numbers.
 */
function readCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function readInstant(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

/**
 * Reads a plan-limit failure out of whatever `createCase` (or any other quota
 * consumer) rejected with. Returns `null` for anything that is not one — a
 * network drop, a 500, a validation error: those keep their retryable error
 * state, because retrying them can actually work.
 *
 * **A quota error is never retryable**, which is the whole reason it needs its
 * own branch. Offering "reintentar" for a limit that resets in three weeks is
 * the same mistake the public legal forms already fixed for `429` (see
 * `docs/tyc-contrato-frontend.md` §9.1): a button that cannot work reads as a
 * broken system, not as a full plan.
 */
export function getQuotaLimit(error: unknown): QuotaLimit | null {
  if (!isApiError(error)) {
    return null;
  }
  if (error.code === codeQuotaExceeded) {
    const detail = error.detail;
    return {
      // The flow limit counts negotiations unless it says otherwise; `recurso`
      // is what the spec's 402 body carries.
      resource: readResource(detail.recurso, 'negociaciones'),
      used: readCount(detail.usado),
      limit: readCount(detail.limite),
      periodEnd: readInstant(detail.period_end),
    };
  }
  if (error.code === codePlanLimitExceeded) {
    // The stock limit is about cases and carries no numbers today. If BE ever
    // adds them to this code too, they are read the same way.
    return {
      resource: readResource(error.detail.recurso, 'casos'),
      used: readCount(error.detail.usado),
      limit: readCount(error.detail.limite),
      periodEnd: readInstant(error.detail.period_end),
    };
  }
  return null;
}
