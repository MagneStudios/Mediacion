import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { UsersRepository } from "../auth/users.repository";
import type {
  CreatePreferenceOutput,
  MercadoPagoClient,
  MercadoPagoPayment,
} from "./mercadopago/mercado-pago-client";
import { PagosRepository } from "./pagos.repository";
import { PagosService } from "./pagos.service";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
const instanceId = "00000000-0000-0000-0000-000000000000";

class FixedMercadoPagoClient implements MercadoPagoClient {
  constructor(private readonly payment: MercadoPagoPayment) {}

  createPreference(): Promise<CreatePreferenceOutput> {
    return Promise.reject(new Error("not used in this integration test"));
  }

  getPayment(): Promise<MercadoPagoPayment> {
    return Promise.resolve(this.payment);
  }
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

describeDb(
  "Mercado Pago webhook payment application against a real database",
  () => {
    let kysely: Kysely<Database>;
    let usersRepository: UsersRepository;
    let usuarioId: string;
    let planId: string;
    let suscripcionId: string;

    beforeAll(async () => {
      kysely = new Kysely<Database>({
        dialect: new PostgresDialect({
          pool: new Pool({ connectionString: process.env.DATABASE_URL }),
        }),
      });
      usersRepository = new UsersRepository(kysely);

      usuarioId = randomUUID();
      await insertAuthUser(
        kysely,
        usuarioId,
        `webhook-${usuarioId}@integration.test`,
      );

      const plan = await kysely
        .insertInto("planes")
        .values({
          nombre: `integration-plan-${randomUUID()}`,
          limite_carpetas: 5,
          limite_casos: 5,
          limite_iteraciones_ia: 5,
          precio: 19.99,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      planId = plan.id;

      const suscripcion = await kysely
        .insertInto("suscripciones")
        .values({ usuario_id: usuarioId, plan_id: planId })
        .returningAll()
        .executeTakeFirstOrThrow();
      suscripcionId = suscripcion.id;
    });

    afterAll(async () => {
      await runCleanupSteps([
        () =>
          kysely
            .deleteFrom("pagos")
            .where("suscripcion_id", "=", suscripcionId)
            .execute(),
        () =>
          kysely
            .deleteFrom("suscripciones")
            .where("id", "=", suscripcionId)
            .execute(),
        () => kysely.deleteFrom("planes").where("id", "=", planId).execute(),
        () => deleteAuthUser(kysely, usuarioId),
        () => kysely.destroy(),
      ]);
    });

    it("activates the suscripcion and persists the raw webhook on the first valid approved payment", async () => {
      const mpPaymentId = `mp-${randomUUID()}`;
      const client = new FixedMercadoPagoClient({
        id: mpPaymentId,
        status: "approved",
        externalReference: suscripcionId,
        transactionAmount: 19.99,
      });
      const service = new PagosService(
        new PagosRepository(kysely),
        client,
        usersRepository,
      );

      await service.processWebhookPayment(mpPaymentId);

      const suscripcion = await kysely
        .selectFrom("suscripciones")
        .selectAll()
        .where("id", "=", suscripcionId)
        .executeTakeFirstOrThrow();
      expect(suscripcion.estado).toBe("activa");

      const pagos = await kysely
        .selectFrom("pagos")
        .selectAll()
        .where("mp_payment_id", "=", mpPaymentId)
        .execute();
      expect(pagos).toHaveLength(1);
      expect(pagos[0].estado).toBe("aprobado");
    });

    it("is idempotent: reprocessing the same mp_payment_id does not duplicate the pago row or re-apply the change", async () => {
      const mpPaymentId = `mp-${randomUUID()}`;
      const client = new FixedMercadoPagoClient({
        id: mpPaymentId,
        status: "approved",
        externalReference: suscripcionId,
        transactionAmount: 19.99,
      });
      const service = new PagosService(
        new PagosRepository(kysely),
        client,
        usersRepository,
      );

      await service.processWebhookPayment(mpPaymentId);
      await service.processWebhookPayment(mpPaymentId);

      const pagos = await kysely
        .selectFrom("pagos")
        .selectAll()
        .where("mp_payment_id", "=", mpPaymentId)
        .execute();
      expect(pagos).toHaveLength(1);
    });

    it("activates the suscripcion when a later approved webhook transitions a previously pendiente payment", async () => {
      // The suscripcion is created once in beforeAll and the first test in this
      // describe activates it, so by the time this one runs its precondition is
      // already violated and `not.toBe("activa")` below fails. Stating the
      // starting estado here is what this test is actually about — the
      // pendiente_pago -> activa transition — and makes it order-independent.
      await kysely
        .updateTable("suscripciones")
        .set({ estado: "pendiente_pago" })
        .where("id", "=", suscripcionId)
        .execute();

      const mpPaymentId = `mp-${randomUUID()}`;
      const pendingClient = new FixedMercadoPagoClient({
        id: mpPaymentId,
        status: "in_process",
        externalReference: suscripcionId,
        transactionAmount: 19.99,
      });
      const approvedClient = new FixedMercadoPagoClient({
        id: mpPaymentId,
        status: "approved",
        externalReference: suscripcionId,
        transactionAmount: 19.99,
      });
      const repository = new PagosRepository(kysely);

      await new PagosService(
        repository,
        pendingClient,
        usersRepository,
      ).processWebhookPayment(mpPaymentId);
      const suscripcionAfterPending = await kysely
        .selectFrom("suscripciones")
        .selectAll()
        .where("id", "=", suscripcionId)
        .executeTakeFirstOrThrow();
      expect(suscripcionAfterPending.estado).not.toBe("activa");

      await new PagosService(
        repository,
        approvedClient,
        usersRepository,
      ).processWebhookPayment(mpPaymentId);

      const suscripcion = await kysely
        .selectFrom("suscripciones")
        .selectAll()
        .where("id", "=", suscripcionId)
        .executeTakeFirstOrThrow();
      expect(suscripcion.estado).toBe("activa");

      const pagos = await kysely
        .selectFrom("pagos")
        .selectAll()
        .where("mp_payment_id", "=", mpPaymentId)
        .execute();
      expect(pagos).toHaveLength(1);
      expect(pagos[0].estado).toBe("aprobado");
    });
  },
);
