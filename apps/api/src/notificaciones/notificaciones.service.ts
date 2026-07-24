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
        `notificaciones.emit failed before dispatch ${this.formatContext(input)}`,
        error,
      );
    });
  }

  async deliver(input: EmitNotificacionInput): Promise<void> {
    const { id } = await this.notificacionesRepository.createPendiente(input);

    if (input.canal === "email") {
      await this.deliverEmail(id, input);
      return;
    }

    await this.dispatch(id, input, () =>
      this.providers.push.send({
        usuarioId: input.usuarioId,
        evento: input.evento,
      }),
    );
  }

  private async deliverEmail(
    id: string,
    input: EmitNotificacionInput,
  ): Promise<void> {
    let to: string | undefined;
    try {
      to = await this.notificacionesRepository.findRecipientEmail(
        input.usuarioId,
      );
    } catch (error) {
      await this.markFallida(id, input, error);
      return;
    }

    if (to === undefined) {
      await this.markFallida(id, input);
      return;
    }

    await this.dispatch(id, input, () =>
      this.providers.email.send({ to, evento: input.evento }),
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
        `notificaciones.deliver failed to mark enviada ${this.formatContext(input, id)}`,
        error,
      );
    }
  }

  private async markFallida(
    id: string,
    input: EmitNotificacionInput,
    error?: unknown,
  ): Promise<void> {
    const context = this.formatContext(input, id);
    try {
      await this.notificacionesRepository.updateEstado(id, "fallida");
    } catch (dbError) {
      this.logOriginalFailure(context, error);
      this.logger.error(
        `notificaciones.deliver failed to mark fallida ${context}`,
        dbError,
      );
      return;
    }
    this.logOriginalFailure(context, error);
  }

  private logOriginalFailure(context: string, error: unknown): void {
    if (error === undefined) {
      this.logger.error(
        `notificaciones.deliver missing recipient email ${context}`,
      );
      return;
    }
    this.logger.error(`notificaciones.deliver failed ${context}`, error);
  }

  private formatContext(input: EmitNotificacionInput, id?: string): string {
    const idPart = id === undefined ? "" : `id=${id} `;
    return `${idPart}usuarioId=${input.usuarioId} canal=${input.canal} evento=${input.evento}`;
  }
}
