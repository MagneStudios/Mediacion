import { HttpStatus } from "@nestjs/common";
import { ConflictError } from "../errors/domain-errors";
import { toDomainError } from "./pg-error";

describe("toDomainError", () => {
  it("maps a unique-violation pg error to a 409 ConflictError with no leaked db detail", () => {
    const pgError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "casos_pkey"',
    };

    const result = toDomainError(pgError) as ConflictError;

    expect(result).toBeInstanceOf(ConflictError);
    expect(result.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(result.getResponse()).toEqual({
      code: "conflict",
      message: "Conflict",
    });
  });

  it("maps a trigger EXCEPTION pg error to a 409 ConflictError with no leaked db detail", () => {
    const pgError = { code: "P0001", message: "invalid transition" };

    const result = toDomainError(pgError) as ConflictError;

    expect(result).toBeInstanceOf(ConflictError);
    expect(result.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(result.getResponse()).toEqual({
      code: "conflict",
      message: "Conflict",
    });
  });

  it("maps a known trigger slug to its own typed conflict code (C-01)", () => {
    const pgError = {
      code: "P0001",
      message:
        "caso_bloqueado_suscripciones: ambas partes deben tener suscripción activa",
    };

    const result = toDomainError(pgError) as ConflictError;

    expect(result).toBeInstanceOf(ConflictError);
    expect(result.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(result.getResponse()).toEqual({
      code: "caso_bloqueado_suscripciones",
      message: "Both parties in the case need an active subscription",
    });
  });

  it("never leaks the raw Postgres message for a known trigger slug either", () => {
    const pgError = {
      code: "P0001",
      message:
        "caso_bloqueado_suscripciones: ambas partes deben tener suscripción activa",
    };

    const result = toDomainError(pgError) as ConflictError;
    const response = JSON.stringify(result.getResponse());

    expect(response).not.toContain("ambas partes");
  });

  it("falls back to the generic conflict for a slug nobody has reviewed yet", () => {
    // Tiene la forma "slug: texto" de un trigger deliberado, pero no está en
    // el allowlist. Sumar un trigger al mapa es una decisión explícita, no
    // algo que un slug con buena pinta debería ganarse solo.
    const pgError = {
      code: "P0001",
      message: "algun_otro_trigger: todavía no lo revisamos",
    };

    const result = toDomainError(pgError) as ConflictError;

    expect(result.getResponse()).toEqual({
      code: "conflict",
      message: "Conflict",
    });
  });

  it("passes through any other error unchanged", () => {
    const originalError = new Error("connection refused");

    const result = toDomainError(originalError);

    expect(result).toBe(originalError);
  });

  it("wraps a non-error unknown value", () => {
    const result = toDomainError("boom");

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("boom");
  });

  it("does not treat a code-only shape without a string message as a pg error", () => {
    const malformed = { code: "23505" };

    const result = toDomainError(malformed);

    expect(result).not.toBeInstanceOf(ConflictError);
    expect(result).toBeInstanceOf(Error);
  });
});
