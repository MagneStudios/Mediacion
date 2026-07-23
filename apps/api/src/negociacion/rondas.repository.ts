import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { Ronda } from "./negociacion.types";

export function buildInsertNextRondaQuery(
  db: Kysely<Database>,
  casoId: string,
  numero: number,
) {
  return db
    .insertInto("rondas")
    .values({ caso_id: casoId, numero })
    .returningAll();
}

export function buildCurrentRondaActualQuery(
  db: Kysely<Database>,
  casoId: string,
) {
  return db.selectFrom("casos").select("ronda_actual").where("id", "=", casoId);
}

@Injectable()
export class RondasRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  insertNextRonda(casoId: string, numero: number): Promise<Ronda> {
    return buildInsertNextRondaQuery(this.kysely, casoId, numero)
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  async currentRondaActual(casoId: string): Promise<number | undefined> {
    const row = await buildCurrentRondaActualQuery(
      this.kysely,
      casoId,
    ).executeTakeFirst();
    return row?.ronda_actual;
  }
}
