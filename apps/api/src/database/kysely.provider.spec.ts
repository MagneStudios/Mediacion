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
      openrouterApiKey: "sk-or-test-key",
      docusignIntegrationKey: "ik-test",
      docusignClientSecret: "secret-test",
      docusignAccountId: "account-test",
      docusignBasePath: "https://demo.docusign.net/restapi",
      docusignWebhookSecret: "whsec-test",
      docusignUserId: "user-test",
      docusignOauthBase: "account-d.docusign.com",
      docusignPrivateKey: "test-private-key-pem",
      mpAccessToken: "mp-access-token",
      mpWebhookSecret: "mp-webhook-secret",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpUser: "smtp-user",
      smtpPass: "smtp-pass",
      fcmKey: "fcm-key",
      apnsKey: "apns-key",
      cronSecret: "cron-secret",
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
