import { handleBootstrapFailure } from "./main";

describe("handleBootstrapFailure", () => {
  it("logs the error and exits with code 1", () => {
    const loggedErrors: unknown[] = [];
    const exitCodes: number[] = [];
    const bootstrapError = new Error("cannot bind port");

    handleBootstrapFailure(bootstrapError, {
      logError: (error) => loggedErrors.push(error),
      exitProcess: (code) => exitCodes.push(code),
    });

    expect(loggedErrors).toEqual([bootstrapError]);
    expect(exitCodes).toEqual([1]);
  });

  it("exits with code 1 regardless of the error value received", () => {
    const loggedErrors: unknown[] = [];
    const exitCodes: number[] = [];
    const bootstrapError = "unexpected string rejection";

    handleBootstrapFailure(bootstrapError, {
      logError: (error) => loggedErrors.push(error),
      exitProcess: (code) => exitCodes.push(code),
    });

    expect(loggedErrors).toEqual([bootstrapError]);
    expect(exitCodes).toEqual([1]);
  });
});
