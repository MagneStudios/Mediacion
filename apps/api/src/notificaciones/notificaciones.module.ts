import { Global, Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { NotificacionesRepository } from "./notificaciones.repository";
import { NotificacionesService } from "./notificaciones.service";
import { SmtpEmailProvider } from "./providers/email-provider";
import {
  EMAIL_PROVIDER,
  PUSH_PROVIDER,
} from "./providers/notificaciones.tokens";
import { FcmApnsPushProvider } from "./providers/push-provider";

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    NotificacionesRepository,
    NotificacionesService,
    { provide: EMAIL_PROVIDER, useClass: SmtpEmailProvider },
    { provide: PUSH_PROVIDER, useClass: FcmApnsPushProvider },
  ],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
