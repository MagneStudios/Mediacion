import { HttpException, HttpStatus } from "@nestjs/common";
import { ConflictError } from "./domain-errors";

describe("ConflictError", () => {
  it("is an HttpException carrying HTTP 409 and the uniform error body", () => {
    const error = new ConflictError(
      "duplicate key value violates constraint x",
    );

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.getResponse()).toEqual({
      code: "conflict",
      message: "Conflict",
    });
  });

  it("never exposes the raw detail passed to it in the response body", () => {
    const error = new ConflictError(
      'duplicate key value violates unique constraint "caso_partes_caso_id_usuario_id_key"',
    );

    const response = JSON.stringify(error.getResponse());

    expect(response).not.toContain("caso_partes_caso_id_usuario_id_key");
  });
});
