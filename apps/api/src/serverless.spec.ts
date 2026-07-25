import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { getServerlessApp } from "./serverless";

jest.mock("@nestjs/core", () => ({
  NestFactory: { create: jest.fn() },
}));

const createMock = NestFactory.create as jest.Mock;

type FakeApp = {
  init: jest.Mock;
  getHttpAdapter: () => { getInstance: () => unknown };
};

function buildFakeApp(expressInstance: unknown): FakeApp {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    getHttpAdapter: () => ({ getInstance: () => expressInstance }),
  };
}

describe("getServerlessApp", () => {
  const expressInstance = { handler: true };

  beforeEach(() => {
    createMock.mockReset();
  });

  it("does not cache a failed bootstrap and re-attempts on the next call", async () => {
    const firstError = new Error("boot failed once");
    const secondError = new Error("boot failed twice");
    createMock
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(secondError);

    await expect(getServerlessApp()).rejects.toBe(firstError);
    await expect(getServerlessApp()).rejects.toBe(secondError);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("bootstraps the AppModule with rawBody enabled, initializes it, and returns the express instance", async () => {
    const fakeApp = buildFakeApp(expressInstance);
    createMock.mockResolvedValue(fakeApp);

    const app = await getServerlessApp();

    expect(createMock).toHaveBeenCalledWith(AppModule, { rawBody: true });
    expect(fakeApp.init).toHaveBeenCalledTimes(1);
    expect(app).toBe(expressInstance);
  });

  it("reuses the cached app on later calls without bootstrapping again", async () => {
    const [first, second, third] = await Promise.all([
      getServerlessApp(),
      getServerlessApp(),
      getServerlessApp(),
    ]);

    expect(first).toBe(expressInstance);
    expect(second).toBe(expressInstance);
    expect(third).toBe(expressInstance);
    expect(createMock).not.toHaveBeenCalled();
  });
});
