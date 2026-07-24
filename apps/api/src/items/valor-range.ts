import { HttpException, HttpStatus } from "@nestjs/common";

function parseNumeric(value: string | null | undefined): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function assertValidRange(
  valorMin: string | null | undefined,
  valorMax: string | null | undefined,
): void {
  const min = parseNumeric(valorMin);
  const max = parseNumeric(valorMax);
  if (min !== undefined && max !== undefined && min > max) {
    throw new HttpException(
      { code: "invalid_input", message: "valor_min must be <= valor_max" },
      HttpStatus.BAD_REQUEST,
    );
  }
}
