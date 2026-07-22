import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("defaults the port to 3000 when PORT is not set", () => {
    const appConfig = loadConfig({});

    expect(appConfig.port).toBe(3000);
  });

  it("uses the PORT environment variable when set", () => {
    const appConfig = loadConfig({ PORT: "4500" });

    expect(appConfig.port).toBe(4500);
  });

  it("throws when PORT is not a valid number", () => {
    expect(() => loadConfig({ PORT: "not-a-number" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: not-a-number",
    );
  });

  it("throws when PORT is out of range", () => {
    expect(() => loadConfig({ PORT: "70000" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: 70000",
    );
  });
});
