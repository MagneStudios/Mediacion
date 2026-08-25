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
const testWebhookSecret = "dev-placeholder-signnow-webhook";
const signnowBasePath = "https://api-eval.signnow.com";

function signRawBody(rawBody: Buffer): string {
  return createHmac("sha256", testWebhookSecret).update(rawBody).digest("hex");
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

function okJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describeDb("signNow webhook against a real app and database", () => {
  let app: INestApplication;
  let kysely: Kysely<Database>;
  let casoId: string;
  let acuerdoId: string;
  let firmaAId: string;
  let firmaBId: string;
  let signnowDocument: unknown;
  const documentId = randomUUID();
  const parteAId = randomUUID();
  const parteBId = randomUUID();
  const parteAEmail = `signnow-a-${randomUUID()}@integration.test`;
  const parteBEmail = `signnow-b-${randomUUID()}@integration.test`;

  beforeAll(async () => {
    /**
     * Only signNow's own API is mocked (token + document fetch): the module,
     * the HTTP pipeline and the database stay real.
     */
    jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === `${signnowBasePath}/oauth2/token`) {
          return okJsonResponse({
            access_token: "integration-token",
            expires_in: 3600,
          });
        }
        if (url === `${signnowBasePath}/document/${documentId}`) {
          return okJsonResponse(signnowDocument);
        }
        throw new Error(`Unexpected fetch call in integration test: ${url}`);
      });

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
        nombre: `Caso integracion signnow ${randomUUID()}`,
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
        docusign_envelope_id: documentId,
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
    jest.restoreAllMocks();
  });

  it("rejects a request with an invalid signature and mutates nothing", async () => {
    const payload = {
      meta: { event: "document.update" },
      content: { document_id: documentId },
    };

    const response = await request(app.getHttpServer())
      .post("/webhooks/signnow")
      .set("x-signnow-signature", "invalid-signature")
      .send(payload);

    expect(response.status).toBe(401);
    const firma = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("id", "=", firmaAId)
      .executeTakeFirstOrThrow();
    expect(firma.docusign_status).toBe("pending");
  });

  it("applies the statuses derived from the re-fetched signNow document on a validly signed public callback", async () => {
    signnowDocument = {
      requests: [],
      field_invites: [
        // Upper-cased on purpose: matching must be case-insensitive.
        { email: parteAEmail.toUpperCase(), status: "fulfilled" },
        { email: parteBEmail, status: "created" },
      ],
    };
    const payload = {
      meta: { event: "document.update" },
      content: { document_id: documentId },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = signRawBody(rawBody);

    // No Authorization header: the route must be @Public().
    const response = await request(app.getHttpServer())
      .post("/webhooks/signnow")
      .set("Content-Type", "application/json")
      .set("x-signnow-signature", signature)
      .send(rawBody.toString("utf8"));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    const firmaA = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("id", "=", firmaAId)
      .executeTakeFirstOrThrow();
    expect(firmaA.docusign_status).toBe("signed");
    const firmaB = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("id", "=", firmaBId)
      .executeTakeFirstOrThrow();
    expect(firmaB.docusign_status).toBe("sent");
    const acuerdo = await kysely
      .selectFrom("acuerdos")
      .selectAll()
      .where("id", "=", acuerdoId)
      .executeTakeFirstOrThrow();
    expect(acuerdo.estado).toBe("enviado_a_firma");
  });

  it("is idempotent for a replayed duplicate of the same callback", async () => {
    const payload = {
      meta: { event: "document.update" },
      content: { document_id: documentId },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = signRawBody(rawBody);

    const response = await request(app.getHttpServer())
      .post("/webhooks/signnow")
      .set("Content-Type", "application/json")
      .set("x-signnow-signature", signature)
      .send(rawBody.toString("utf8"));

    expect(response.status).toBe(200);
    const firmaA = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("id", "=", firmaAId)
      .executeTakeFirstOrThrow();
    expect(firmaA.docusign_status).toBe("signed");
    const firmaB = await kysely
      .selectFrom("firmas")
      .selectAll()
      .where("id", "=", firmaBId)
      .executeTakeFirstOrThrow();
    expect(firmaB.docusign_status).toBe("sent");
  });

  it("marks the acuerdo firmado only once every party's firma is signed", async () => {
    signnowDocument = {
      requests: [],
      field_invites: [
        { email: parteAEmail, status: "fulfilled" },
        { email: parteBEmail, status: "fulfilled" },
      ],
    };
    const payload = {
      meta: { event: "document.complete" },
      content: { document_id: documentId },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = signRawBody(rawBody);

    const response = await request(app.getHttpServer())
      .post("/webhooks/signnow")
      .set("Content-Type", "application/json")
      .set("x-signnow-signature", signature)
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
