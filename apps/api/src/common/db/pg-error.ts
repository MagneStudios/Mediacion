import { ConflictError } from "../errors/domain-errors";

const uniqueViolationCode = "23505";
const triggerExceptionCode = "P0001";
const conflictCodes = new Set([uniqueViolationCode, triggerExceptionCode]);

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

export function toDomainError(error: unknown): Error {
  if (isPgError(error) && conflictCodes.has(error.code)) {
    return new ConflictError(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}
