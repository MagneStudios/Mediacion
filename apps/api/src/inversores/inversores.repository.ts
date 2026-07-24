import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { CreateInversorDto, Inversor } from "./types";

@Injectable()
export class InversoresRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  create(input: CreateInversorDto): Promise<Inversor> {
    return this.kysely
      .insertInto("inversores")
      .values({
        nombre: input.nombre,
        email: input.email,
        capital_disponible: input.capital_disponible,
        experiencia: input.experiencia,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
