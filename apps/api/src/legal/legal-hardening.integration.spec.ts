import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { LegalRepository } from "./legal.repository";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
const instanceId = "00000000-0000-0000-0000-000000000000";

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

describeDb("legal module hardening against a real database", () => {
  let kysely: Kysely<Database>;
  let repository: LegalRepository;
  let usuarioId: string;

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    repository = new LegalRepository(kysely);
    usuarioId = randomUUID();
    await insertAuthUser(
      kysely,
      usuarioId,
      `legal-${usuarioId}@integration.test`,
    );
  });

  afterAll(async () => {
    await kysely.destroy();
  });

  it("serves a current version for both public documents", async () => {
    const now = new Date().toISOString();
    const terms = await repository.findVigente("terms", now);
    const privacy = await repository.findVigente("privacy", now);

    expect(terms?.valid_to).toBeNull();
    expect(privacy?.valid_to).toBeNull();
  });

  it("rejects an UPDATE on user_agreements even for the service role", async () => {
    const terms = await repository.findVigente(
      "terms",
      new Date().toISOString(),
    );
    await repository.insertAcceptances([
      {
        user_id: usuarioId,
        document_type: "terms",
        document_version: terms?.version ?? "v1.0",
        ip: "203.0.113.7",
        user_agent: "integration/1.0",
        accepted: true,
      },
    ]);

    await expect(
      sql`update user_agreements set accepted = false where user_id = ${usuarioId}`.execute(
        kysely,
      ),
    ).rejects.toThrow();
  });

  it("rejects a DELETE on user_agreements even for the service role", async () => {
    await expect(
      sql`delete from user_agreements where user_id = ${usuarioId}`.execute(
        kysely,
      ),
    ).rejects.toThrow();
  });

  it("answers has_accepted_current for the version that was actually accepted", async () => {
    await expect(
      repository.hasAcceptedCurrent(usuarioId, "terms"),
    ).resolves.toBe(true);
    await expect(
      repository.hasAcceptedCurrent(usuarioId, "privacy"),
    ).resolves.toBe(false);
  });

  it("claims a notice once and only once, which is what makes the sweep idempotent", async () => {
    const first = await repository.claimAviso(usuarioId, "terms", "v-int-1");
    const second = await repository.claimAviso(usuarioId, "terms", "v-int-1");

    expect(first?.id).toBeDefined();
    expect(second).toBeUndefined();
  });

  it("keeps a claimed notice pending until its delivery is stamped", async () => {
    const pending = await repository.findAvisoPendiente(
      usuarioId,
      "terms",
      "v-int-1",
    );
    expect(pending?.id).toBeDefined();

    await repository.markAvisoEnviado(
      pending?.id ?? "",
      new Date().toISOString(),
    );

    await expect(
      repository.findAvisoPendiente(usuarioId, "terms", "v-int-1"),
    ).resolves.toBeUndefined();
  });

  it("stamps a tracking code on a withdrawal request", async () => {
    const created = await repository.insertArrepentimiento(
      {
        nombre: "Integration",
        email: "integration@example.com",
        detalle: "baja de prueba",
      },
      usuarioId,
    );

    expect(created?.codigo).toMatch(/^ARR-\d{4}$/);
  });

  it("stamps a tracking code on a contact request", async () => {
    const created = await repository.insertContacto(
      {
        nombre: "Integration",
        email: "integration@example.com",
        mensaje: "consulta de prueba",
      },
      usuarioId,
    );

    expect(created?.codigo).toMatch(/^CON-\d{4}$/);
  });
});
