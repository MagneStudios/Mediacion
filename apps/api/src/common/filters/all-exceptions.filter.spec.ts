import type { ArgumentsHost } from "@nestjs/common";
import {
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConflictError, QuotaExceededError } from "../errors/domain-errors";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function createHost(): {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe("AllExceptionsFilter", () => {
  it("renders an HttpException as {error:{code,message}}", () => {
    const filter = new AllExceptionsFilter();
    const { host, json, status } = createHost();

    filter.catch(
      new HttpException("Invalid token", HttpStatus.UNAUTHORIZED),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({
      error: { code: "unauthorized", message: "Invalid token" },
    });
  });

  it("renders a custom code from the exception response when present", () => {
    const filter = new AllExceptionsFilter();
    const { host, json, status } = createHost();

    filter.catch(
      new HttpException(
        { code: "user_not_provisioned", message: "User is not provisioned" },
        HttpStatus.UNAUTHORIZED,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "user_not_provisioned",
        message: "User is not provisioned",
      },
    });
  });

  it("passes the extra fields of an object body through inside the envelope (402 quota detail)", () => {
    const filter = new AllExceptionsFilter();
    const { host, json, status } = createHost();

    filter.catch(
      new QuotaExceededError({
        recurso: "negociaciones",
        usado: 3,
        limite: 3,
        period_end: "2026-10-03T12:00:00.000Z",
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.PAYMENT_REQUIRED);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "quota_exceeded",
        message: "Quota exceeded for this period",
        recurso: "negociaciones",
        usado: 3,
        limite: 3,
        period_end: "2026-10-03T12:00:00.000Z",
      },
    });
  });

  it("renders the 403 plan_limit_exceeded detail with the same envelope extension", () => {
    const filter = new AllExceptionsFilter();
    const { host, json } = createHost();

    filter.catch(
      new HttpException(
        {
          code: "plan_limit_exceeded",
          message: "Plan case limit reached",
          recurso: "casos",
          usado: 5,
          limite: 5,
        },
        HttpStatus.FORBIDDEN,
      ),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      error: {
        code: "plan_limit_exceeded",
        message: "Plan case limit reached",
        recurso: "casos",
        usado: 5,
        limite: 5,
      },
    });
  });

  it("ignores an array-shaped exception response instead of leaking numeric-index keys", () => {
    const filter = new AllExceptionsFilter();
    const { host, json } = createHost();

    filter.catch(
      new HttpException(["field is required"], HttpStatus.BAD_REQUEST),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      error: { code: "bad_request", message: "Http Exception" },
    });
  });

  it("never lets statusCode travel in the envelope", () => {
    const filter = new AllExceptionsFilter();
    const { host, json } = createHost();

    filter.catch(
      new HttpException(
        { code: "invalid_input", message: "bad", statusCode: 400 },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      error: { code: "invalid_input", message: "bad" },
    });
  });

  it.each([
    [
      "a built-in UnauthorizedException (the guard's 401)",
      new UnauthorizedException("Missing bearer token"),
      HttpStatus.UNAUTHORIZED,
      { code: "unauthorized", message: "Missing bearer token" },
    ],
    [
      "a built-in NotFoundException (unknown route)",
      new NotFoundException("Cannot GET /nada"),
      HttpStatus.NOT_FOUND,
      { code: "not_found", message: "Cannot GET /nada" },
    ],
    [
      "a 404 with a custom code",
      new HttpException(
        { code: "suscripcion_not_found", message: "Suscripcion not found" },
        HttpStatus.NOT_FOUND,
      ),
      HttpStatus.NOT_FOUND,
      { code: "suscripcion_not_found", message: "Suscripcion not found" },
    ],
    [
      "a ConflictError",
      new ConflictError("raw pg detail"),
      HttpStatus.CONFLICT,
      { code: "conflict", message: "Conflict" },
    ],
  ])(
    "keeps the envelope of %s exactly {code, message}",
    (_case, exception, expectedStatus, expectedError) => {
      const filter = new AllExceptionsFilter();
      const { host, json, status } = createHost();

      filter.catch(exception, host);

      expect(status).toHaveBeenCalledWith(expectedStatus);
      expect(json).toHaveBeenCalledWith({ error: expectedError });
    },
  );

  it("renders an unknown error as a generic 500 with no leaked detail", () => {
    const filter = new AllExceptionsFilter();
    const { host, json, status } = createHost();

    filter.catch(new Error("database connection string leaked"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      error: { code: "internal_error", message: "Internal server error" },
    });
  });

  it("logs the message and stack when an unknown error is caught", () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const filter = new AllExceptionsFilter();
    const { host } = createHost();
    const unknownError = new Error("database connection string leaked");

    filter.catch(unknownError, host);

    expect(errorSpy).toHaveBeenCalledWith(
      unknownError.message,
      unknownError.stack,
    );

    errorSpy.mockRestore();
  });

  it("does not log HttpException responses", () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const filter = new AllExceptionsFilter();
    const { host } = createHost();

    filter.catch(
      new HttpException("Invalid token", HttpStatus.UNAUTHORIZED),
      host,
    );

    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
