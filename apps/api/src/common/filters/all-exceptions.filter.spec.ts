import type { ArgumentsHost } from "@nestjs/common";
import { HttpException, HttpStatus, Logger } from "@nestjs/common";
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
