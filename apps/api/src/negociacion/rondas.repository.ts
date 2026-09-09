import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { Ronda } from "./negociacion.types";

export function buildInsertNextRondaQuery(
  db: Kysely<Database>,
  casoId: string,
  negociacionId: string,
  numero: number,
) {
  return db
    .insertInto("rondas")
    .values({ caso_id: casoId, negociacion_id: negociacionId, numero })
    .returningAll();
}

export function buildActiveNegociacionQuery(
  db: Kysely<Database>,
  casoId: string,
) {
  return db
    .selectFrom("negociaciones")
    .select(["id", "round"])
    .where("caso_id", "=", casoId)
    .where("materia", "is", null);
}

/**
 * `negociaciones.round` has no trigger keeping it in sync with the highest
 * `rondas.numero` anymore (the migration that split rondas by negociacion_id
 * also dropped `sync_ronda_actual()`); every insert of a new ronda must bump
 * it explicitly or the case looks stuck on round 1 forever.
 */
export function buildBumpNegociacionRoundQuery(
  db: Kysely<Database>,
  negociacionId: string,
  numero: number,
) {
  return db
    .updateTable("negociaciones")
    .set({ round: numero })
    .where("id", "=", negociacionId);
}

export function buildFindByNumeroQuery(
  db: Kysely<Database>,
  casoId: string,
  numero: number,
) {
  return db
    .selectFrom("rondas")
    .selectAll()
    .where("caso_id", "=", casoId)
    .where("numero", "=", numero);
}

@Injectable()
export class RondasRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  insertNextRonda(
    casoId: string,
    negociacionId: string,
    numero: number,
  ): Promise<Ronda> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const ronda = await buildInsertNextRondaQuery(
          trx,
          casoId,
          negociacionId,
          numero,
        ).executeTakeFirstOrThrow();
        await buildBumpNegociacionRoundQuery(
          trx,
          negociacionId,
          numero,
        ).execute();
        return ronda;
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  resolveActiveNegociacion(
    casoId: string,
  ): Promise<{ id: string; round: number } | undefined> {
    return buildActiveNegociacionQuery(this.kysely, casoId).executeTakeFirst();
  }

  findByNumero(casoId: string, numero: number): Promise<Ronda | undefined> {
    return buildFindByNumeroQuery(
      this.kysely,
      casoId,
      numero,
    ).executeTakeFirst();
  }
}
