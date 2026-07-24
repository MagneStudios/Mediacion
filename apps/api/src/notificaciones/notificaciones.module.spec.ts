import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { NotificacionesModule } from "./notificaciones.module";
import { NotificacionesService } from "./notificaciones.service";
import { SmtpEmailProvider } from "./providers/email-provider";
import {
  EMAIL_PROVIDER,
  PUSH_PROVIDER,
} from "./providers/notificaciones.tokens";
import { FcmApnsPushProvider } from "./providers/push-provider";

describe("NotificacionesModule", () => {
  let moduleReference: TestingModule;

  beforeAll(async () => {
    moduleReference = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, NotificacionesModule],
    }).compile();
  });

  afterAll(async () => {
    await moduleReference.close();
  });

  it("boots with concrete providers and resolves an emit-capable service", () => {
    const service = moduleReference.get(NotificacionesService);

    expect(service).toBeInstanceOf(NotificacionesService);
  });

  it("binds EMAIL_PROVIDER to the concrete SmtpEmailProvider", () => {
    const emailProvider = moduleReference.get(EMAIL_PROVIDER);

    expect(emailProvider).toBeInstanceOf(SmtpEmailProvider);
  });

  it("binds PUSH_PROVIDER to the concrete FcmApnsPushProvider", () => {
    const pushProvider = moduleReference.get(PUSH_PROVIDER);

    expect(pushProvider).toBeInstanceOf(FcmApnsPushProvider);
  });
});
