import { ConflictError, QuotaExceededError } from "../errors/domain-errors";

const uniqueViolationCode = "23505";
const triggerExceptionCode = "P0001";
const quotaExceededCode = "P0002";
const conflictCodes = new Set([uniqueViolationCode, triggerExceptionCode]);

/**
 * Some triggers name their `RAISE EXCEPTION` with a leading `slug: texto`
 * (see `20260902120000_c01_gate_suscripciones.sql`,
 * `20260817120000_suscripcion_aceptacion_estudio.sql`) instead of a free-form
 * sentence. That prefix is deliberate — it's the trigger author picking a
 * stable name for the failure — but it is Postgres text all the same, and
 * nothing here should trust it just because it has the right shape.
 *
 * This map is the allowlist: a slug earns a spot only when someone decided a
 * caller genuinely needs to react to *this* conflict and not just "there was
 * one". A trigger message that doesn't match an entry here — including every
 * `P0001` before this map existed — falls through to the fully generic
 * `ConflictError`, exactly as before. Adding a trigger to this map is a
 * one-line decision, not a default.
 */
const knownTriggerConflicts: Record<string, { code: string; message: string }> =
  {
    caso_bloqueado_suscripciones: {
      code: "caso_bloqueado_suscripciones",
      message: "Both parties in the case need an active subscription",
    },
    /**
     * `consume_quota` no usa el prefijo `slug:`: nombra sus fallas con un
     * identificador en mayúsculas y nada más. Las dos entran acá porque el
     * llamador sí necesita distinguirlas — son la diferencia entre "elegí un
     * plan" y "algo quedó a medias en tu suscripción", y como conflicto
     * genérico la app solo podía decir "no pudimos crear el caso".
     */
    NO_ACTIVE_SUBSCRIPTION: {
      code: "no_active_subscription",
      message: "An active subscription is required",
    },
    NO_BILLING_PERIOD: {
      code: "no_billing_period",
      message: "The subscription has no billing period",
    },
  };

function isPgError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

/** The `slug` out of a `"slug: texto libre"` trigger message, or `null`. */
function triggerSlug(message: string): string | null {
  const match = /^([a-z][a-z0-9_]*):/.exec(message);
  return match ? match[1] : null;
}

/**
 * The whole message when it is nothing but a SCREAMING_SNAKE identifier, or
 * `null`. `consume_quota` names its failures that way instead of with the
 * `slug: texto` prefix, and both conventions are the same thing: a trigger
 * author picking a stable name. The allowlist above still decides which ones
 * mean anything to a caller — matching here only makes them lookup-able.
 */
function triggerSentinel(message: string): string | null {
  const match = /^([A-Z][A-Z0-9_]*)$/.exec(message.trim());
  return match ? match[1] : null;
}

export function toDomainError(error: unknown): Error {
  if (isPgError(error) && error.code === quotaExceededCode) {
    return new QuotaExceededError(null, error.message);
  }
  if (isPgError(error) && conflictCodes.has(error.code)) {
    const slug =
      error.code === triggerExceptionCode
        ? (triggerSlug(error.message) ?? triggerSentinel(error.message))
        : null;
    const known = slug !== null ? knownTriggerConflicts[slug] : undefined;
    if (known) {
      return new ConflictError(error.message, known.code, known.message);
    }
    return new ConflictError(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}
