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
