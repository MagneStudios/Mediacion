import { Inject, Injectable } from "@nestjs/common";
import { createTransport } from "nodemailer";
import type { AppConfig } from "../../config/config";
import { APP_CONFIG } from "../../config/config.tokens";
import type { EmailMessage, EmailProvider } from "../notificaciones.types";

const SMTP_SECURE_PORT = 465;
const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 30_000;

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  constructor(@Inject(APP_CONFIG) private readonly appConfig: AppConfig) {}

  async send(message: EmailMessage): Promise<void> {
    const transporter = createTransport({
      host: this.appConfig.smtpHost,
      port: this.appConfig.smtpPort,
      secure: this.appConfig.smtpPort === SMTP_SECURE_PORT,
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
      auth: {
        user: this.appConfig.smtpUser,
        pass: this.appConfig.smtpPass,
      },
    });
    await transporter.sendMail({
      from: this.appConfig.smtpUser,
      to: message.to,
      subject: message.evento,
      text: message.evento,
    });
  }
}
