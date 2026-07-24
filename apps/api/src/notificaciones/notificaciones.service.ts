import { Inject, Injectable, Logger } from "@nestjs/common";
import { NotificacionesRepository } from "./notificaciones.repository";
import type {
  EmailProvider,
  EmitNotificacionInput,
  PushProvider,
} from "./notificaciones.types";
import {
  EMAIL_PROVIDER,
  PUSH_PROVIDER,
} from "./providers/notificaciones.tokens";

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  private readonly providers: { email: EmailProvider; push: PushProvider };

  constructor(
    @Inject(NotificacionesRepository)
    private readonly notificacionesRepository: NotificacionesRepository,
    @Inject(EMAIL_PROVIDER) emailProvider: EmailProvider,
    @Inject(PUSH_PROVIDER) pushProvider: PushProvider,
  ) {
    this.providers = { email: emailProvider, push: pushProvider };
  }

  emit(input: EmitNotificacionInput): void {
    void this.deliver(input).catch((error: unknown) => {
      this.logger.error(
        `notificaciones.emit failed before dispatch usuarioId=${input.usuarioId} canal=${input.canal} evento=${input.evento}`,
        error,
      );
    });
  }

  async deliver(input: EmitNotificacionInput): Promise<void> {
    const { id } = await this.notificacionesRepository.createPendiente(input);

    if (input.canal === "email") {
      const to = await this.notificacionesRepository.findRecipientEmail(
        input.usuarioId,
      );
      if (to === undefined) {
        await this.markFallida(id, input);
        return;
      }
      await this.dispatch(id, input, () =>
        this.providers.email.send({ to, evento: input.evento }),
      );
      return;
    }

    await this.dispatch(id, input, () =>
      this.providers.push.send({
        usuarioId: input.usuarioId,
        evento: input.evento,
      }),
    );
  }

  private async dispatch(
    id: string,
    input: EmitNotificacionInput,
    send: () => Promise<void>,
  ): Promise<void> {
    try {
      await send();
    } catch (error) {
      await this.markFallida(id, input, error);
      return;
    }

    try {
      await this.notificacionesRepository.updateEstado(id, "enviada");
    } catch (error) {
      this.logger.error(
        `notificaciones.deliver failed to mark enviada id=${id} usuarioId=${input.usuarioId} canal=${input.canal} evento=${input.evento}`,
        error,
      );
    }
  }

  private async markFallida(
    id: string,
    input: EmitNotificacionInput,
    error?: unknown,
  ): Promise<void> {
    await this.notificacionesRepository.updateEstado(id, "fallida");
    const context = `id=${id} usuarioId=${input.usuarioId} canal=${input.canal} evento=${input.evento}`;
    if (error === undefined) {
      this.logger.error(
        `notificaciones.deliver missing recipient email ${context}`,
      );
      return;
    }
    this.logger.error(`notificaciones.deliver failed ${context}`, error);
  }
}
