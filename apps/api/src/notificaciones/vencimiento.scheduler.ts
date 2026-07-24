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
      const results = await Promise.allSettled(
        parties.map((parte) => this.deliverToParty(caso.id, parte.usuario_id)),
      );
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          this.logger.error(
            `vencimiento.sweep delivery failed for caso ${caso.id} usuario ${parties[index].usuario_id}`,
            result.reason,
          );
        }
      });
    }
  }

  private async deliverToParty(
    casoId: string,
    usuarioId: string,
  ): Promise<void> {
    const evento = await this.notificacionesRepository.findEventoEstado(
      casoId,
      eventoVencimiento,
      usuarioId,
    );

    if (evento === undefined) {
      await this.notificacionesService.emitAwaited({
        usuarioId,
        casoId,
        canal: canalVencimiento,
        evento: eventoVencimiento,
      });
      return;
    }

    if (evento.estado === "pendiente") {
      await this.notificacionesService.redeliverAwaited(evento.id, {
        usuarioId,
        casoId,
        canal: canalVencimiento,
        evento: eventoVencimiento,
      });
    }
  }
}
