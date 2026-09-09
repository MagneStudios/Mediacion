import { createTransport } from "nodemailer";
import type { AppConfig } from "../../config/config";
import { buildTestAppConfig } from "../../config/config.test-fixture";
import { SmtpEmailProvider } from "./email-provider";

jest.mock("nodemailer");

describe("SmtpEmailProvider", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds a transporter from the app config SMTP settings with conservative timeouts and sends the message", async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    const provider = new SmtpEmailProvider(buildTestAppConfig());

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
    const provider = new SmtpEmailProvider(
      buildTestAppConfig({ smtpPort: 465 }),
    );

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
    const provider = new SmtpEmailProvider(
      buildTestAppConfig({ smtpPort: 25 }),
    );

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
    const provider = new SmtpEmailProvider(buildTestAppConfig());

    await expect(
      provider.send({ to: "party@example.com", evento: "vencimiento" }),
    ).rejects.toThrow("smtp connection refused");
  });

  it("never opens a real network connection — nodemailer is fully mocked", () => {
    expect(jest.isMockFunction(createTransport)).toBe(true);
  });
});
