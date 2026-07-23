import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  DecisionPropuesta,
  RespuestaPropuesta,
} from "./negociacion.types";

export function buildInsertRespuestaQuery(
  db: Kysely<Database>,
  propuestaId: string,
  parteId: string,
  decision: DecisionPropuesta,
) {
  return db
    .insertInto("respuestas_propuesta")
    .values({ propuesta_id: propuestaId, parte_id: parteId, decision })
    .returningAll();
}

export function buildFindByPropuestaQuery(
  db: Kysely<Database>,
  propuestaId: string,
) {
  return db
    .selectFrom("respuestas_propuesta")
    .selectAll()
    .where("propuesta_id", "=", propuestaId);
}

@Injectable()
export class RespuestasRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  insert(
    propuestaId: string,
    parteId: string,
    decision: DecisionPropuesta,
  ): Promise<RespuestaPropuesta> {
    return buildInsertRespuestaQuery(
      this.kysely,
      propuestaId,
      parteId,
      decision,
    )
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findByPropuesta(propuestaId: string): Promise<RespuestaPropuesta[]> {
    return buildFindByPropuestaQuery(this.kysely, propuestaId).execute();
  }
}
