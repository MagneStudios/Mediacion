import { createTransport } from "nodemailer";
import type { AppConfig } from "../../config/config";
import { SmtpEmailProvider } from "./email-provider";

jest.mock("nodemailer");

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
    operacionesEmail: "operaciones@test",
    legalAvisoDiasAnticipacion: 10,
    legalPublicRequestsPerWindow: 5,
    legalPublicWindowMs: 3_600_000,
    cronSecret: "cron-secret",
    corsOrigins: [],
    ...overrides,
  };
}

describe("SmtpEmailProvider", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds a transporter from the app config SMTP settings with conservative timeouts and sends the message", async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    const provider = new SmtpEmailProvider(buildAppConfig());

    await provider.send({
      to: "party@example.com",
      evento: "invitacion_enviada",
    });

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      connectionTimeout: 10_000,
      socketTimeout: 30_000,
      auth: { user: "smtp-user", pass: "smtp-pass" },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "smtp-user",
      to: "party@example.com",
      subject: "invitacion_enviada",
      text: "invitacion_enviada",
    });
  });

  it("opens a secure connection when the SMTP port is 465", async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    const provider = new SmtpEmailProvider(buildAppConfig({ smtpPort: 465 }));

    await provider.send({
      to: "party@example.com",
      evento: "invitacion_enviada",
    });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it("does not open a secure connection for non-465 ports other than the default 587", async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    const provider = new SmtpEmailProvider(buildAppConfig({ smtpPort: 25 }));

    await provider.send({
      to: "party@example.com",
      evento: "invitacion_enviada",
    });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 25, secure: false }),
    );
  });

  it("propagates a rejection from the transporter so the caller can mark the notification as fallida", async () => {
    const sendMail = jest
      .fn()
      .mockRejectedValue(new Error("smtp connection refused"));
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    const provider = new SmtpEmailProvider(buildAppConfig());

    await expect(
      provider.send({ to: "party@example.com", evento: "vencimiento" }),
    ).rejects.toThrow("smtp connection refused");
  });

  it("never opens a real network connection — nodemailer is fully mocked", () => {
    expect(jest.isMockFunction(createTransport)).toBe(true);
  });
});
