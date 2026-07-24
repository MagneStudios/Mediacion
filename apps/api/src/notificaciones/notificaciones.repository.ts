import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { EmitNotificacionInput, Estado } from "./notificaciones.types";

const estadoPendiente: Estado = "pendiente";

@Injectable()
export class NotificacionesRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  createPendiente(input: EmitNotificacionInput): Promise<{ id: string }> {
    return this.kysely
      .insertInto("notificaciones")
      .values({
        usuario_id: input.usuarioId,
        caso_id: input.casoId ?? null,
        canal: input.canal,
        evento: input.evento,
        estado: estadoPendiente,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  updateEstado(id: string, estado: Estado): Promise<void> {
    return this.kysely
      .updateTable("notificaciones")
      .set({ estado, fecha: new Date().toISOString() })
      .where("id", "=", id)
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findRecipientEmail(usuarioId: string): Promise<string | undefined> {
    return this.kysely
      .selectFrom("usuarios")
      .select("email")
      .where("id", "=", usuarioId)
      .executeTakeFirst()
      .then((row) => row?.email)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
