import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { InversoresRepository } from "./inversores.repository";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("inversores parametrized insert against a real database", () => {
  let kysely: Kysely<Database>;
  let inversoresRepository: InversoresRepository;
  let createdId: string | undefined;

  beforeAll(() => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    inversoresRepository = new InversoresRepository(kysely);
  });

  afterAll(async () => {
    if (createdId) {
      await kysely
        .deleteFrom("inversores")
        .where("id", "=", createdId)
        .execute();
    }
    await kysely.destroy();
  });

  it("stores a SQL-meta payload as literal data without executing an unintended statement", async () => {
    const maliciousNombre = `'; DROP TABLE inversores;-- ${randomUUID()}`;

    const created = await inversoresRepository.create({
      nombre: maliciousNombre,
      email: `injection-${randomUUID()}@integration.test`,
      capital_disponible: "10000",
      experiencia: "5 años",
    });
    createdId = created.id;

    const stillExists = await kysely
      .selectFrom("inversores")
      .select("id")
      .where("id", "=", created.id)
      .executeTakeFirst();

    expect(created.nombre).toBe(maliciousNombre);
    expect(stillExists).toBeDefined();
  });
});
