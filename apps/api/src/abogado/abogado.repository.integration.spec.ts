import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { AbogadoRepository } from "./abogado.repository";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const instanceId = "00000000-0000-0000-0000-000000000000";
const feeMinor = 5_000_000;

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

async function runCleanupSteps(
  steps: Array<() => Promise<unknown>>,
): Promise<void> {
  for (const step of steps) {
    try {
      await step();
    } catch {}
  }
}

describeDb("AbogadoRepository against a real database", () => {
  let kysely: Kysely<Database>;
  let repository: AbogadoRepository;
  const usuarioId = randomUUID();
  const usuarioEmail = `abogado-${randomUUID()}@integration.test`;

  beforeAll(async () => {
    kysely = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      }),
    });
    repository = new AbogadoRepository(kysely);
    await insertAuthUser(kysely, usuarioId, usuarioEmail);
  });

  afterAll(async () => {
    await runCleanupSteps([
      () =>
        kysely
          .deleteFrom("lawyer_requests")
          .where("solicitante_id", "=", usuarioId)
          .execute(),
      () =>
        kysely
          .deleteFrom("casos")
          .where("creador_id", "=", usuarioId)
          .execute(),
      () => sql`delete from auth.users where id = ${usuarioId}`.execute(kysely),
      () => kysely.destroy(),
    ]);
  });

  async function createCaso(): Promise<string> {
    const caso = await kysely
      .insertInto("casos")
      .values({
        creador_id: usuarioId,
        nombre: `Caso abogado ${randomUUID()}`,
        metodo: "negociacion",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return caso.id;
  }

  it("opens a pending solicitud whose external reference points back at its own id", async () => {
    const casoId = await createCaso();

    const solicitud = await repository.createOrReusePendiente({
      casoId,
      solicitanteId: usuarioId,
      montoMinor: feeMinor,
      moneda: "ARS",
    });

    expect(solicitud.status).toBe("pendiente_pago");
    expect(solicitud.monto_minor).toBe(feeMinor);
    expect(solicitud.external_reference).toBe(`lawreq_${solicitud.id}`);
  });

  it("reuses the caso's pending solicitud instead of opening a second one", async () => {
    const casoId = await createCaso();

    const first = await repository.createOrReusePendiente({
      casoId,
      solicitanteId: usuarioId,
      montoMinor: feeMinor,
      moneda: "ARS",
    });
    const second = await repository.createOrReusePendiente({
      casoId,
      solicitanteId: usuarioId,
      montoMinor: 9_999_999,
      moneda: "ARS",
    });

    expect(second.id).toBe(first.id);
    expect(second.monto_minor).toBe(feeMinor);
    const rows = await kysely
      .selectFrom("lawyer_requests")
      .select("id")
      .where("caso_id", "=", casoId)
      .execute();
    expect(rows).toHaveLength(1);
  });

  it("settles a pending solicitud as paid, stamping the payment and the time", async () => {
    const casoId = await createCaso();
    const solicitud = await repository.createOrReusePendiente({
      casoId,
      solicitanteId: usuarioId,
      montoMinor: feeMinor,
      moneda: "ARS",
    });

    const settled = await repository.settleByReference({
      externalReference: solicitud.external_reference,
      mpPaymentId: `mp-${randomUUID()}`,
      approved: true,
      paidAt: new Date().toISOString(),
    });

    expect(settled?.status).toBe("pagada");
    expect(settled?.paid_at).not.toBeNull();
  });

  it("marks a rejected payment as fallida, leaving paid_at empty", async () => {
    const casoId = await createCaso();
    const solicitud = await repository.createOrReusePendiente({
      casoId,
      solicitanteId: usuarioId,
      montoMinor: feeMinor,
      moneda: "ARS",
    });

    const settled = await repository.settleByReference({
      externalReference: solicitud.external_reference,
      mpPaymentId: `mp-${randomUUID()}`,
      approved: false,
      paidAt: new Date().toISOString(),
    });

    expect(settled?.status).toBe("fallida");
    expect(settled?.paid_at).toBeNull();
  });

  /**
   * Idempotence of the webhook: Mercado Pago redelivers, and a second delivery
   * must not re-settle a solicitud that is no longer pending.
   */
  it("leaves an already-settled solicitud alone on a redelivered payment", async () => {
    const casoId = await createCaso();
    const solicitud = await repository.createOrReusePendiente({
      casoId,
      solicitanteId: usuarioId,
      montoMinor: feeMinor,
      moneda: "ARS",
    });
    await repository.settleByReference({
      externalReference: solicitud.external_reference,
      mpPaymentId: `mp-${randomUUID()}`,
      approved: true,
      paidAt: new Date().toISOString(),
    });

    const again = await repository.settleByReference({
      externalReference: solicitud.external_reference,
      mpPaymentId: `mp-${randomUUID()}`,
      approved: false,
      paidAt: new Date().toISOString(),
    });

    expect(again).toBeUndefined();
    const stored = await kysely
      .selectFrom("lawyer_requests")
      .select("status")
      .where("id", "=", solicitud.id)
      .executeTakeFirstOrThrow();
    expect(stored.status).toBe("pagada");
  });

  it("opens a fresh solicitud once the previous one is no longer pending", async () => {
    const casoId = await createCaso();
    const first = await repository.createOrReusePendiente({
      casoId,
      solicitanteId: usuarioId,
      montoMinor: feeMinor,
      moneda: "ARS",
    });
    await repository.settleByReference({
      externalReference: first.external_reference,
      mpPaymentId: `mp-${randomUUID()}`,
      approved: false,
      paidAt: new Date().toISOString(),
    });

    const retry = await repository.createOrReusePendiente({
      casoId,
      solicitanteId: usuarioId,
      montoMinor: feeMinor,
      moneda: "ARS",
    });

    expect(retry.id).not.toBe(first.id);
    expect(retry.status).toBe("pendiente_pago");
  });

  it("reads back the caso's most recent solicitud", async () => {
    const casoId = await createCaso();
    const first = await repository.createOrReusePendiente({
      casoId,
      solicitanteId: usuarioId,
      montoMinor: feeMinor,
      moneda: "ARS",
    });

    await expect(repository.findLatestByCaso(casoId)).resolves.toMatchObject({
      id: first.id,
    });
  });

  it("reads back nothing for a caso that never asked for a lawyer", async () => {
    const casoId = await createCaso();

    await expect(repository.findLatestByCaso(casoId)).resolves.toBeUndefined();
  });
});
