import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { CreateSuscripcionInput, Suscripcion } from "./pagos.types";

@Injectable()
export class SuscripcionesRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  createSuscripcion(input: CreateSuscripcionInput): Promise<Suscripcion> {
    return this.kysely
      .insertInto("suscripciones")
      .values({
        usuario_id: input.usuario_id,
        estudio_id: input.estudio_id,
        plan_id: input.plan_id,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
