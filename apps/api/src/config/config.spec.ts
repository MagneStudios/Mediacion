import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("defaults the port to 3000 when PORT is not set", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.port).toBe(3000);
  });

  it("uses the PORT environment variable when set", () => {
    const appConfig = loadConfig({ NODE_ENV: "test", PORT: "4500" });

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
    const appConfig = loadConfig({ NODE_ENV: "test", PORT: "65535" });

    expect(appConfig.port).toBe(65535);
  });

  it("throws when PORT is one above the maximum boundary", () => {
    expect(() => loadConfig({ PORT: "65536" })).toThrow(
      "PORT must be a valid port number between 1 and 65535, received: 65536",
    );
  });

  it("throws in production when SUPABASE_JWT_SECRET is missing", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
      }),
    ).toThrow("SUPABASE_JWT_SECRET is required and must be non-empty");
  });

  it("throws in production when SUPABASE_JWT_SECRET is whitespace-only", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: " ",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
      }),
    ).toThrow("SUPABASE_JWT_SECRET is required and must be non-empty");
  });

  it("throws in production when DATABASE_URL is fully unset", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: "test-secret",
      }),
    ).toThrow(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  });

  it("throws in production when DATABASE_URL is malformed", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: "test-secret",
        DATABASE_URL: "not-a-url",
      }),
    ).toThrow(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  });

  it("uses safe placeholders when NODE_ENV is test and values are unset", () => {
    const appConfig = loadConfig({ NODE_ENV: "test" });

    expect(appConfig.supabaseJwtSecret).toBe("dev-placeholder-secret");
    expect(appConfig.databaseUrl).toBe(
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
    );
  });

  it("throws when NODE_ENV is unset and SUPABASE_JWT_SECRET is missing", () => {
    expect(() =>
      loadConfig({ DATABASE_URL: "postgresql://user:pass@host:5432/db" }),
    ).toThrow("SUPABASE_JWT_SECRET is required and must be non-empty");
  });

  it("throws when NODE_ENV is development and SUPABASE_JWT_SECRET is missing", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
      }),
    ).toThrow("SUPABASE_JWT_SECRET is required and must be non-empty");
  });

  it("throws when NODE_ENV is unset and DATABASE_URL is missing", () => {
    expect(() => loadConfig({ SUPABASE_JWT_SECRET: "test-secret" })).toThrow(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  });

  it("throws when NODE_ENV is development and DATABASE_URL is missing", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "development",
        SUPABASE_JWT_SECRET: "test-secret",
      }),
    ).toThrow(
      "DATABASE_URL must be a valid postgres:// or postgresql:// connection string",
    );
  });

  it("accepts explicit values outside production", () => {
    const appConfig = loadConfig({
      SUPABASE_JWT_SECRET: "my-secret",
      DATABASE_URL: "postgres://user:pass@host:5432/db",
    });

    expect(appConfig.supabaseJwtSecret).toBe("my-secret");
    expect(appConfig.databaseUrl).toBe("postgres://user:pass@host:5432/db");
  });
});
