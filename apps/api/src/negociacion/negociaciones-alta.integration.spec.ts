import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { HttpException } from "@nestjs/common";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { CasosRepository } from "../casos/casos.repository";
import { NegociacionesRepository } from "./negociaciones.repository";
import { RondasRepository } from "./rondas.repository";

/**
 * The claim this file exists to check is the one no fake can: that a caso can
 * hold more than one negociacion at all. `negociaciones_caso_materia_unique`,
 * `rondas_negociacion_numero_unique` and the `ON CONFLICT DO NOTHING` that
 * leans on the first are all decided by Postgres, and the unit specs record
 * their shape without ever executing them.
 */
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

/**
 * Terms acceptance then an active suscripcion — the pair the C-01 gate looks
 * for, same shape as `invitaciones/caso-activacion-gate.integration.spec.ts`.
 * Without it every hop into `activo`/`en_negociacion` raises
 * `caso_bloqueado_suscripciones`, including the reopen a new materia triggers
 * on an `acordado` caso.
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
      nombre: `alta-materia-plan-${randomUUID()}`,
      limite_carpetas: 5,
      limite_casos: 50,
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

describeDb("Opening a second negociacion against a real database", () => {
  let kysely: Kysely<Database>;
  let repository: NegociacionesRepository;
  let casosRepository: CasosRepository;
  let rondasRepository: RondasRepository;
  const creadorId = randomUUID();
  const cleanup: Array<() => Promise<unknown>> = [];

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    casosRepository = new CasosRepository(kysely);
    rondasRepository = new RondasRepository(kysely);
    repository = new NegociacionesRepository(kysely, casosRepository);
    await insertAuthUser(
      kysely,
      creadorId,
      `alta-negociacion-${randomUUID()}@integration.test`,
    );
    cleanup.push(() =>
      sql`delete from auth.users where id = ${creadorId}`.execute(kysely),
    );
    const { planId, suscripcionId } = await giveActiveSubscription(
      kysely,
      creadorId,
    );
    cleanup.push(() =>
      kysely.deleteFrom("planes").where("id", "=", planId).execute(),
    );
    cleanup.push(() =>
      kysely
        .deleteFrom("suscripciones")
        .where("id", "=", suscripcionId)
        .execute(),
    );
    cleanup.push(() =>
      kysely
        .deleteFrom("user_agreements")
        .where("user_id", "=", creadorId)
        .execute(),
    );
  });

  afterAll(async () => {
    await runCleanupSteps([...cleanup].reverse());
    await kysely.destroy();
  });

  function registerCasoCleanup(casoId: string): void {
    cleanup.push(() =>
      kysely.deleteFrom("casos").where("id", "=", casoId).execute(),
    );
    cleanup.push(() =>
      kysely
        .deleteFrom("negociaciones")
        .where("caso_id", "=", casoId)
        .execute(),
    );
    cleanup.push(() =>
      kysely.deleteFrom("caso_partes").where("caso_id", "=", casoId).execute(),
    );
    cleanup.push(() =>
      kysely.deleteFrom("rondas").where("caso_id", "=", casoId).execute(),
    );
  }

  /**
   * The caso is walked through the state machine instead of being inserted in
   * its final estado: since migration 44 `validate_caso_estado_transition`
   * also runs on INSERT and accepts only `nuevo` or `pendiente_suscripciones`.
   */
  async function seedCasoConParte(estado: "en_negociacion" | "acordado") {
    const caso = await casosRepository.createCaseWithParteA(
      { nombre: `Caso alta materia ${randomUUID()}`, metodo: "mediacion" },
      creadorId,
    );
    registerCasoCleanup(caso.id);
    const pasos =
      estado === "acordado"
        ? (["activo", "en_negociacion", "acordado"] as const)
        : (["activo", "en_negociacion"] as const);
    for (const paso of pasos) {
      await kysely
        .updateTable("casos")
        .set({ estado: paso })
        .where("id", "=", caso.id)
        .execute();
    }
    return caso.id;
  }

  it("a caso created the production way starts with exactly one materia-less negociacion", async () => {
    const caso = await casosRepository.createCaseWithParteA(
      { nombre: `Caso base ${randomUUID()}`, metodo: "conciliacion" },
      creadorId,
    );
    registerCasoCleanup(caso.id);

    const negociaciones = await repository.listByCaso(caso.id);

    expect(negociaciones).toHaveLength(1);
    expect(negociaciones[0].subject_type).toBeNull();
    expect(negociaciones[0].metodo).toBe("conciliacion");
    expect(negociaciones[0].acuerdo_vigente).toBeNull();
  });

  it("two crear calls take that caso to three negociaciones, in created_at order", async () => {
    const casoId = await seedCasoConParte("en_negociacion");

    const tenencia = await repository.crear(casoId, "tenencia", "mediacion");
    const alimentos = await repository.crear(casoId, "alimentos", "mediacion");

    expect(tenencia.id).not.toBe(alimentos.id);
    expect(alimentos.estado).toBe("borrador");
    expect(alimentos.ronda_actual).toBe(1);
    expect(alimentos.acuerdo_vigente).toBeNull();

    const negociaciones = await repository.listByCaso(casoId);

    expect(negociaciones.map((n) => n.subject_type)).toEqual([
      null,
      "tenencia",
      "alimentos",
    ]);
  });

  it("rejects a materia the caso already has with 409, leaving one row", async () => {
    const casoId = await seedCasoConParte("en_negociacion");
    await repository.crear(casoId, "bienes", "mediacion");

    let thrown: unknown;
    try {
      await repository.crear(casoId, "bienes", "mediacion");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(409);
    expect((thrown as HttpException).getResponse()).toEqual(
      expect.objectContaining({ code: "negociacion_materia_already_exists" }),
    );

    const bienes = await kysely
      .selectFrom("negociaciones")
      .select("id")
      .where("caso_id", "=", casoId)
      .where("materia", "=", "bienes")
      .execute();
    expect(bienes).toHaveLength(1);
  });

  it("brings an acordado caso back to en_negociacion: not every materia is signed any more", async () => {
    const casoId = await seedCasoConParte("acordado");

    await repository.crear(casoId, "tenencia", "mediacion");

    const caso = await kysely
      .selectFrom("casos")
      .select("estado")
      .where("id", "=", casoId)
      .executeTakeFirstOrThrow();
    expect(caso.estado).toBe("en_negociacion");
  });

  it("leaves a caso that was never acordado exactly as it found it", async () => {
    const casoId = await seedCasoConParte("en_negociacion");

    await repository.crear(casoId, "tenencia", "mediacion");

    const caso = await kysely
      .selectFrom("casos")
      .select("estado")
      .where("id", "=", casoId)
      .executeTakeFirstOrThrow();
    expect(caso.estado).toBe("en_negociacion");
  });

  it("keeps GET /casos readable: ronda_actual still resolves off the materia-less negociacion", async () => {
    const casoId = await seedCasoConParte("en_negociacion");
    await repository.crear(casoId, "tenencia", "mediacion");
    await repository.crear(casoId, "alimentos", "mediacion");

    const detail = await casosRepository.findDetailForMember(casoId, creadorId);

    expect(detail?.ronda_actual).toBe(1);
  });

  it("gives each materia its own ronda 1, and findByNumero returns the right one", async () => {
    const casoId = await seedCasoConParte("en_negociacion");
    const tenencia = await repository.crear(casoId, "tenencia", "mediacion");
    const alimentos = await repository.crear(casoId, "alimentos", "mediacion");

    await rondasRepository.insertNextRonda(casoId, tenencia.id, 1);
    await rondasRepository.insertNextRonda(casoId, alimentos.id, 1);

    const rondaAlimentos = await rondasRepository.findByNumero(alimentos.id, 1);

    expect(rondaAlimentos?.negociacion_id).toBe(alimentos.id);
    expect(rondaAlimentos?.caso_id).toBe(casoId);
  });

  it("moves one materia's round without touching the other", async () => {
    const casoId = await seedCasoConParte("en_negociacion");
    const tenencia = await repository.crear(casoId, "tenencia", "mediacion");
    const alimentos = await repository.crear(casoId, "alimentos", "mediacion");

    await rondasRepository.insertNextRonda(casoId, alimentos.id, 2);

    const negociaciones = await repository.listByCaso(casoId);
    const rondas = new Map(
      negociaciones.map((n) => [n.id, n.ronda_actual] as const),
    );

    expect(rondas.get(alimentos.id)).toBe(2);
    expect(rondas.get(tenencia.id)).toBe(1);
  });
});
