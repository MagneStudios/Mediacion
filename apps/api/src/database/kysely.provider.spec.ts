import type { AppConfig } from "../config/config";
import { APP_CONFIG } from "../config/config.tokens";
import { kyselyProvider } from "./kysely.provider";

jest.mock("pg", () => ({
  Pool: jest.fn(),
}));

describe("kyselyProvider", () => {
  it("constructs the Pool with the connection string from APP_CONFIG", async () => {
    const { Pool } = await import("pg");
    const appConfig: AppConfig = {
      port: 3000,
      supabaseJwtSecret: "secret",
      databaseUrl: "postgresql://user:pass@localhost:5432/db",
    };

    const factory = kyselyProvider.useFactory as (config: AppConfig) => unknown;
    factory(appConfig);

    expect(Pool).toHaveBeenCalledWith({
      connectionString: appConfig.databaseUrl,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
  });

  it("declares APP_CONFIG as its injection dependency", () => {
    expect(kyselyProvider.inject).toEqual([APP_CONFIG]);
  });
});
