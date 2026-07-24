import { createHmac, randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../../app.module";
import { KYSELY } from "../../database/database.tokens";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
const instanceId = "00000000-0000-0000-0000-000000000000";
const testWebhookSecret = "dev-placeholder-docusign-webhook";

function signRawBody(rawBody: Buffer): string {
  return createHmac("sha256", testWebhookSecret)
    .update(rawBody)
    .digest("base64");
}

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

async function deleteAuthUser(
  kysely: Kysely<Database>,
  id: string,
): Promise<void> {
  await sql`delete from auth.users where id = ${id}`.execute(kysely);
}

async function runCleanupSteps(
  steps: Array<() => Promise<unknown>>,
): Promise<void> {
  for (const step of steps) {
    try {
      await step();
    } catch {}
  }
}

describeDb("DocuSign webhook against a real app and database", () => {
  let app: INestApplication;
  let kysely: Kysely<Database>;
  let casoId: string;
  let acuerdoId: string;
  let firmaAId: string;
  let firmaBId: string;
  const envelopeId = randomUUID();
  const parteAId = randomUUID();
  const parteBId = randomUUID();
  const parteAEmail = `webhook-a-${randomUUID()}@integration.test`;
  const parteBEmail = `webhook-b-${randomUUID()}@integration.test`;

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleReference.createNestApplication({ rawBody: true });
    await app.init();

    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });

    await insertAuthUser(kysely, parteAId, parteAEmail);
    await insertAuthUser(kysely, parteBId, parteBEmail);

    const caso = await kysely
      .insertInto("casos")
      .values({
        creador_id: parteAId,
        nombre: `Caso integracion webhook ${randomUUID()}`,
        metodo: "mediacion",
        estado: "acordado",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    casoId = caso.id;

    await kysely
      .insertInto("caso_partes")
      .values([
        {
          caso_id: casoId,
          usuario_id: parteAId,
          rol_en_caso: "parte_a",
          estado_invitacion: "aceptada",
          fecha_union: new Date().toISOString(),
        },
        {
          caso_id: casoId,
          usuario_id: parteBId,
          rol_en_caso: "parte_b",
          estado_invitacion: "aceptada",
          fecha_union: new Date().toISOString(),
        },
      ])
      .execute();

    const acuerdo = await kysely
      .insertInto("acuerdos")
      .values({
        caso_id: casoId,
        contenido: { split: "50/50" },
        estado: "enviado_a_firma",
        docusign_envelope_id: envelopeId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    acuerdoId = acuerdo.id;

    const firmas = await kysely
      .insertInto("firmas")
      .values([
        {
          acuerdo_id: acuerdoId,
          usuario_id: parteAId,
          docusign_status: "pending",
        },
        {
          acuerdo_id: acuerdoId,
          usuario_id: parteBId,
          docusign_status: "pending",
        },
      ])
      .returningAll()
      .execute();
    firmaAId = firmas.find((firma) => firma.usuario_id === parteAId)?.id ?? "";
    firmaBId = firmas.find((firma) => firma.usuario_id === parteBId)?.id ?? "";
  });

  afterAll(async () => {
    await runCleanupSteps([
      () =>
        kysely
          .deleteFrom("firmas")
          .where("acuerdo_id", "=", acuerdoId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("acuerdos")
          .where("id", "=", acuerdoId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("caso_partes")
          .where("caso_id", "=", casoId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("casos")
          .where("id", "=", casoId ?? "")
          .execute(),
      () => deleteAuthUser(kysely, parteAId),
      () => deleteAuthUser(kysely, parteBId),
      () => kysely.destroy(),
      () => app.get<Kysely<Database>>(KYSELY).destroy(),
      () => app.close(),
    ]);
  });

  it("rejects a request with an invalid signature and mutates nothing", async () => {
    const payload = {
      envelopeId,
      recipientEmail: parteAEmail,
      status: "signed",
      event: "recipient-completed",
    };

    const response = await request(app.getHttpServer())
      .post("/webhooks/docusign")
      .set("X-DocuSign-Signature-1", "invalid-signature")
      .send(payload);

    expect(response.status).toBe(401);
    const firma = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("id", "=", firmaAId)
      .executeTakeFirstOrThrow();
    expect(firma.docusign_status).toBe("pending");
  });

  it("applies a validly signed event and updates the matching firma", async () => {
    const payload = {
      envelopeId,
      recipientEmail: parteAEmail,
      status: "signed",
      event: "recipient-completed",
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = signRawBody(rawBody);

    const response = await request(app.getHttpServer())
      .post("/webhooks/docusign")
      .set("Content-Type", "application/json")
      .set("X-DocuSign-Signature-1", signature)
      .send(rawBody.toString("utf8"));

    expect(response.status).toBe(200);
    const firma = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("id", "=", firmaAId)
      .executeTakeFirstOrThrow();
    expect(firma.docusign_status).toBe("signed");
    const acuerdo = await kysely
      .selectFrom("acuerdos")
      .selectAll()
      .where("id", "=", acuerdoId)
      .executeTakeFirstOrThrow();
    expect(acuerdo.estado).toBe("enviado_a_firma");
  });

  it("is idempotent for a replayed duplicate of the same event", async () => {
    const payload = {
      envelopeId,
      recipientEmail: parteAEmail,
      status: "signed",
      event: "recipient-completed",
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = signRawBody(rawBody);

    const response = await request(app.getHttpServer())
      .post("/webhooks/docusign")
      .set("Content-Type", "application/json")
      .set("X-DocuSign-Signature-1", signature)
      .send(rawBody.toString("utf8"));

    expect(response.status).toBe(200);
    const firma = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("id", "=", firmaAId)
      .executeTakeFirstOrThrow();
    expect(firma.docusign_status).toBe("signed");
  });

  it("marks the acuerdo firmado only once every party's firma is signed", async () => {
    const payload = {
      envelopeId,
      recipientEmail: parteBEmail,
      status: "signed",
      event: "recipient-completed",
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = signRawBody(rawBody);

    const response = await request(app.getHttpServer())
      .post("/webhooks/docusign")
      .set("Content-Type", "application/json")
      .set("X-DocuSign-Signature-1", signature)
      .send(rawBody.toString("utf8"));

    expect(response.status).toBe(200);
    const firmaB = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("id", "=", firmaBId)
      .executeTakeFirstOrThrow();
    expect(firmaB.docusign_status).toBe("signed");
    const acuerdo = await kysely
      .selectFrom("acuerdos")
      .selectAll()
      .where("id", "=", acuerdoId)
      .executeTakeFirstOrThrow();
    expect(acuerdo.estado).toBe("firmado");
  });
});
