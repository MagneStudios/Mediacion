import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { LegalRepository } from "./legal.repository";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const instanceId = "00000000-0000-0000-0000-000000000000";
const diasDePreaviso = 10;

async function insertAuthUser(
  kysely: Kysely<Database>,
  id: string,
  email: string,
): Promise<void> {
  await sql`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data
    ) values (
      ${instanceId}, ${id}, 'authenticated', 'authenticated', ${email}, '',
      now(), '{}', '{}'
    )
  `.execute(kysely);
}

/**
 * The state the whole punto #16 feature exists to serve, built the only way
 * the schema allows it. `legal_documents_tipo_vigente_unique` is a partial
 * unique index on `(tipo) WHERE valid_to IS NULL`, so a scheduled version can
 * only be inserted by closing the in-force row's `valid_to` at the same time.
 * That is what makes this state worth a real-database test: it cannot be
 * reproduced with a fake, and the FE mock fixtures model a shape the index
 * forbids.
 */
async function scheduleNextVersion(
  kysely: Kysely<Database>,
  version: string,
): Promise<string> {
  const validFrom = await kysely
    .selectNoFrom(
      sql<string>`(now() + (${diasDePreaviso} || ' days')::interval)`.as(
        "valid_from",
      ),
    )
    .executeTakeFirstOrThrow();
  await kysely
    .updateTable("legal_documents")
    .set({ valid_to: validFrom.valid_from })
    .where("tipo", "=", "terms")
    .where("valid_to", "is", null)
    .execute();
  await kysely
    .insertInto("legal_documents")
    .values({
      tipo: "terms",
      version,
      contenido: "## A. TEXTO NUEVO\n\nA.1. Cláusula nueva.",
      valid_from: validFrom.valid_from,
      valid_to: null,
      is_substantial: true,
      resumen_cambios: "Cambió cómo se cobra el servicio.",
    })
    .execute();
  return validFrom.valid_from;
}

describeDb("scheduled legal version against a real database", () => {
  let kysely: Kysely<Database>;
  let repository: LegalRepository;
  let planId: string | undefined;
  let vigenteVersion: string;
  const usuarioId = randomUUID();
  const programadaVersion = `v-prog-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    repository = new LegalRepository(kysely);

    await insertAuthUser(
      kysely,
      usuarioId,
      `programada-${usuarioId}@integration.test`,
    );

    const vigente = await kysely
      .selectFrom("legal_documents")
      .select("version")
      .where("tipo", "=", "terms")
      .where("valid_to", "is", null)
      .executeTakeFirstOrThrow();
    vigenteVersion = vigente.version;

    await repository.insertAcceptances([
      {
        user_id: usuarioId,
        document_type: "terms",
        document_version: vigenteVersion,
        ip: "203.0.113.7",
        user_agent: "integration",
        accepted: true,
      },
    ]);

    const plan = await kysely
      .insertInto("planes")
      .values({
        nombre: `programada-plan-${randomUUID()}`,
        limite_carpetas: 5,
        limite_casos: 5,
        limite_iteraciones_ia: 5,
        precio: 19.99,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    planId = plan.id;

    await scheduleNextVersion(kysely, programadaVersion);
  });

  afterAll(async () => {
    // The acceptance rows cannot be removed: user_agreements is append-only by
    // trigger and ON DELETE RESTRICT from auth.users, so the auth user stays
    // too. Everything that CAN be undone is undone, in dependency order.
    try {
      await kysely
        .deleteFrom("suscripciones")
        .where("plan_id", "=", planId ?? "")
        .execute();
      await kysely
        .deleteFrom("legal_documents")
        .where("version", "=", programadaVersion)
        .execute();
      await kysely
        .updateTable("legal_documents")
        .set({ valid_to: null })
        .where("tipo", "=", "terms")
        .where("version", "=", vigenteVersion)
        .execute();
      await kysely
        .deleteFrom("planes")
        .where("id", "=", planId ?? "")
        .execute();
    } finally {
      await kysely.destroy();
    }
  });

  it("serves the in-force version and the scheduled one from disjoint reads", async () => {
    const now = new Date().toISOString();

    const vigente = await repository.findVigente("terms", now);
    const programada = await repository.findProgramada("terms", now);

    expect(vigente?.version).toBe(vigenteVersion);
    expect(programada?.version).toBe(programadaVersion);
  });

  it("keeps has_accepted_current true for someone who accepted the in-force version", async () => {
    // THE regression this guards. has_accepted_current used to join on
    // `valid_to IS NULL`, which after scheduling points at the FUTURE row, so
    // it flipped to false for every user on the platform.
    await expect(
      repository.hasAcceptedCurrent(usuarioId, "terms"),
    ).resolves.toBe(true);
  });

  it("does not report the in-force version as pending during the notice window", async () => {
    const vigentes = await repository.findVigentes(new Date().toISOString());
    const terms = vigentes.find((documento) => documento.tipo === "terms");

    expect(terms?.version).toBe(vigenteVersion);
    expect(terms?.is_substantial).toBe(false);
  });

  it("still lets an accepted user contract while a version is scheduled", async () => {
    // With the old definition this raised
    // `no_aceptacion_vigente` for every existing user, unfixably: accepting
    // writes the in-force version while the check demanded the future one.
    const created = await kysely
      .insertInto("suscripciones")
      .values({ usuario_id: usuarioId, plan_id: planId as string })
      .returningAll()
      .executeTakeFirstOrThrow();

    expect(created.usuario_id).toBe(usuarioId);
  });

  it("announces the nearer publication when two are scheduled", async () => {
    const farther = `v-prog-far-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    await kysely
      .insertInto("legal_documents")
      .values({
        tipo: "terms",
        version: farther,
        contenido: "## A. MÁS LEJOS",
        valid_from: sql<string>`now() + interval '40 days'`,
        valid_to: sql<string>`now() + interval '90 days'`,
        is_substantial: false,
      })
      .execute();

    const programada = await repository.findProgramada("terms", now);

    expect(programada?.version).toBe(programadaVersion);

    await kysely
      .deleteFrom("legal_documents")
      .where("version", "=", farther)
      .execute();
  });

  it("cannot hold a scheduled version already expired, so findProgramada needs no valid_to guard", async () => {
    // `legal_documents_vigencia_ok CHECK (valid_to IS NULL OR valid_to >
    // valid_from)` makes "scheduled but already expired" unrepresentable: with
    // valid_from in the future, valid_to must be further into the future
    // still. This is why findProgramada filters on valid_from alone — a
    // valid_to guard there would be unreachable code.
    await expect(
      kysely
        .insertInto("legal_documents")
        .values({
          tipo: "privacy",
          version: `v-prog-bad-${randomUUID().slice(0, 8)}`,
          contenido: "## A. IMPOSIBLE",
          valid_from: sql<string>`now() + interval '5 days'`,
          valid_to: sql<string>`now() - interval '1 day'`,
          is_substantial: false,
        })
        .execute(),
    ).rejects.toThrow(/legal_documents_vigencia_ok/);
  });
});
