import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import { type Kysely, sql } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import {
  quotaKindNegotiation,
  type UsageCounter,
  usageCounterColumns,
} from "./pagos.types";

@Injectable()
export class UsageRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  findCounter(
    usuarioId: string,
    periodStart: string,
  ): Promise<UsageCounter | undefined> {
    return this.kysely
      .selectFrom("usage_counters")
      .select(usageCounterColumns)
      .where("usuario_id", "=", usuarioId)
      .where("period_start", "=", periodStart)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  consumeNegotiation(trx: Kysely<Database>, usuarioId: string): Promise<void> {
    return sql`select public.consume_quota(${usuarioId}::uuid, ${quotaKindNegotiation}::text)`
      .execute(trx)
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
