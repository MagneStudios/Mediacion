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
import { buildInvitacionLockQuery } from "./invitacion-lock-query";
import type {
  InvitacionCreated,
  InvitacionRefreshed,
  InvitacionView,
  JoinedCaso,
  PagoACargo,
  TipoInvitacion,
} from "./invitaciones.types";
import {
  DEFAULT_INVITATION_TTL_HOURS,
  isInvitationExpired,
} from "./invitation-ttl";

const estadoInvitacionPendiente = "pendiente" as const;
const estadoInvitacionExpirada = "expirada" as const;
const estadosInvitacionReenviable: string[] = [
  estadoInvitacionPendiente,
  estadoInvitacionExpirada,
];
const tipoInvitacionEmail = "email" as const;
const configKeyInvitacionTtlHoras = "invitacion_ttl_horas" as const;

const invitationExpiredOutcome = { expired: true } as const;

function invalidTokenError(): HttpException {
  return new HttpException(
    { code: "invalid_token", message: "Invalid or used token" },
    HttpStatus.NOT_FOUND,
  );
}

function invitationExpiredError(): HttpException {
  return new HttpException(
    { code: "invitation_expired", message: "Invitation expired" },
    HttpStatus.NOT_FOUND,
  );
}

function invitacionNotFoundError(): HttpException {
  return new HttpException(
    { code: "invitacion_not_found", message: "Invitation not found" },
    HttpStatus.NOT_FOUND,
  );
}

function invitacionNoReenviableError(estado: string): HttpException {
  return new HttpException(
    {
      code: "invitacion_no_reenviable",
      message: `An invitation in estado ${estado} cannot be resent`,
    },
    HttpStatus.CONFLICT,
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
    pagoACargo: PagoACargo | null,
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
        pago_a_cargo: pagoACargo,
      })
      .returning(["id", "tipo", "token", "estado", "pago_a_cargo"])
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      }) as Promise<InvitacionCreated>;
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

        const ttlHoras = await this.invitationTtlHoras(trx);
        if (isInvitationExpired(invitacion.fecha_envio, undefined, ttlHoras)) {
          await trx
            .updateTable("invitaciones")
            .set({ estado: estadoInvitacionExpirada })
            .where("id", "=", invitacion.id)
            .execute();
          return invitationExpiredOutcome;
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

        await this.casosRepository.activateOrHoldForSuscripciones(
          invitacion.caso_id,
          trx,
        );

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
        if ("expired" in result) {
          throw invitationExpiredError();
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

  refreshInvite(
    invitacionId: string,
    casoId: string,
    nuevoToken: string | null,
  ): Promise<InvitacionRefreshed> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const invitacion = await buildInvitacionLockQuery(
          trx,
          invitacionId,
          casoId,
        ).executeTakeFirst();
        if (!invitacion) {
          throw invitacionNotFoundError();
        }
        if (!estadosInvitacionReenviable.includes(invitacion.estado)) {
          throw invitacionNoReenviableError(invitacion.estado);
        }
        return trx
          .updateTable("invitaciones")
          .set({
            estado: estadoInvitacionPendiente,
            fecha_envio: new Date().toISOString(),
            ...(nuevoToken === null ? {} : { token: nuevoToken }),
          })
          .where("id", "=", invitacionId)
          .returning([
            "id",
            "tipo",
            "token",
            "estado",
            "email_destino",
            "pago_a_cargo",
          ])
          .executeTakeFirstOrThrow();
      })
      .then((row) => row as InvitacionRefreshed)
      .catch((error: unknown) => {
        if (error instanceof HttpException) {
          throw error;
        }
        throw toDomainError(error);
      });
  }

  private async invitationTtlHoras(db: Kysely<Database>): Promise<number> {
    const row = await db
      .selectFrom("configuracion")
      .select("valor")
      .where("clave", "=", configKeyInvitacionTtlHoras)
      .executeTakeFirst();
    const raw = row?.valor;
    if (typeof raw !== "string" && typeof raw !== "number") {
      return DEFAULT_INVITATION_TTL_HOURS;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_INVITATION_TTL_HOURS;
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
        "pago_a_cargo",
      ])
      .where("caso_id", "=", casoId)
      .orderBy("created_at", "desc")
      .execute() as Promise<InvitacionView[]>;
  }
}
