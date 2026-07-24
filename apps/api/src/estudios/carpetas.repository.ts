import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { Carpeta, CasoResumen } from "./estudios.types";

@Injectable()
export class CarpetasRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  listCasosByCarpeta(estudioId: string): Promise<CasoResumen[]> {
    return this.kysely
      .selectFrom("casos")
      .select(["id", "nombre", "estado", "metodo", "created_at"])
      .where("estudio_id", "=", estudioId)
      .execute();
  }

  createCarpeta(estudioId: string, nombre: string): Promise<Carpeta> {
    return this.kysely
      .insertInto("carpetas")
      .values({ estudio_id: estudioId, nombre })
      .returningAll()
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
