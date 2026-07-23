import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { CasosRepository } from "../casos/casos.repository";
import { estadoInvitacionAceptada } from "../casos/casos.types";
import { toDomainError } from "../common/db/pg-error";
import { ConflictError } from "../common/errors/domain-errors";
import { KYSELY } from "../database/database.tokens";
import { buildCasoLockQuery } from "./caso-lock-query";
import type {
  InvitacionCreated,
  JoinedCaso,
  TipoInvitacion,
} from "./invitaciones.types";

const estadoInvitacionPendiente = "pendiente" as const;

@Injectable()
export class InvitacionesRepository {
  constructor(
    @Inject(KYSELY) private readonly kysely: Kysely<Database>,
    @Inject(CasosRepository) private readonly casosRepository: CasosRepository,
  ) {}

  createInvite(
    casoId: string,
    tipo: TipoInvitacion,
    token: string,
  ): Promise<InvitacionCreated> {
    return this.kysely
      .insertInto("invitaciones")
      .values({
        caso_id: casoId,
        tipo,
        token,
        estado: estadoInvitacionPendiente,
      })
      .returning(["id", "tipo", "token", "estado"])
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  joinCase(token: string, callerId: string): Promise<JoinedCaso> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const invitacion = await trx
          .selectFrom("invitaciones")
          .selectAll()
          .where("token", "=", token)
          .where("estado", "=", estadoInvitacionPendiente)
          .forUpdate()
          .executeTakeFirst();
        if (!invitacion) {
          throw new HttpException(
            { code: "invalid_token", message: "Invalid or used token" },
            HttpStatus.NOT_FOUND,
          );
        }

        const casoLocked = await buildCasoLockQuery(
          trx,
          invitacion.caso_id,
        ).executeTakeFirst();
        if (!casoLocked) {
          throw new HttpException(
            { code: "caso_not_found", message: "Case not found" },
            HttpStatus.NOT_FOUND,
          );
        }

        const miembros = await trx
          .selectFrom("caso_partes")
          .select(["usuario_id"])
          .where("caso_id", "=", invitacion.caso_id)
          .where("estado_invitacion", "=", estadoInvitacionAceptada)
          .execute();

        if (miembros.some((miembro) => miembro.usuario_id === callerId)) {
          throw new ConflictError("caller already a member of this case");
        }
        if (miembros.length >= 2) {
          throw new ConflictError("case already has two accepted parties");
        }

        await trx
          .insertInto("caso_partes")
          .values({
            caso_id: invitacion.caso_id,
            usuario_id: callerId,
            rol_en_caso: "parte_b",
            estado_invitacion: estadoInvitacionAceptada,
            fecha_union: new Date().toISOString(),
          })
          .execute();

        await trx
          .updateTable("invitaciones")
          .set({ estado: estadoInvitacionAceptada })
          .where("id", "=", invitacion.id)
          .execute();

        await this.casosRepository.activateIfNuevo(invitacion.caso_id, trx);

        return trx
          .selectFrom("casos")
          .select(["id", "estado"])
          .where("id", "=", invitacion.caso_id)
          .executeTakeFirstOrThrow();
      })
      .catch((error: unknown) => {
        if (error instanceof HttpException) {
          throw error;
        }
        throw toDomainError(error);
      });
  }
}
