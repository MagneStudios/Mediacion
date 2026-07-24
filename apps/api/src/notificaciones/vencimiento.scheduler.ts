import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CasosRepository } from "../casos/casos.repository";
import { NotificacionesRepository } from "./notificaciones.repository";
import { NotificacionesService } from "./notificaciones.service";
import type { Canal } from "./notificaciones.types";

const eventoVencimiento = "vencimiento";
const canalVencimiento: Canal = "email";

@Injectable()
export class VencimientoScheduler {
  private readonly logger = new Logger(VencimientoScheduler.name);

  constructor(
    @Inject(CasosRepository)
    private readonly casosRepository: CasosRepository,
    @Inject(NotificacionesRepository)
    private readonly notificacionesRepository: NotificacionesRepository,
    @Inject(NotificacionesService)
    private readonly notificacionesService: NotificacionesService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    try {
      await this.runSweep(new Date());
    } catch (error) {
      this.logger.error("vencimiento.sweep failed", error);
    }
  }

  async runSweep(now: Date): Promise<void> {
    const overdueCasos = await this.casosRepository.findOverdueCasos(now);

    for (const caso of overdueCasos) {
      const parties = await this.notificacionesRepository.findAceptadaParties(
        caso.id,
      );
      for (const parte of parties) {
        const alreadyNotified =
          await this.notificacionesRepository.existsEvento(
            caso.id,
            eventoVencimiento,
            parte.usuario_id,
          );
        if (alreadyNotified) {
          continue;
        }

        this.notificacionesService.emit({
          usuarioId: parte.usuario_id,
          casoId: caso.id,
          canal: canalVencimiento,
          evento: eventoVencimiento,
        });
      }
    }
  }
}
