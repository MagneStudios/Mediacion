import { Logger } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { FcmApnsPushProvider } from "./push-provider";

function buildAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    port: 3000,
    supabaseJwtSecret: "secret",
    databaseUrl: "postgresql://placeholder",
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
    ...overrides,
  };
}

describe("FcmApnsPushProvider", () => {
  it("logs the push notification and resolves without throwing (device-token registry deferred)", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    const provider = new FcmApnsPushProvider(buildAppConfig());

    await expect(
      provider.send({ usuarioId: "user-1", evento: "vencimiento" }),
    ).resolves.toBeUndefined();

    expect(loggerSpy).toHaveBeenCalled();
    expect(loggerSpy.mock.calls[0][0]).toEqual(
      expect.stringContaining("user-1"),
    );
    expect(loggerSpy.mock.calls[0][0]).toEqual(
      expect.stringContaining("vencimiento"),
    );
    loggerSpy.mockRestore();
  });

  it("reports providers as unconfigured when FCM_KEY/APNS_KEY are empty placeholders", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    const provider = new FcmApnsPushProvider(
      buildAppConfig({ fcmKey: "", apnsKey: "" }),
    );

    await provider.send({ usuarioId: "user-1", evento: "vencimiento" });

    expect(loggerSpy.mock.calls[0][0]).toEqual(
      expect.stringContaining("providersConfigured=false"),
    );
    loggerSpy.mockRestore();
  });

  it("reports providers as configured when FCM_KEY and APNS_KEY are both set", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    const provider = new FcmApnsPushProvider(buildAppConfig());

    await provider.send({ usuarioId: "user-1", evento: "vencimiento" });

    expect(loggerSpy.mock.calls[0][0]).toEqual(
      expect.stringContaining("providersConfigured=true"),
    );
    loggerSpy.mockRestore();
  });
});
