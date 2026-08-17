import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { ConflictError } from "../common/errors/domain-errors";
import { LegalRepository } from "../legal/legal.repository";
import { SuscripcionesRepository } from "./suscripciones.repository";

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

describeDb("anti-contratación against a real database", () => {
  let kysely: Kysely<Database>;
  let suscripcionesRepository: SuscripcionesRepository;
  let legalRepository: LegalRepository;
  let planId: string | undefined;
  let estudioId: string | undefined;
  let termsVersion: string;
  const titularId = randomUUID();
  const parteId = randomUUID();
  const soloId = randomUUID();
  const propioId = randomUUID();

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    suscripcionesRepository = new SuscripcionesRepository(kysely);
    legalRepository = new LegalRepository(kysely);

    await insertAuthUser(
      kysely,
      titularId,
      `titular-${titularId}@integration.test`,
    );
    await insertAuthUser(kysely, parteId, `parte-${parteId}@integration.test`);
    await insertAuthUser(kysely, soloId, `solo-${soloId}@integration.test`);
    await insertAuthUser(
      kysely,
      propioId,
      `propio-${propioId}@integration.test`,
    );

    const estudio = await kysely
      .insertInto("estudios")
      .values({ nombre: `Estudio aceptacion ${randomUUID()}` })
      .returningAll()
      .executeTakeFirstOrThrow();
    estudioId = estudio.id;

    await kysely
      .updateTable("usuarios")
      .set({ estudio_id: estudioId, rol: "estudio" })
      .where("id", "=", titularId)
      .execute();
    await kysely
      .updateTable("usuarios")
      .set({ estudio_id: estudioId, rol: "parte" })
      .where("id", "=", parteId)
      .execute();
    // Belongs to the estudio AND has a subscription of their own: the case the
    // owner-precedence ordering is about.
    await kysely
      .updateTable("usuarios")
      .set({ estudio_id: estudioId, rol: "parte" })
      .where("id", "=", propioId)
      .execute();

    const plan = await kysely
      .insertInto("planes")
      .values({
        nombre: `aceptacion-plan-${randomUUID()}`,
        limite_carpetas: 5,
        limite_casos: 5,
        limite_iteraciones_ia: 5,
        precio: 19.99,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    planId = plan.id;

    const terms = await legalRepository.findVigente(
      "terms",
      new Date().toISOString(),
    );
    termsVersion = terms?.version ?? "";
  });

  afterAll(async () => {
    await runCleanupSteps([
      () =>
        kysely
          .deleteFrom("suscripciones")
          .where("plan_id", "=", planId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("planes")
          .where("id", "=", planId ?? "")
          .execute(),
      () =>
        kysely
          .deleteFrom("estudios")
          .where("id", "=", estudioId ?? "")
          .execute(),
      () => deleteAuthUser(kysely, titularId),
      () => deleteAuthUser(kysely, parteId),
      () => deleteAuthUser(kysely, soloId),
      () => deleteAuthUser(kysely, propioId),
      () => kysely.destroy(),
    ]);
  });

  async function acceptTerms(userId: string): Promise<void> {
    await legalRepository.insertAcceptances([
      {
        user_id: userId,
        document_type: "terms",
        document_version: termsVersion,
        ip: "203.0.113.7",
        user_agent: "integration",
        accepted: true,
      },
    ]);
  }

  it("rejects an estudio subscription when no titular accepted the current terms", async () => {
    await expect(
      suscripcionesRepository.createSuscripcion({
        plan_id: planId as string,
        usuario_id: null,
        estudio_id: estudioId as string,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "conflict" },
    });
  });

  it("surfaces the rejection as a 409, not as a 500 the client cannot act on", async () => {
    // The trigger raises P0001 precisely so toDomainError maps it. With the
    // 22000 the original migration used, the raw pg error escaped and the
    // caller got `500 internal_error` for a condition it can fix by accepting.
    await expect(
      suscripcionesRepository.createSuscripcion({
        plan_id: planId as string,
        usuario_id: null,
        estudio_id: estudioId as string,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("still rejects when only a parte of that estudio accepted, not the titular", async () => {
    await acceptTerms(parteId);

    await expect(
      suscripcionesRepository.createSuscripcion({
        plan_id: planId as string,
        usuario_id: null,
        estudio_id: estudioId as string,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "conflict" },
    });
  });

  it("allows the estudio subscription once its titular accepted", async () => {
    await acceptTerms(titularId);

    const created = await suscripcionesRepository.createSuscripcion({
      plan_id: planId as string,
      usuario_id: null,
      estudio_id: estudioId as string,
    });

    expect(created.estudio_id).toBe(estudioId);
    expect(created.usuario_id).toBeNull();
  });

  it("keeps the personal branch gating on the same rule, now answering 409 instead of 500", async () => {
    await expect(
      suscripcionesRepository.createSuscripcion({
        plan_id: planId as string,
        usuario_id: soloId,
        estudio_id: null,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "conflict" },
    });

    await acceptTerms(soloId);

    const created = await suscripcionesRepository.createSuscripcion({
      plan_id: planId as string,
      usuario_id: soloId,
      estudio_id: null,
    });

    expect(created.usuario_id).toBe(soloId);
  });

  it("reads back the estudio subscription for a member of that estudio", async () => {
    const vigente = await suscripcionesRepository.findVigenteByOwner({
      usuarioId: parteId,
      estudioId: estudioId as string,
    });

    expect(vigente?.estado).toBe("pendiente_pago");
    expect(vigente?.plan_id).toBe(planId);
  });

  it("does not leak another owner's subscription to an unrelated caller", async () => {
    const vigente = await suscripcionesRepository.findVigenteByOwner({
      usuarioId: randomUUID(),
      estudioId: null,
    });

    expect(vigente).toBeUndefined();
  });
  it("prefers the caller's own suscripcion over the estudio's, whichever is newer", async () => {
    // The ordering is a `case` expression, which no fake-Kysely spec can
    // execute: inverting the ranks kept every unit test green. The hazard is
    // concrete — the FE baja button cancels the id this read returns, so
    // handing back the estudio's row cancels the plan of every member.
    await acceptTerms(propioId);
    const propia = await suscripcionesRepository.createSuscripcion({
      plan_id: planId as string,
      usuario_id: propioId,
      estudio_id: null,
    });
    await kysely
      .updateTable("suscripciones")
      .set({ estado: "activa" })
      .where("id", "=", propia.id)
      .execute();
    // The estudio's row is created AFTER, so created_at alone would pick it.
    const delEstudio = await suscripcionesRepository.createSuscripcion({
      plan_id: planId as string,
      usuario_id: null,
      estudio_id: estudioId as string,
    });
    await kysely
      .updateTable("suscripciones")
      .set({ estado: "activa" })
      .where("id", "=", delEstudio.id)
      .execute();

    const vigente = await suscripcionesRepository.findVigenteByOwner({
      usuarioId: propioId,
      estudioId: estudioId as string,
    });

    expect(vigente?.id).toBe(propia.id);
  });

  it("prefers an activa row over a newer cancelada one for the same owner", async () => {
    await acceptTerms(soloId);
    const activa = await suscripcionesRepository.createSuscripcion({
      plan_id: planId as string,
      usuario_id: soloId,
      estudio_id: null,
    });
    await kysely
      .updateTable("suscripciones")
      .set({ estado: "activa" })
      .where("id", "=", activa.id)
      .execute();
    // Created after the activa one, so created_at alone would pick it.
    const cancelada = await suscripcionesRepository.createSuscripcion({
      plan_id: planId as string,
      usuario_id: soloId,
      estudio_id: null,
    });
    await kysely
      .updateTable("suscripciones")
      .set({ estado: "cancelada", fecha_fin: new Date().toISOString() })
      .where("id", "=", cancelada.id)
      .execute();

    const vigente = await suscripcionesRepository.findVigenteByOwner({
      usuarioId: soloId,
      estudioId: null,
    });

    expect(vigente?.id).toBe(activa.id);
  });

  it("does not hand a caller of one estudio the subscription of another", async () => {
    const otroEstudio = await kysely
      .insertInto("estudios")
      .values({ nombre: `Estudio ajeno ${randomUUID()}` })
      .returningAll()
      .executeTakeFirstOrThrow();

    const vigente = await suscripcionesRepository.findVigenteByOwner({
      usuarioId: randomUUID(),
      estudioId: otroEstudio.id,
    });

    expect(vigente).toBeUndefined();

    await kysely
      .deleteFrom("estudios")
      .where("id", "=", otroEstudio.id)
      .execute();
  });
});
