import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * `detail` is the raw cause — a Postgres message, an internal note — and it
 * never reaches the response body. It only ever goes into `cause`, for logs
 * and stack traces. `code`/`message` are what callers actually see, and they
 * default to the fully generic pair: most conflicts (a unique-constraint hit,
 * a trigger nobody has reviewed yet) have nothing safe to say beyond "there
 * was a conflict". A caller that needs to react to a *specific* conflict
 * passes an explicit `code` — see `common/db/pg-error.ts` for the one
 * deliberate exception to "stay generic".
 */
export class ConflictError extends HttpException {
  constructor(detail: string, code = "conflict", message = "Conflict") {
    super({ code, message }, HttpStatus.CONFLICT, {
      cause: new Error(detail),
    });
  }
}

export type QuotaRecurso = "negociaciones" | "clientes";

export type QuotaExceededDetail = {
  recurso: QuotaRecurso;
  usado: number;
  limite: number;
  period_end: string;
};

export const quotaExceededCode = "quota_exceeded";
export const quotaExceededMessage = "Quota exceeded for this period";

export class QuotaExceededError extends HttpException {
  constructor(
    detail: QuotaExceededDetail | null = null,
    cause = "quota exceeded",
  ) {
    super(
      { code: quotaExceededCode, message: quotaExceededMessage, ...detail },
      HttpStatus.PAYMENT_REQUIRED,
      { cause: new Error(cause) },
    );
  }
}
