import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  EstadoPropuesta,
  Propuesta,
  PropuestaView,
} from "./negociacion.types";
import { propuestaViewColumns } from "./negociacion.types";

export function buildCreatePendingQuery(
  db: Kysely<Database>,
  casoId: string,
  rondaId: string,
  contenido: Propuesta["contenido"],
  modeloIa: string,
) {
  return db
    .insertInto("propuestas")
    .values({
      caso_id: casoId,
      ronda_id: rondaId,
      contenido,
      modelo_ia: modeloIa,
    })
    .returning([...propuestaViewColumns]);
}

export function buildPatchGeneratedQuery(
  db: Kysely<Database>,
  propuestaId: string,
  contenido: Propuesta["contenido"],
  fundamentacion: string | null,
) {
  return db
    .updateTable("propuestas")
    .set({ contenido, fundamentacion })
    .where("id", "=", propuestaId)
    .returning([...propuestaViewColumns]);
}

export function buildMarkEstadoQuery(
  db: Kysely<Database>,
  propuestaId: string,
  estado: EstadoPropuesta,
) {
  return db
    .updateTable("propuestas")
    .set({ estado })
    .where("id", "=", propuestaId)
    .returning([...propuestaViewColumns]);
}

export function buildFindForCaseQuery(db: Kysely<Database>, casoId: string) {
  return db
    .selectFrom("propuestas")
    .select([...propuestaViewColumns])
    .where("caso_id", "=", casoId);
}

@Injectable()
export class PropuestasRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  createPending(
    casoId: string,
    rondaId: string,
    contenido: Propuesta["contenido"],
    modeloIa: string,
  ): Promise<PropuestaView> {
    return buildCreatePendingQuery(
      this.kysely,
      casoId,
      rondaId,
      contenido,
      modeloIa,
    )
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  patchGenerated(
    propuestaId: string,
    contenido: Propuesta["contenido"],
    fundamentacion: string | null,
  ): Promise<PropuestaView | undefined> {
    return buildPatchGeneratedQuery(
      this.kysely,
      propuestaId,
      contenido,
      fundamentacion,
    )
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  markEstado(
    propuestaId: string,
    estado: EstadoPropuesta,
  ): Promise<PropuestaView | undefined> {
    return buildMarkEstadoQuery(this.kysely, propuestaId, estado)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findForCase(casoId: string): Promise<PropuestaView[]> {
    return buildFindForCaseQuery(this.kysely, casoId).execute();
  }

  readBothPartyPositionsForEngine(casoId: string) {
    return this.kysely
      .selectFrom("items")
      .select(["parte_id", "categoria", "nombre", "valor_min", "valor_max"])
      .where("caso_id", "=", casoId)
      .execute();
  }
}
