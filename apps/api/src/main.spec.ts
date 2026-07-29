import { applyCors, handleBootstrapFailure } from "./main";

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

describe("applyCors", () => {
  function createApp() {
    const calls: unknown[] = [];
    return {
      calls,
      app: { enableCors: (options: unknown) => calls.push(options) },
    };
  }

  it("does not enable cors when no origin is configured", () => {
    const { calls, app } = createApp();

    applyCors(app, []);

    expect(calls).toEqual([]);
  });

  it("allows the configured origins and the Authorization header", () => {
    const { calls, app } = createApp();

    applyCors(app, ["https://app.mediacion.io"]);

    expect(calls).toHaveLength(1);
    const options = calls[0] as { origin: unknown; allowedHeaders: string[] };
    expect(options.origin).toEqual(["https://app.mediacion.io"]);
    expect(options.allowedHeaders).toContain("Authorization");
  });

  it("passes the wildcard through as a bare string so any origin is reflected", () => {
    const { calls, app } = createApp();

    applyCors(app, ["*"]);

    expect((calls[0] as { origin: unknown }).origin).toBe("*");
  });

  it("does not enable credentials, because the api authenticates with bearer tokens", () => {
    const { calls, app } = createApp();

    applyCors(app, ["https://app.mediacion.io"]);

    expect((calls[0] as { credentials?: boolean }).credentials).toBe(false);
  });
});
