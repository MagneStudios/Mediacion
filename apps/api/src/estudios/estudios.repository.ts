import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { Estudio, MarcaConfig } from "./estudios.types";

@Injectable()
export class EstudiosRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  findOwn(estudioId: string): Promise<Estudio | undefined> {
    return this.kysely
      .selectFrom("estudios")
      .selectAll()
      .where("id", "=", estudioId)
      .executeTakeFirst();
  }

  updateMarcaConfig(
    estudioId: string,
    marcaConfig: MarcaConfig,
  ): Promise<Estudio | undefined> {
    return this.kysely
      .updateTable("estudios")
      .set({ marca_config: marcaConfig })
      .where("id", "=", estudioId)
      .returningAll()
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
