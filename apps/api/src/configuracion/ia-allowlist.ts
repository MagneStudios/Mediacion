import { HttpException, HttpStatus } from "@nestjs/common";
import type { IaKey, UpdateIaConfigDto } from "./types";

export const IA_KEYS: IaKey[] = [
  "ia_modelo",
  "ia_temperature",
  "ia_max_tokens",
];

function invalidInput(message: string): HttpException {
  return new HttpException(
    { code: "invalid_input", message },
    HttpStatus.BAD_REQUEST,
  );
}

function assertKnownKeys(patch: Record<string, unknown>): void {
  const unknownKeys = Object.keys(patch).filter(
    (key) => !IA_KEYS.includes(key as IaKey),
  );
  if (unknownKeys.length > 0) {
    throw invalidInput(`Unsupported key(s): ${unknownKeys.join(", ")}`);
  }
}

function assertValidIaModelo(value: unknown): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidInput("ia_modelo must be a non-empty string");
  }
}

function assertValidIaTemperature(value: unknown): void {
  if (typeof value !== "number" || value < 0 || value > 2) {
    throw invalidInput("ia_temperature must be a number between 0 and 2");
  }
}

function assertValidIaMaxTokens(value: unknown): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw invalidInput("ia_max_tokens must be a positive integer");
  }
}

export function assertValidIaConfigPatch(patch: UpdateIaConfigDto): void {
  assertKnownKeys(patch as Record<string, unknown>);
  if (patch.ia_modelo !== undefined) {
    assertValidIaModelo(patch.ia_modelo);
  }
  if (patch.ia_temperature !== undefined) {
    assertValidIaTemperature(patch.ia_temperature);
  }
  if (patch.ia_max_tokens !== undefined) {
    assertValidIaMaxTokens(patch.ia_max_tokens);
  }
}
