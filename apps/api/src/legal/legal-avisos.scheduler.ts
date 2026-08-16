import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { AppConfig } from "../config/config";
import { APP_CONFIG } from "../config/config.tokens";
import type { EmailProvider } from "../notificaciones/notificaciones.types";
import { EMAIL_PROVIDER } from "../notificaciones/providers/notificaciones.tokens";
import { buildAvisoEvento, diasDeAnticipacion } from "./aviso-evento";
import { LegalRepository } from "./legal.repository";
import type { PublicacionProgramada, UsuarioActivo } from "./legal.types";

const millisecondsPerDay = 86_400_000;

@Injectable()
export class LegalAvisosScheduler {
  private readonly logger = new Logger(LegalAvisosScheduler.name);

  constructor(
    @Inject(LegalRepository) private readonly legalRepository: LegalRepository,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    try {
      await this.runSweep(new Date());
    } catch (error) {
      this.logger.error("legal.avisos.sweep failed", error);
    }
  }

  async runSweep(now: Date): Promise<void> {
    const hasta = new Date(
      now.getTime() +
        this.appConfig.legalAvisoDiasAnticipacion * millisecondsPerDay,
    );
    const publicaciones =
      await this.legalRepository.findPublicacionesProgramadas(
        now.toISOString(),
        hasta.toISOString(),
      );
    if (publicaciones.length === 0) {
      return;
    }
    const usuarios = await this.legalRepository.findUsuariosActivos();
    for (const publicacion of publicaciones) {
      await this.deliverPublicacion(publicacion, usuarios, now);
    }
  }

  private async deliverPublicacion(
    publicacion: PublicacionProgramada,
    usuarios: UsuarioActivo[],
    now: Date,
  ): Promise<void> {
    const results = await Promise.allSettled(
      usuarios.map((usuario) => this.deliver(publicacion, usuario, now)),
    );
    const notified = results.filter(
      (result) => result.status === "fulfilled" && result.value,
    ).length;
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        this.logger.error(
          `legal.avisos.sweep delivery failed for usuario ${usuarios[index].id} on ${publicacion.tipo} ${publicacion.version}`,
          result.reason,
        );
      }
    });
    this.warnOnShortNotice(publicacion, now, notified);
  }

  private async deliver(
    publicacion: PublicacionProgramada,
    usuario: UsuarioActivo,
    now: Date,
  ): Promise<boolean> {
    const claimed = await this.legalRepository.claimAviso(
      usuario.id,
      publicacion.tipo,
      publicacion.version,
    );
    const target =
      claimed ??
      (await this.legalRepository.findAvisoPendiente(
        usuario.id,
        publicacion.tipo,
        publicacion.version,
      ));
    if (!target) {
      return false;
    }
    await this.emailProvider.send({
      to: usuario.email,
      evento: buildAvisoEvento(publicacion),
    });
    await this.legalRepository.markAvisoEnviado(target.id, now.toISOString());
    return true;
  }

  private warnOnShortNotice(
    publicacion: PublicacionProgramada,
    now: Date,
    notified: number,
  ): void {
    if (notified === 0) {
      return;
    }
    const dias = diasDeAnticipacion(publicacion, now);
    if (dias === null || dias >= this.appConfig.legalAvisoDiasAnticipacion) {
      return;
    }
    this.logger.error(
      `legal.avisos.sweep notified ${publicacion.tipo} ${publicacion.version} with ${dias.toFixed(1)} days of notice, below the ${this.appConfig.legalAvisoDiasAnticipacion} day minimum`,
    );
  }
}
