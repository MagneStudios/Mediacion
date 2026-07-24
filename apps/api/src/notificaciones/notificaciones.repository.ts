import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { estadoInvitacionAceptada } from "../casos/casos.types";
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

  findEventoEstado(
    casoId: string,
    evento: string,
    usuarioId: string,
  ): Promise<{ id: string; estado: Estado } | undefined> {
    return this.kysely
      .selectFrom("notificaciones")
      .select(["id", "estado"])
      .where("caso_id", "=", casoId)
      .where("evento", "=", evento)
      .where("usuario_id", "=", usuarioId)
      .executeTakeFirst()
      .then((row) => row as { id: string; estado: Estado } | undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findAceptadaParties(casoId: string): Promise<{ usuario_id: string }[]> {
    return this.kysely
      .selectFrom("caso_partes")
      .select(["usuario_id"])
      .where("caso_id", "=", casoId)
      .where("estado_invitacion", "=", estadoInvitacionAceptada)
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
