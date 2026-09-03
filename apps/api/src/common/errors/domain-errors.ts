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
