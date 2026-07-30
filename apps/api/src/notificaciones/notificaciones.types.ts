import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Notificacion = Selectable<Database["notificaciones"]>;
export type Canal = Notificacion["canal"];
export type Estado = "pendiente" | "enviada" | "fallida";

export type EmitNotificacionInput = {
  usuarioId: string;
  casoId?: string | null;
  canal: Canal;
  evento: string;
};

export type EmailMessage = {
  to: string;
  evento: string;
};

export type PushMessage = {
  usuarioId: string;
  evento: string;
};

export type EmailProvider = {
  send(message: EmailMessage): Promise<void>;
};

export type PushProvider = {
  send(message: PushMessage): Promise<void>;
};

/**
 * A notification as the owning user sees it.
 *
 * `leido_at` is null when unread. It is deliberately separate from `estado`,
 * which is a delivery status: a notice can be delivered and unread, or read
 * after a failed push.
 */
export type NotificacionView = Pick<
  Notificacion,
  "id" | "caso_id" | "canal" | "evento" | "estado" | "fecha" | "created_at"
> & { leido_at: string | null };

export type UnreadCount = { unread: number };
