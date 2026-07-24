import type { Database, Json } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import { type Kysely, sql } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import { IA_KEYS } from "./ia-allowlist";
import type { IaKey, UpdateIaConfigDto } from "./types";

@Injectable()
export class ConfiguracionRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  upsertIaKeys(patch: UpdateIaConfigDto): Promise<IaKey[]> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const updated: IaKey[] = [];
        for (const clave of IA_KEYS) {
          const valor = patch[clave];
          if (valor === undefined) {
            continue;
          }
          await this.upsertOne(trx, clave, valor);
          updated.push(clave);
        }
        return updated;
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  private upsertOne(
    trx: Kysely<Database>,
    clave: IaKey,
    valor: string | number,
  ): Promise<void> {
    const jsonValor = sql<Json>`${JSON.stringify(valor)}::jsonb`;
    return trx
      .insertInto("configuracion")
      .values({ clave, valor: jsonValor })
      .onConflict((oc) => oc.column("clave").doUpdateSet({ valor: jsonValor }))
      .execute()
      .then(() => undefined);
  }
}
