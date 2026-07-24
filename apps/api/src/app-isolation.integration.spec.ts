import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SignJWT } from "jose";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "./app.module";
import { KYSELY } from "./database/database.tokens";

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

async function deleteAuthUser(
  kysely: Kysely<Database>,
  id: string,
): Promise<void> {
  await sql`delete from auth.users where id = ${id}`.execute(kysely);
}

async function signAccessToken(sub: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(secret);
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

describeDb(
  "RN-01 cross-endpoint isolation matrix against the real app and database",
  () => {
    let app: INestApplication;
    let kysely: Kysely<Database>;
    let casoId: string;
    const userAId = randomUUID();
    const userBId = randomUUID();
    const userCId = randomUUID();
    const userAEmail = `matrix-a-${randomUUID()}@integration.test`;
    const userBEmail = `matrix-b-${randomUUID()}@integration.test`;
    const userCEmail = `matrix-c-${randomUUID()}@integration.test`;
    let tokenA: string;
    let tokenB: string;
    let tokenC: string;

    beforeAll(async () => {
      const moduleReference = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleReference.createNestApplication();
      await app.init();

      kysely = new Kysely<Database>({
        dialect: new PostgresDialect({
          pool: new Pool({ connectionString: process.env.DATABASE_URL }),
        }),
      });

      await insertAuthUser(kysely, userAId, userAEmail);
      await insertAuthUser(kysely, userBId, userBEmail);
      await insertAuthUser(kysely, userCId, userCEmail);
      tokenA = await signAccessToken(userAId, userAEmail);
      tokenB = await signAccessToken(userBId, userBEmail);
      tokenC = await signAccessToken(userCId, userCEmail);

      const caso = await kysely
        .insertInto("casos")
        .values({
          creador_id: userAId,
          nombre: `Caso matriz ${randomUUID()}`,
          metodo: "negociacion",
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      casoId = caso.id;

      await kysely
        .insertInto("caso_partes")
        .values([
          {
            caso_id: casoId,
            usuario_id: userAId,
            rol_en_caso: "parte_a",
            estado_invitacion: "aceptada",
            fecha_union: new Date().toISOString(),
          },
          {
            caso_id: casoId,
            usuario_id: userBId,
            rol_en_caso: "parte_b",
            estado_invitacion: "aceptada",
            fecha_union: new Date().toISOString(),
          },
        ])
        .execute();

      await kysely
        .insertInto("items")
        .values([
          {
            caso_id: casoId,
            parte_id: userAId,
            categoria: "bienes",
            nombre: "Item privado de A",
          },
          {
            caso_id: casoId,
            parte_id: userBId,
            categoria: "economico",
            nombre: "Item privado de B",
          },
        ])
        .execute();
    });

    afterAll(async () => {
      await runCleanupSteps([
        () =>
          kysely.deleteFrom("items").where("caso_id", "=", casoId).execute(),
        () =>
          kysely
            .deleteFrom("caso_partes")
            .where("caso_id", "=", casoId)
            .execute(),
        () => kysely.deleteFrom("casos").where("id", "=", casoId).execute(),
        () => deleteAuthUser(kysely, userAId),
        () => deleteAuthUser(kysely, userBId),
        () => deleteAuthUser(kysely, userCId),
        () => kysely.destroy(),
        () => app.get<Kysely<Database>>(KYSELY).destroy(),
        () => app.close(),
      ]);
    });

    it("hides case detail from a non-member with a uniform 404", async () => {
      const response = await request(app.getHttpServer())
        .get(`/casos/${casoId}`)
        .set("Authorization", `Bearer ${tokenC}`);

      expect(response.status).toBe(404);
    });

    it("hides item listing from a non-member with a uniform 404", async () => {
      const response = await request(app.getHttpServer())
        .get(`/casos/${casoId}/items`)
        .set("Authorization", `Bearer ${tokenC}`);

      expect(response.status).toBe(404);
    });

    it("rejects item creation from a non-member with a uniform 404", async () => {
      const response = await request(app.getHttpServer())
        .post(`/casos/${casoId}/items`)
        .set("Authorization", `Bearer ${tokenC}`)
        .send({ categoria: "bienes", nombre: "Intento ajeno" });

      expect(response.status).toBe(404);
    });

    it("rejects invitation creation from a non-member with a uniform 404", async () => {
      const response = await request(app.getHttpServer())
        .post(`/casos/${casoId}/invitaciones`)
        .set("Authorization", `Bearer ${tokenC}`)
        .send({ tipo: "link" });

      expect(response.status).toBe(404);
    });

    it("returns only A's own item through the real endpoint, never B's", async () => {
      const response = await request(app.getHttpServer())
        .get(`/casos/${casoId}/items`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].nombre).toBe("Item privado de A");
    });

    it("returns only B's own item through the real endpoint, never A's", async () => {
      const response = await request(app.getHttpServer())
        .get(`/casos/${casoId}/items`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].nombre).toBe("Item privado de B");
    });

    it("grants case detail access to an accepted member", async () => {
      const response = await request(app.getHttpServer())
        .get(`/casos/${casoId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(casoId);
    });
  },
);
