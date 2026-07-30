import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { ConflictError } from "../common/errors/domain-errors";
import { KYSELY } from "../database/database.tokens";
import type {
  CaseDetailRow,
  CaseSummaryRow,
  Caso,
  ContraparteByCaso,
  CreateCasoDto,
} from "./casos.types";
import { estadoInvitacionAceptada, rolesParte } from "./casos.types";

const caseDetailColumns = [
  "casos.id",
  "casos.codigo",
  "casos.nombre",
  "casos.descripcion",
  "casos.metodo",
  "casos.estado",
  "casos.creador_id",
  "casos.created_at",
  "casos.updated_at",
  "casos.plazo",
  "casos.sla_tipo",
  "casos.ronda_actual",
] as const;

const caseSummaryColumns = [
  "casos.id",
  "casos.codigo",
  "casos.nombre",
  "casos.estado",
  "casos.metodo",
  "casos.created_at",
  "casos.plazo",
  "casos.sla_tipo",
  "casos.ronda_actual",
] as const;

export function buildMarkAcordadoQuery(db: Kysely<Database>, casoId: string) {
  return db
    .updateTable("casos")
    .set({ estado: "acordado" })
    .where("id", "=", casoId)
    .where("estado", "=", "en_negociacion")
    .returning(["id"]);
}

const estadosElegiblesVencimiento: Caso["estado"][] = [
  "nuevo",
  "activo",
  "en_negociacion",
];

const eventoVencimiento = "vencimiento";
const estadosNotificacionTerminales = ["enviada", "fallida"] as const;

const sweepBatchSize = 25;

function casoNotAcordable(casoId: string): ConflictError {
  return new ConflictError(
    `Caso ${casoId} was not en_negociacion when marking acordado`,
  );
}

@Injectable()
export class CasosRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  createCaseWithParteA(input: CreateCasoDto, creadorId: string): Promise<Caso> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const caso = await trx
          .insertInto("casos")
          .values({
            creador_id: creadorId,
            nombre: input.nombre,
            descripcion: input.descripcion ?? null,
            metodo: input.metodo,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("caso_partes")
          .values({
            caso_id: caso.id,
            usuario_id: creadorId,
            rol_en_caso: "parte_a",
            estado_invitacion: estadoInvitacionAceptada,
            fecha_union: new Date().toISOString(),
          })
          .execute();

        return caso;
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findOwnCases(callerId: string): Promise<CaseSummaryRow[]> {
    return this.kysely
      .selectFrom("casos")
      .innerJoin("caso_partes", "caso_partes.caso_id", "casos.id")
      .select([...caseSummaryColumns])
      .where("caso_partes.usuario_id", "=", callerId)
      .where("caso_partes.estado_invitacion", "=", estadoInvitacionAceptada)
      .execute();
  }

  /**
   * Resolved in a single round trip for every caso on screen. Mediadores are
   * excluded on purpose: the dashboard labels the opposing parte, not the staff.
   */
  findContrapartes(
    casoIds: string[],
    callerId: string,
  ): Promise<ContraparteByCaso[]> {
    if (casoIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.kysely
      .selectFrom("caso_partes")
      .innerJoin("usuarios", "usuarios.id", "caso_partes.usuario_id")
      .select([
        "caso_partes.caso_id",
        "caso_partes.usuario_id",
        "caso_partes.rol_en_caso",
        "usuarios.nombre",
        "usuarios.apellido",
      ])
      .where("caso_partes.caso_id", "in", casoIds)
      .where("caso_partes.usuario_id", "!=", callerId)
      .where("caso_partes.rol_en_caso", "in", rolesParte)
      .where("caso_partes.estado_invitacion", "=", estadoInvitacionAceptada)
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findDetailForMember(
    casoId: string,
    callerId: string,
  ): Promise<CaseDetailRow | undefined> {
    return this.kysely
      .selectFrom("casos")
      .innerJoin("caso_partes", "caso_partes.caso_id", "casos.id")
      .select([...caseDetailColumns])
      .where("casos.id", "=", casoId)
      .where("caso_partes.usuario_id", "=", callerId)
      .where("caso_partes.estado_invitacion", "=", estadoInvitacionAceptada)
      .executeTakeFirst();
  }

  activateIfNuevo(casoId: string, trx: Kysely<Database>): Promise<void> {
    return trx
      .updateTable("casos")
      .set({ estado: "activo" })
      .where("id", "=", casoId)
      .where("estado", "=", "nuevo")
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  activateNegotiation(casoId: string): Promise<void> {
    return this.kysely
      .updateTable("casos")
      .set({ estado: "en_negociacion" })
      .where("id", "=", casoId)
      .where("estado", "=", "activo")
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  markAcordado(casoId: string, trx: Kysely<Database>): Promise<void> {
    return buildMarkAcordadoQuery(trx, casoId)
      .executeTakeFirstOrThrow(() => casoNotAcordable(casoId))
      .then(() => undefined)
      .catch((error: unknown) => {
        if (error instanceof ConflictError) {
          throw error;
        }
        throw toDomainError(error);
      });
  }

  updatePlazo(
    casoId: string,
    plazo: string,
  ): Promise<Pick<Caso, "id" | "plazo">> {
    return this.kysely
      .updateTable("casos")
      .set({ plazo })
      .where("id", "=", casoId)
      .returning(["id", "plazo"])
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  updateEstado(
    casoId: string,
    estado: Caso["estado"],
  ): Promise<Pick<Caso, "id" | "estado">> {
    return this.kysely
      .updateTable("casos")
      .set({ estado })
      .where("id", "=", casoId)
      .returning(["id", "estado"])
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findPlazo(casoId: string): Promise<Pick<Caso, "id" | "plazo"> | undefined> {
    return this.kysely
      .selectFrom("casos")
      .select(["id", "plazo"])
      .where("id", "=", casoId)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findOverdueCasos(now: Date): Promise<Pick<Caso, "id">[]> {
    return this.kysely
      .selectFrom("casos")
      .select(["id"])
      .where("plazo", "is not", null)
      .where("plazo", "<=", now.toISOString())
      .where("estado", "in", estadosElegiblesVencimiento)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("caso_partes as cp")
            .select("cp.usuario_id")
            .whereRef("cp.caso_id", "=", "casos.id")
            .where("cp.estado_invitacion", "=", estadoInvitacionAceptada)
            .where((ebParte) =>
              ebParte.not(
                ebParte.exists(
                  ebParte
                    .selectFrom("notificaciones as n")
                    .select("n.id")
                    .whereRef("n.caso_id", "=", "casos.id")
                    .where("n.evento", "=", eventoVencimiento)
                    .whereRef("n.usuario_id", "=", "cp.usuario_id")
                    .where("n.estado", "in", estadosNotificacionTerminales),
                ),
              ),
            ),
        ),
      )
      .orderBy("plazo", "asc")
      .limit(sweepBatchSize)
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
