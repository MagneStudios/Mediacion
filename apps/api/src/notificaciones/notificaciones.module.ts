import { Global, Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { NotificacionesRepository } from "./notificaciones.repository";
import { NotificacionesService } from "./notificaciones.service";
import {
  EMAIL_PROVIDER,
  PUSH_PROVIDER,
} from "./providers/notificaciones.tokens";

const noopEmailProvider = { send: async () => undefined };
const noopPushProvider = { send: async () => undefined };

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    NotificacionesRepository,
    NotificacionesService,
    { provide: EMAIL_PROVIDER, useValue: noopEmailProvider },
    { provide: PUSH_PROVIDER, useValue: noopPushProvider },
  ],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
