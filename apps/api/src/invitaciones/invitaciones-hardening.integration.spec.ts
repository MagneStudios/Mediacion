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

/**
 * Terms acceptance, then an *active* suscripcion — both required for
 * `activateIfNuevo` to clear the C-01 gate (`trg_casos_gate_suscripciones`,
 * `20260902120000_c01_gate_suscripciones.sql`) when this fixture's join
 * flow transitions the caso to `activo`. Without this, `joinCase` throws
 * `caso_bloqueado_suscripciones` instead of returning the joined caso.
 *
 * Mirrors the fixture in `pagos/pagos-webhook.integration.spec.ts`. Terms
 * acceptance is itself gated by its own BEFORE INSERT trigger
 * (`trigger_validate_suscripcion_aceptacion`, `20260814170000_tyc_legal.sql`),
 * so the order matters: accept first, then insert the suscripcion.
 */
async function giveActiveSubscription(
  kysely: Kysely<Database>,
  usuarioId: string,
): Promise<{ planId: string; suscripcionId: string }> {
  const now = new Date().toISOString();
  const terms = await kysely
    .selectFrom("legal_documents")
    .select("version")
    .where("tipo", "=", "terms")
    .where("valid_from", "<=", now)
    .where((eb) =>
      eb.or([eb("valid_to", "is", null), eb("valid_to", ">", now)]),
    )
    .executeTakeFirstOrThrow();
  await kysely
    .insertInto("user_agreements")
    .values({
      user_id: usuarioId,
      document_type: "terms",
      document_version: terms.version,
      ip: "203.0.113.7",
      user_agent: "integration",
      accepted: true,
    })
    .execute();

  const plan = await kysely
    .insertInto("planes")
    .values({
      nombre: `invitaciones-hardening-plan-${randomUUID()}`,
      limite_carpetas: 5,
      limite_casos: 5,
      limite_iteraciones_ia: 5,
      precio: 19.99,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const suscripcion = await kysely
    .insertInto("suscripciones")
    .values({ usuario_id: usuarioId, plan_id: plan.id, estado: "activa" })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { planId: plan.id, suscripcionId: suscripcion.id };
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
    let planIds: string[] = [];
    let suscripcionIds: string[] = [];

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

      // C-01: el join transiciona el caso a `activo`, y el gate exige
      // suscripción activa en las dos partes. Sin esto, cada test de este
      // archivo que espera un join exitoso choca contra
      // `caso_bloqueado_suscripciones` en vez de avanzar.
      const subscriptionA = await giveActiveSubscription(kysely, userAId);
      const subscriptionB = await giveActiveSubscription(kysely, userBId);
      planIds = [subscriptionA.planId, subscriptionB.planId];
      suscripcionIds = [
        subscriptionA.suscripcionId,
        subscriptionB.suscripcionId,
      ];
    });

    afterAll(async () => {
      await runCleanupSteps([
        () => cleanupAllCasesFor(userAId),
        ...suscripcionIds.map(
          (id) => () =>
            kysely.deleteFrom("suscripciones").where("id", "=", id).execute(),
        ),
        ...planIds.map(
          (id) => () =>
            kysely.deleteFrom("planes").where("id", "=", id).execute(),
        ),
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
