import type { Database, Json } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { Acuerdo } from "./acuerdos.types";
import { estadoAcuerdoBorrador } from "./acuerdos.types";

function acuerdoAlreadyExists(): HttpException {
  return new HttpException(
    {
      code: "acuerdo_already_exists",
      message: "An agreement already exists for this case",
    },
    HttpStatus.CONFLICT,
  );
}

@Injectable()
export class AcuerdosRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  insertDraft(casoId: string, contenido: Json): Promise<Acuerdo> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const existing = await trx
          .selectFrom("acuerdos")
          .select("id")
          .where("caso_id", "=", casoId)
          .executeTakeFirst();
        if (existing) {
          throw acuerdoAlreadyExists();
        }
        return trx
          .insertInto("acuerdos")
          .values({
            caso_id: casoId,
            contenido,
            estado: estadoAcuerdoBorrador,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
