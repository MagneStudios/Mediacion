import type { Database } from "@mediacion/db-types";
import type { Provider } from "@nestjs/common";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { KYSELY } from "./database.tokens";

export const kyselyProvider: Provider = {
  provide: KYSELY,
  useFactory: (): Kysely<Database> =>
    new Kysely<Database>({
      dialect: new PostgresDialect({ pool: new Pool() }),
    }),
};
