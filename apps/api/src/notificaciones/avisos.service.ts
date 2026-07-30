import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { normalizeTimestamp } from "../common/db/timestamp";
import { NotificacionesRepository } from "./notificaciones.repository";
import type { NotificacionView, UnreadCount } from "./notificaciones.types";

function notificacionNotFound(): HttpException {
  return new HttpException(
    { code: "not_found", message: "Notification not found" },
    HttpStatus.NOT_FOUND,
  );
}

/**
 * TIMESTAMPTZ columns are declared `string` in db-types but node-postgres hands
 * back a JS Date, so every timestamp is normalised on the way out rather than
 * trusting the declared type.
 */
function toView(row: NotificacionView): NotificacionView {
  return {
    ...row,
    fecha: normalizeTimestamp(row.fecha),
    created_at: normalizeTimestamp(row.created_at) ?? row.created_at,
    leido_at: normalizeTimestamp(row.leido_at),
  };
}

@Injectable()
export class AvisosService {
  constructor(
    @Inject(NotificacionesRepository)
    private readonly notificacionesRepository: NotificacionesRepository,
  ) {}

  async listOwn(callerId: string): Promise<NotificacionView[]> {
    const rows = await this.notificacionesRepository.listForUsuario(callerId);
    return rows.map(toView);
  }

  async countOwnUnread(callerId: string): Promise<UnreadCount> {
    return {
      unread:
        await this.notificacionesRepository.countUnreadForUsuario(callerId),
    };
  }

  /**
   * A notification belonging to someone else answers 404, identical to an id
   * that does not exist — so the response never reveals that the id is real.
   */
  async markOwnRead(id: string, callerId: string): Promise<NotificacionView> {
    const updated = await this.notificacionesRepository.markRead(
      id,
      callerId,
      new Date().toISOString(),
    );
    if (!updated) {
      throw notificacionNotFound();
    }
    return toView(updated);
  }

  async markAllOwnRead(callerId: string): Promise<UnreadCount> {
    await this.notificacionesRepository.markAllRead(
      callerId,
      new Date().toISOString(),
    );
    return { unread: 0 };
  }
}
