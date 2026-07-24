import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { ConflictError } from "../common/errors/domain-errors";
import { KYSELY } from "../database/database.tokens";
import type {
  CaseDetail,
  CaseSummary,
  Caso,
  CreateCasoDto,
} from "./casos.types";
import { estadoInvitacionAceptada } from "./casos.types";

const caseDetailColumns = [
  "casos.id",
  "casos.nombre",
  "casos.descripcion",
  "casos.metodo",
  "casos.estado",
  "casos.creador_id",
  "casos.created_at",
  "casos.updated_at",
] as const;

export function buildMarkAcordadoQuery(db: Kysely<Database>, casoId: string) {
  return db
    .updateTable("casos")
    .set({ estado: "acordado" })
    .where("id", "=", casoId)
    .where("estado", "=", "en_negociacion")
    .returning(["id"]);
}

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

  findOwnCases(callerId: string): Promise<CaseSummary[]> {
    return this.kysely
      .selectFrom("casos")
      .innerJoin("caso_partes", "caso_partes.caso_id", "casos.id")
      .select([
        "casos.id",
        "casos.nombre",
        "casos.estado",
        "casos.metodo",
        "casos.created_at",
      ])
      .where("caso_partes.usuario_id", "=", callerId)
      .where("caso_partes.estado_invitacion", "=", estadoInvitacionAceptada)
      .execute();
  }

  findDetailForMember(
    casoId: string,
    callerId: string,
  ): Promise<CaseDetail | undefined> {
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
}
