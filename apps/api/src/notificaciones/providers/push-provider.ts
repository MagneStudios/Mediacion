import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { APP_CONFIG } from "../../config/config.tokens";
import type { PushMessage, PushProvider } from "../notificaciones.types";

/**
 * Device-token registry is deferred (out of scope for this slice) — this
 * provider is a structured no-op/log sink so the push seam is wired and
 * testable without depending on unbuilt infrastructure.
 */
@Injectable()
export class FcmApnsPushProvider implements PushProvider {
  private readonly logger = new Logger(FcmApnsPushProvider.name);

  constructor(@Inject(APP_CONFIG) private readonly appConfig: AppConfig) {}

  async send(message: PushMessage): Promise<void> {
    const providersConfigured =
      this.appConfig.fcmKey.trim().length > 0 &&
      this.appConfig.apnsKey.trim().length > 0;
    this.logger.log(
      `push notification queued (no-op sink, device-token registry deferred) usuarioId=${message.usuarioId} evento=${message.evento} providersConfigured=${providersConfigured}`,
    );
  }
}
