import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { CasosRepository } from "../casos/casos.repository";
import { estadoInvitacionAceptada } from "../casos/casos.types";
import { toDomainError } from "../common/db/pg-error";
import { ConflictError } from "../common/errors/domain-errors";
import { KYSELY } from "../database/database.tokens";
import { buildCasoLockQuery } from "./caso-lock-query";
import { emailsMatch } from "./email-match";
import type {
  InvitacionCreated,
  InvitacionView,
  JoinedCaso,
  TipoInvitacion,
} from "./invitaciones.types";
import { isInvitationExpired } from "./invitation-ttl";

const estadoInvitacionPendiente = "pendiente" as const;
const estadoInvitacionExpirada = "expirada" as const;
const tipoInvitacionEmail = "email" as const;

function invalidTokenError(): HttpException {
  return new HttpException(
    { code: "invalid_token", message: "Invalid or used token" },
    HttpStatus.NOT_FOUND,
  );
}

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
    emailDestino: string | null,
  ): Promise<InvitacionCreated> {
    return this.kysely
      .insertInto("invitaciones")
      .values({
        caso_id: casoId,
        tipo,
        token,
        estado: estadoInvitacionPendiente,
        email_destino: emailDestino,
        fecha_envio: new Date().toISOString(),
      })
      .returning(["id", "tipo", "token", "estado"])
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findUsuarioIdByEmail(email: string): Promise<string | undefined> {
    return this.kysely
      .selectFrom("usuarios")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst()
      .then((row) => row?.id)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  joinCase(
    token: string,
    callerId: string,
    callerEmail: string,
  ): Promise<JoinedCaso> {
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
          throw invalidTokenError();
        }

        if (isInvitationExpired(invitacion.fecha_envio)) {
          await trx
            .updateTable("invitaciones")
            .set({ estado: estadoInvitacionExpirada })
            .where("id", "=", invitacion.id)
            .execute();
          return null;
        }

        if (
          invitacion.tipo === tipoInvitacionEmail &&
          !emailsMatch(invitacion.email_destino, callerEmail)
        ) {
          throw new HttpException(
            {
              code: "forbidden",
              message: "Invitation email does not match the caller",
            },
            HttpStatus.FORBIDDEN,
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
      .then((result) => {
        if (!result) {
          throw invalidTokenError();
        }
        return result;
      })
      .catch((error: unknown) => {
        if (error instanceof HttpException) {
          throw error;
        }
        throw toDomainError(error);
      });
  }

  listByCaso(casoId: string): Promise<InvitacionView[]> {
    return this.kysely
      .selectFrom("invitaciones")
      .select([
        "id",
        "caso_id",
        "tipo",
        "token",
        "email_destino",
        "estado",
        "fecha_envio",
        "created_at",
      ])
      .where("caso_id", "=", casoId)
      .orderBy("created_at", "desc")
      .execute() as Promise<InvitacionView[]>;
  }
}
