import type { Database } from "@mediacion/db-types";
import type { FactoryProvider } from "@nestjs/common";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { AppConfig } from "../config/config";
import { APP_CONFIG } from "../config/config.tokens";
import { KYSELY } from "./database.tokens";

const poolConnectionTimeoutMillis = 5000;
const poolStatementTimeoutMillis = 10000;

export const kyselyProvider: FactoryProvider<Kysely<Database>> = {
  provide: KYSELY,
  inject: [APP_CONFIG],
  useFactory: (appConfig: AppConfig): Kysely<Database> =>
    new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: appConfig.databaseUrl,
          connectionTimeoutMillis: poolConnectionTimeoutMillis,
          statement_timeout: poolStatementTimeoutMillis,
        }),
      }),
    }),
};
