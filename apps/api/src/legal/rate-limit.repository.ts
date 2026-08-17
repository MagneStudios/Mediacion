import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";

const firstHit = 1;

@Injectable()
export class RateLimitRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  async countHit(clave: string, ventanaInicio: string): Promise<number> {
    const row = await this.kysely
      .insertInto("rate_limit_counters")
      .values({ clave, ventana_inicio: ventanaInicio, hits: firstHit })
      .onConflict((oc) =>
        oc.columns(["clave", "ventana_inicio"]).doUpdateSet((eb) => ({
          hits: eb("rate_limit_counters.hits", "+", firstHit),
        })),
      )
      .returning("hits")
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
    return row?.hits ?? firstHit;
  }

  forgetWindowsBefore(ventanaInicio: string): Promise<unknown> {
    return this.kysely
      .deleteFrom("rate_limit_counters")
      .where("ventana_inicio", "<", ventanaInicio)
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
