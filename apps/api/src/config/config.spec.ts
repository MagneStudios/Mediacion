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

  it("throws when PORT is zero", () => {
    expect(() => loadConfig({ PORT: "0" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: 0",
    );
  });

  it("throws when PORT is negative", () => {
    expect(() => loadConfig({ PORT: "-1" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: -1",
    );
  });

  it("throws when PORT is a decimal number", () => {
    expect(() => loadConfig({ PORT: "3000.5" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: 3000.5",
    );
  });

  it("accepts PORT at the maximum valid boundary", () => {
    const appConfig = loadConfig({ PORT: "65535" });

    expect(appConfig.port).toBe(65535);
  });

  it("throws when PORT is one above the maximum boundary", () => {
    expect(() => loadConfig({ PORT: "65536" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: 65536",
    );
  });
});
