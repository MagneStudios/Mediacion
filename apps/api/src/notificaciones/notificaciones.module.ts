import { Global, Module } from "@nestjs/common";
import { CasosModule } from "../casos/casos.module";
import { DatabaseModule } from "../database/database.module";
import { AvisosController } from "./avisos.controller";
import { AvisosService } from "./avisos.service";
import { NotificacionesRepository } from "./notificaciones.repository";
import { NotificacionesService } from "./notificaciones.service";
import { SmtpEmailProvider } from "./providers/email-provider";
import {
  EMAIL_PROVIDER,
  PUSH_PROVIDER,
} from "./providers/notificaciones.tokens";
import { FcmApnsPushProvider } from "./providers/push-provider";
import { VencimientoController } from "./vencimiento.controller";
import { VencimientoScheduler } from "./vencimiento.scheduler";

@Global()
@Module({
  imports: [DatabaseModule, CasosModule],
  controllers: [AvisosController, VencimientoController],
  providers: [
    NotificacionesRepository,
    NotificacionesService,
    AvisosService,
    VencimientoScheduler,
    { provide: EMAIL_PROVIDER, useClass: SmtpEmailProvider },
    { provide: PUSH_PROVIDER, useClass: FcmApnsPushProvider },
  ],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
