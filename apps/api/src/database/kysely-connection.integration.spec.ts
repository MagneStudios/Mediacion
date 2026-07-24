import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("real Kysely connection", () => {
  let kysely: Kysely<Database>;

  beforeAll(() => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
  });

  afterAll(async () => {
    await kysely.destroy();
  });

  it("executes a trivial round-trip query against the real database", async () => {
    const result = await sql<{
      one: number;
    }>`select 1 as one`.execute(kysely);

    expect(result.rows[0]?.one).toBe(1);
  });
});
