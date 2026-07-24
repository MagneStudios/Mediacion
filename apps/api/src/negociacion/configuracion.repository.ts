import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { KYSELY } from "../database/database.tokens";
import type { IaConfig } from "./negociacion.types";

const iaConfigKeys = ["ia_modelo", "ia_temperature", "ia_max_tokens"] as const;

export function buildReadIaConfigQuery(db: Kysely<Database>) {
  return db
    .selectFrom("configuracion")
    .select(["clave", "valor"])
    .where("clave", "in", [...iaConfigKeys]);
}

@Injectable()
export class ConfiguracionRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  async readIaConfig(): Promise<IaConfig> {
    const rows = await buildReadIaConfigQuery(this.kysely).execute();
    const valoresPorClave = new Map(rows.map((row) => [row.clave, row.valor]));
    const modelo = valoresPorClave.get("ia_modelo");
    const temperature = valoresPorClave.get("ia_temperature");
    const maxTokens = valoresPorClave.get("ia_max_tokens");
    if (
      typeof modelo !== "string" ||
      typeof temperature !== "number" ||
      typeof maxTokens !== "number"
    ) {
      throw new Error(
        "Missing or invalid ia_modelo/ia_temperature/ia_max_tokens in configuracion",
      );
    }
    return { modelo, temperature, maxTokens };
  }
}
