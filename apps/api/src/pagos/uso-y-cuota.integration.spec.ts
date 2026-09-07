import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { HttpStatus } from "@nestjs/common";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { UsersRepository } from "../auth/users.repository";
import { CasosRepository } from "../casos/casos.repository";
import { CasosService } from "../casos/casos.service";
import type { MembershipService } from "../casos/membership.service";
import { QuotaExceededError } from "../common/errors/domain-errors";
import { LegalRepository } from "../legal/legal.repository";
import type { EmailProvider } from "../notificaciones/notificaciones.types";
import { billingPeriodMs } from "./billing-period";
import type { MercadoPagoClient } from "./mercadopago/mercado-pago-client";
import { PagosRepository } from "./pagos.repository";
import { PlanLimitService } from "./plan-limit.service";
import { SuscripcionesRepository } from "./suscripciones.repository";
import { SuscripcionesService } from "./suscripciones.service";
import { UsageRepository } from "./usage.repository";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const instanceId = "00000000-0000-0000-0000-000000000000";
const dayMs = 24 * 60 * 60 * 1000;
const negotiationsPerPeriod = 3;

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

describeDb("uso y cuota against a real database", () => {
  let kysely: Kysely<Database>;
  let legalRepository: LegalRepository;
  let suscripcionesRepository: SuscripcionesRepository;
  let usageRepository: UsageRepository;
  let casosRepository: CasosRepository;
  let suscripcionesService: SuscripcionesService;
  let casosService: CasosService;
  let pagosRepository: PagosRepository;
  let planId: string;
  let termsVersion: string;
  const conPeriodoId = randomUUID();
  const sinPeriodoId = randomUUID();
  const sinContadorId = randomUUID();
  const pagadorId = randomUUID();
  const userIds = [conPeriodoId, sinPeriodoId, sinContadorId, pagadorId];
  const fechaInicioSinPeriodo = new Date(Date.now() - 45 * dayMs);

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

  async function readCounter(userId: string) {
    return kysely
      .selectFrom("usage_counters")
      .select(["negotiations_created", "period_start", "period_end"])
      .where("usuario_id", "=", userId)
      .execute();
  }

  async function countCasos(userId: string): Promise<number> {
    const row = await kysely
      .selectFrom("casos")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("creador_id", "=", userId)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    legalRepository = new LegalRepository(kysely);
    suscripcionesRepository = new SuscripcionesRepository(kysely);
    usageRepository = new UsageRepository(kysely);
    casosRepository = new CasosRepository(kysely);
    pagosRepository = new PagosRepository(kysely);
    const usersRepository = new UsersRepository(kysely);
    suscripcionesService = new SuscripcionesService(
      suscripcionesRepository,
      usersRepository,
      {
        cancelSubscription: () => Promise.resolve({ cancelled: true }),
      } as unknown as MercadoPagoClient,
      { send: () => Promise.resolve(undefined) } as unknown as EmailProvider,
      usageRepository,
    );
    casosService = new CasosService(
      casosRepository,
      {} as unknown as MembershipService,
      new PlanLimitService(kysely, usersRepository),
      usageRepository,
      suscripcionesService,
    );

    for (const id of userIds) {
      await insertAuthUser(kysely, id, `uso-${id}@integration.test`);
      await kysely
        .updateTable("usuarios")
        .set({ rol: "parte" })
        .where("id", "=", id)
        .execute();
    }

    const plan = await kysely
      .insertInto("planes")
      .values({
        nombre: `uso-cuota-plan-${randomUUID()}`,
        limite_carpetas: 5,
        limite_casos: 50,
        limite_iteraciones_ia: 5,
        precio: 19.99,
        max_negotiations_per_period: negotiationsPerPeriod,
        max_clients_per_period: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    planId = plan.id;

    const terms = await legalRepository.findVigente(
      "terms",
      new Date().toISOString(),
    );
    termsVersion = terms?.version ?? "";

    for (const id of userIds) {
      await acceptTerms(id);
    }

    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + billingPeriodMs);
    for (const id of [conPeriodoId, sinContadorId]) {
      await kysely
        .insertInto("suscripciones")
        .values({
          usuario_id: id,
          plan_id: planId,
          estado: "activa",
          fecha_inicio: periodStart.toISOString(),
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .execute();
    }
    await kysely
      .insertInto("suscripciones")
      .values({
        usuario_id: sinPeriodoId,
        plan_id: planId,
        estado: "activa",
        fecha_inicio: fechaInicioSinPeriodo.toISOString(),
      })
      .execute();
  });

  afterAll(async () => {
    await runCleanupSteps([
      () =>
        kysely
          .deleteFrom("caso_partes")
          .where("usuario_id", "in", userIds)
          .execute(),
      () =>
        kysely.deleteFrom("casos").where("creador_id", "in", userIds).execute(),
      () =>
        kysely
          .deleteFrom("usage_counters")
          .where("usuario_id", "in", userIds)
          .execute(),
      () =>
        kysely
          .deleteFrom("pagos")
          .where("mp_payment_id", "like", "uso-%")
          .execute(),
      () =>
        kysely
          .deleteFrom("suscripciones")
          .where("plan_id", "=", planId)
          .execute(),
      () => kysely.deleteFrom("planes").where("id", "=", planId).execute(),
      ...userIds.map((id) => () => deleteAuthUser(kysely, id)),
      () => kysely.destroy(),
    ]);
  });

  it("answers usado 0 with the persisted period when no counter row exists yet", async () => {
    const uso = await suscripcionesService.getUso(sinContadorId);

    expect(uso.negociaciones).toEqual({
      usado: 0,
      limite: negotiationsPerPeriod,
    });
    expect(uso.clientes).toBeNull();
    expect(await readCounter(sinContadorId)).toEqual([]);
  });

  it("creates three casos within the quota, the counter following each one inside the transaction", async () => {
    for (let index = 1; index <= negotiationsPerPeriod; index += 1) {
      const created = await casosService.createCase(conPeriodoId, {
        nombre: `Caso ${index}`,
        metodo: "negociacion",
      });
      expect(created.estado).toBe("nuevo");
      const [counter] = await readCounter(conPeriodoId);
      expect(counter.negotiations_created).toBe(index);
    }

    const uso = await suscripcionesService.getUso(conPeriodoId);
    expect(uso.negociaciones).toEqual({
      usado: negotiationsPerPeriod,
      limite: negotiationsPerPeriod,
    });
    expect(await countCasos(conPeriodoId)).toBe(negotiationsPerPeriod);
  });

  it("rejects the fourth caso with a detailed 402, leaving the counter at 3 and creating nothing", async () => {
    let thrown: unknown;
    try {
      await casosService.createCase(conPeriodoId, {
        nombre: "Caso 4",
        metodo: "negociacion",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(QuotaExceededError);
    const quotaError = thrown as QuotaExceededError;
    expect(quotaError.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
    const uso = await suscripcionesService.getUso(conPeriodoId);
    expect(quotaError.getResponse()).toEqual({
      code: "quota_exceeded",
      message: "Quota exceeded for this period",
      recurso: "negociaciones",
      usado: negotiationsPerPeriod,
      limite: negotiationsPerPeriod,
      period_end: uso.period_end,
    });
    const [counter] = await readCounter(conPeriodoId);
    expect(counter.negotiations_created).toBe(negotiationsPerPeriod);
    expect(await countCasos(conPeriodoId)).toBe(negotiationsPerPeriod);
  });

  it("rolls the quota consumption back when the caso insert fails after it", async () => {
    const before = (await readCounter(sinContadorId))[0]?.negotiations_created;

    await expect(
      casosRepository.createCaseWithParteA(
        { nombre: "Roto", metodo: "no-es-un-metodo" as never },
        sinContadorId,
        (trx) => usageRepository.consumeNegotiation(trx, sinContadorId),
      ),
    ).rejects.toBeInstanceOf(Error);

    const after = (await readCounter(sinContadorId))[0]?.negotiations_created;
    expect(after).toBe(before);
    expect(await countCasos(sinContadorId)).toBe(0);
  });

  it("persists the 30-day window anchored on fecha_inicio the first time an activa row without a period is read", async () => {
    const expectedStart = new Date(
      fechaInicioSinPeriodo.getTime() + billingPeriodMs,
    );
    const expectedEnd = new Date(expectedStart.getTime() + billingPeriodMs);

    const uso = await suscripcionesService.getUso(sinPeriodoId);

    expect(uso.period_start).toBe(expectedStart.toISOString());
    expect(uso.period_end).toBe(expectedEnd.toISOString());
    const row = await kysely
      .selectFrom("suscripciones")
      .select(["current_period_start", "current_period_end"])
      .where("usuario_id", "=", sinPeriodoId)
      .executeTakeFirstOrThrow();
    expect(new Date(row.current_period_start as string).toISOString()).toBe(
      expectedStart.toISOString(),
    );
    expect(new Date(row.current_period_end as string).toISOString()).toBe(
      expectedEnd.toISOString(),
    );
  });

  it("consumes against the persisted window, so the counter row carries the same period_start", async () => {
    await casosService.createCase(sinPeriodoId, {
      nombre: "Primero del período",
      metodo: "negociacion",
    });

    const uso = await suscripcionesService.getUso(sinPeriodoId);
    const [counter] = await readCounter(sinPeriodoId);
    expect(uso.negociaciones.usado).toBe(1);
    expect(new Date(counter.period_start as string).toISOString()).toBe(
      uso.period_start,
    );
  });

  it("opens a period of exactly 30 days when an approved payment activates the subscription", async () => {
    const pendiente = await suscripcionesRepository.createSuscripcion({
      plan_id: planId,
      usuario_id: pagadorId,
      estudio_id: null,
    });

    const result = await pagosRepository.applyPayment({
      suscripcionId: pendiente.id,
      mpPaymentId: `uso-${randomUUID()}`,
      estadoPago: "aprobado",
      monto: 19.99,
      rawWebhook: { status: "approved" },
    });

    expect(result).toEqual({ applied: true });
    const row = await kysely
      .selectFrom("suscripciones")
      .select([
        "estado",
        "fecha_inicio",
        "current_period_start",
        "current_period_end",
      ])
      .where("id", "=", pendiente.id)
      .executeTakeFirstOrThrow();
    expect(row.estado).toBe("activa");
    const start = new Date(row.current_period_start as string).getTime();
    const end = new Date(row.current_period_end as string).getTime();
    expect(end - start).toBe(billingPeriodMs);
    expect(new Date(row.fecha_inicio as string).getTime()).toBe(start);
  });
});
