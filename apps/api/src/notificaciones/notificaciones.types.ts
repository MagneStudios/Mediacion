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
