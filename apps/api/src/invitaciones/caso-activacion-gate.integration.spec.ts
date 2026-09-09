import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
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
 * Terms acceptance then an active suscripcion — the pair the C-01 gate looks
 * for. Terms first: the suscripcion insert is itself gated on having accepted
 * the version in force.
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
      nombre: `activacion-gate-plan-${randomUUID()}`,
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

describeDb("C-01 activation gate on joining a caso", () => {
  let kysely: Kysely<Database>;
  let invitacionesRepository: InvitacionesRepository;

  const creadorId = randomUUID();
  const suscriptoId = randomUUID();
  const sinSuscripcionId = randomUUID();
  const creadorEmail = `gate-creador-${randomUUID()}@integration.test`;
  const suscriptoEmail = `gate-suscripto-${randomUUID()}@integration.test`;
  const sinSuscripcionEmail = `gate-libre-${randomUUID()}@integration.test`;
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

    await insertAuthUser(kysely, creadorId, creadorEmail);
    await insertAuthUser(kysely, suscriptoId, suscriptoEmail);
    await insertAuthUser(kysely, sinSuscripcionId, sinSuscripcionEmail);

    const creadorSub = await giveActiveSubscription(kysely, creadorId);
    const suscriptoSub = await giveActiveSubscription(kysely, suscriptoId);
    planIds = [creadorSub.planId, suscriptoSub.planId];
    suscripcionIds = [creadorSub.suscripcionId, suscriptoSub.suscripcionId];
  });

  afterAll(async () => {
    await runCleanupSteps([
      () => cleanupAllCasesFor(creadorId),
      ...suscripcionIds.map(
        (id) => () =>
          kysely.deleteFrom("suscripciones").where("id", "=", id).execute(),
      ),
      ...planIds.map(
        (id) => () =>
          kysely.deleteFrom("planes").where("id", "=", id).execute(),
      ),
      () => deleteAuthUser(kysely, creadorId),
      () => deleteAuthUser(kysely, suscriptoId),
      () => deleteAuthUser(kysely, sinSuscripcionId),
      () => kysely.destroy(),
    ]);
  });

  async function createCaseWithInvitation(): Promise<{
    casoId: string;
    token: string;
  }> {
    const caso = await kysely
      .insertInto("casos")
      .values({
        creador_id: creadorId,
        nombre: `Caso gate ${randomUUID()}`,
        metodo: "negociacion",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await kysely
      .insertInto("caso_partes")
      .values({
        caso_id: caso.id,
        usuario_id: creadorId,
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
        tipo: "link",
        token,
        email_destino: null,
        estado: "pendiente",
        fecha_envio: new Date().toISOString(),
      })
      .execute();

    return { casoId: caso.id, token };
  }

  async function cleanupAllCasesFor(creador: string): Promise<void> {
    const casos = await kysely
      .selectFrom("casos")
      .select(["id"])
      .where("creador_id", "=", creador)
      .execute();
    for (const caso of casos) {
      await runCleanupSteps([
        () =>
          kysely
            .deleteFrom("invitaciones")
            .where("caso_id", "=", caso.id)
            .execute(),
        () =>
          kysely
            .deleteFrom("caso_partes")
            .where("caso_id", "=", caso.id)
            .execute(),
        () => kysely.deleteFrom("casos").where("id", "=", caso.id).execute(),
      ]);
    }
  }

  async function readEstado(casoId: string): Promise<string> {
    const caso = await kysely
      .selectFrom("casos")
      .select("estado")
      .where("id", "=", casoId)
      .executeTakeFirstOrThrow();
    return caso.estado;
  }

  it("activates the caso when both parties hold an active suscripcion", async () => {
    const { casoId, token } = await createCaseWithInvitation();

    const result = await invitacionesRepository.joinCase(
      token,
      suscriptoId,
      suscriptoEmail,
    );

    expect(result.estado).toBe("activo");
    await expect(readEstado(casoId)).resolves.toBe("activo");
  });

  it("holds the caso in pendiente_suscripciones when the joining party has none", async () => {
    const { casoId, token } = await createCaseWithInvitation();

    const result = await invitacionesRepository.joinCase(
      token,
      sinSuscripcionId,
      sinSuscripcionEmail,
    );

    expect(result.estado).toBe("pendiente_suscripciones");
    await expect(readEstado(casoId)).resolves.toBe("pendiente_suscripciones");
  });

  /**
   * The point of the savepoint: the gate aborting the activation must not take
   * the join down with it. Without it the whole transaction rolls back and the
   * party who accepted their invitation is a member of nothing.
   */
  it("keeps the join itself when the gate blocks the activation", async () => {
    const { casoId, token } = await createCaseWithInvitation();

    await invitacionesRepository.joinCase(
      token,
      sinSuscripcionId,
      sinSuscripcionEmail,
    );

    const miembros = await kysely
      .selectFrom("caso_partes")
      .select(["usuario_id", "rol_en_caso"])
      .where("caso_id", "=", casoId)
      .where("estado_invitacion", "=", "aceptada")
      .execute();
    expect(miembros).toHaveLength(2);
    expect(
      miembros.some((miembro) => miembro.usuario_id === sinSuscripcionId),
    ).toBe(true);

    const invitacion = await kysely
      .selectFrom("invitaciones")
      .select("estado")
      .where("token", "=", token)
      .executeTakeFirstOrThrow();
    expect(invitacion.estado).toBe("aceptada");
  });
});
