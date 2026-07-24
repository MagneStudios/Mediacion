import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { Auditoria } from "./types";

@Injectable()
export class AuditoriaRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  findPage(offset: number, limit: number): Promise<Auditoria[]> {
    return this.kysely
      .selectFrom("auditoria")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  count(): Promise<number> {
    return this.kysely
      .selectFrom("auditoria")
      .select(({ fn }) => [fn.countAll().as("total")])
      .executeTakeFirstOrThrow()
      .then((row) => Number(row.total))
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
