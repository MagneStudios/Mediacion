import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { ActividadRepository } from "./actividad.repository";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("party-facing activity feed against a real database", () => {
  let kysely: Kysely<Database>;
  let repository: ActividadRepository;
  const parteA = randomUUID();
  const parteB = randomUUID();
  let casoId: string;

  // A value that would be unmistakable if it ever surfaced in the feed.
  const secretoDeB = "9876543210123";

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    repository = new ActividadRepository(kysely);

    for (const [id, nombre] of [
      [parteA, "A"],
      [parteB, "B"],
    ]) {
      await sql`
        insert into auth.users (id, email, raw_user_meta_data)
        values (${id}, ${`${nombre}-${id}@test.local`},
                ${JSON.stringify({ nombre, apellido: "Test" })}::jsonb)
      `.execute(kysely);
    }

    const caso = await kysely
      .insertInto("casos")
      .values({
        nombre: "actividad",
        metodo: "negociacion",
        creador_id: parteA,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    casoId = caso.id;

    await kysely
      .insertInto("caso_partes")
      .values([
        {
          caso_id: casoId,
          usuario_id: parteA,
          rol_en_caso: "parte_a",
          estado_invitacion: "aceptada",
        },
        {
          caso_id: casoId,
          usuario_id: parteB,
          rol_en_caso: "parte_b",
          estado_invitacion: "aceptada",
        },
      ])
      .execute();

    // B submits a private position. The audit trigger stores the whole row,
    // including this value, in auditoria.detalle.
    await kysely
      .insertInto("items")
      .values({
        caso_id: casoId,
        parte_id: parteB,
        categoria: "economico",
        nombre: "privado de B",
        valor_min: secretoDeB,
        valor_max: secretoDeB,
      })
      .execute();
  });

  afterAll(async () => {
    await kysely.deleteFrom("items").where("caso_id", "=", casoId).execute();
    await kysely
      .deleteFrom("caso_partes")
      .where("caso_id", "=", casoId)
      .execute();
    await kysely.deleteFrom("casos").where("id", "=", casoId).execute();
    await sql`delete from auth.users where id in (${parteA}, ${parteB})`.execute(
      kysely,
    );
    await kysely.destroy();
  });

  it("records the caso creation", async () => {
    const events = await repository.listForCaso(casoId, 100);
    expect(events.some((event) => event.accion === "INSERT_casos")).toBe(true);
  });

  it("never exposes a counterparty's raw range, in any field", async () => {
    // The value IS in auditoria.detalle — the trigger put it there. This asserts
    // the feed's whitelist keeps it out, which is the whole point of not
    // selecting `detalle`.
    const stored = await kysely
      .selectFrom("auditoria")
      .select(["detalle"])
      .where("entidad", "=", "items")
      .execute();
    expect(JSON.stringify(stored)).toContain(secretoDeB);

    const events = await repository.listForCaso(casoId, 100);
    expect(JSON.stringify(events)).not.toContain(secretoDeB);
  });

  it("never reports that the counterparty submitted anything", async () => {
    // Even without the value, "party B created an item at 14:02" leaks the
    // timing of a private submission.
    const events = await repository.listForCaso(casoId, 100);
    expect(events.some((event) => event.entidad === "items")).toBe(false);
  });

  it("exposes only accion, entidad and created_at", async () => {
    const events = await repository.listForCaso(casoId, 100);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(Object.keys(event).sort()).toEqual([
        "accion",
        "created_at",
        "entidad",
      ]);
    }
  });
});
