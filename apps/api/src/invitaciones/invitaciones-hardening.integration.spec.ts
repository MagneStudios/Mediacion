import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus } from "@nestjs/common";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { CasosRepository } from "../casos/casos.repository";
import { InvitacionesRepository } from "./invitaciones.repository";

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
  "invitation TTL and email enforcement against a real database",
  () => {
    let kysely: Kysely<Database>;
    let invitacionesRepository: InvitacionesRepository;
    const userAId = randomUUID();
    const userBId = randomUUID();
    const userAEmail = `hardening-a-${randomUUID()}@integration.test`;
    const userBEmail = `hardening-b-${randomUUID()}@integration.test`;

    beforeAll(async () => {
      kysely = new Kysely<Database>({
        dialect: new PostgresDialect({
          pool: new Pool({ connectionString: process.env.DATABASE_URL }),
        }),
      });
      invitacionesRepository = new InvitacionesRepository(
        kysely,
        new CasosRepository(kysely),
      );

      await insertAuthUser(kysely, userAId, userAEmail);
      await insertAuthUser(kysely, userBId, userBEmail);
    });

    afterAll(async () => {
      await runCleanupSteps([
        () => cleanupAllCasesFor(userAId),
        () => deleteAuthUser(kysely, userAId),
        () => deleteAuthUser(kysely, userBId),
        () => kysely.destroy(),
      ]);
    });

    async function createCaseWithInvitation(options: {
      tipo: "link" | "email";
      emailDestino?: string;
      fechaEnvio: Date;
    }): Promise<{ casoId: string; token: string }> {
      const caso = await kysely
        .insertInto("casos")
        .values({
          creador_id: userAId,
          nombre: `Caso hardening ${randomUUID()}`,
          metodo: "negociacion",
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await kysely
        .insertInto("caso_partes")
        .values({
          caso_id: caso.id,
          usuario_id: userAId,
          rol_en_caso: "parte_a",
          estado_invitacion: "aceptada",
          fecha_union: new Date().toISOString(),
        })
        .execute();

      const token = randomUUID();
      await kysely
        .insertInto("invitaciones")
        .values({
          caso_id: caso.id,
          tipo: options.tipo,
          token,
          email_destino: options.emailDestino ?? null,
          estado: "pendiente",
          fecha_envio: options.fechaEnvio.toISOString(),
        })
        .execute();

      return { casoId: caso.id, token };
    }

    async function cleanupCase(casoId: string): Promise<void> {
      await runCleanupSteps([
        () =>
          kysely
            .deleteFrom("invitaciones")
            .where("caso_id", "=", casoId)
            .execute(),
        () =>
          kysely
            .deleteFrom("caso_partes")
            .where("caso_id", "=", casoId)
            .execute(),
        () => kysely.deleteFrom("casos").where("id", "=", casoId).execute(),
      ]);
    }

    async function cleanupAllCasesFor(creadorId: string): Promise<void> {
      const casos = await kysely
        .selectFrom("casos")
        .select(["id"])
        .where("creador_id", "=", creadorId)
        .execute();
      for (const caso of casos) {
        await cleanupCase(caso.id);
      }
    }

    it("rejects a token sent 8 days ago with a real 404, marking it expirada", async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const { casoId, token } = await createCaseWithInvitation({
        tipo: "link",
        fechaEnvio: eightDaysAgo,
      });

      let thrown: unknown;
      try {
        await invitacionesRepository.joinCase(token, userBId, userBEmail);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);

      const invitacion = await kysely
        .selectFrom("invitaciones")
        .select(["estado"])
        .where("caso_id", "=", casoId)
        .executeTakeFirstOrThrow();
      expect(invitacion.estado).toBe("expirada");

      await cleanupCase(casoId);
    });

    it("accepts a token sent 6 days ago, still within the 7-day TTL", async () => {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      const { casoId, token } = await createCaseWithInvitation({
        tipo: "link",
        fechaEnvio: sixDaysAgo,
      });

      const result = await invitacionesRepository.joinCase(
        token,
        userBId,
        userBEmail,
      );

      expect(result.estado).toBe("activo");

      await cleanupCase(casoId);
    });

    it("rejects a mismatched email on an email-type invitation with a real 403", async () => {
      const { casoId, token } = await createCaseWithInvitation({
        tipo: "email",
        emailDestino: "someone-else@integration.test",
        fechaEnvio: new Date(),
      });

      let thrown: unknown;
      try {
        await invitacionesRepository.joinCase(token, userBId, userBEmail);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);

      const miembros = await kysely
        .selectFrom("caso_partes")
        .select(["usuario_id"])
        .where("caso_id", "=", casoId)
        .execute();
      expect(miembros).toHaveLength(1);

      await cleanupCase(casoId);
    });

    it("accepts a matching email on an email-type invitation", async () => {
      const { casoId, token } = await createCaseWithInvitation({
        tipo: "email",
        emailDestino: userBEmail,
        fechaEnvio: new Date(),
      });

      const result = await invitacionesRepository.joinCase(
        token,
        userBId,
        userBEmail,
      );

      expect(result.estado).toBe("activo");

      await cleanupCase(casoId);
    });
  },
);
