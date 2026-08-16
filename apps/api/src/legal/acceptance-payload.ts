import { HttpException, HttpStatus } from "@nestjs/common";
import type { AceptacionDto } from "./legal.types";

const allowedKeys = new Set(["marketing"]);

function invalidInput(message: string): HttpException {
  return new HttpException(
    { code: "invalid_input", message },
    HttpStatus.BAD_REQUEST,
  );
}

export function assertValidAcceptanceBody(body: unknown): AceptacionDto {
  if (body === undefined || body === null) {
    return {};
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    return {};
  }
  const entries = Object.entries(body as Record<string, unknown>);
  const rejected = entries
    .map(([key]) => key)
    .filter((key) => !allowedKeys.has(key));
  if (rejected.length > 0) {
    throw invalidInput(
      `the acceptance payload accepts only marketing, received: ${rejected.join(", ")}`,
    );
  }
  const marketing = (body as AceptacionDto).marketing;
  if (marketing === undefined) {
    return {};
  }
  if (typeof marketing !== "boolean") {
    throw invalidInput("marketing must be a boolean");
  }
  return { marketing };
}
