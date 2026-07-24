import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  ApplyPagoInput,
  ApplyPagoResult,
  SuscripcionForPreference,
} from "./pagos.types";

const estadoPagoAprobado = "aprobado";
const estadoSuscripcionActiva = "activa";

@Injectable()
export class PagosRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  findSuscripcionForPreference(
    suscripcionId: string,
  ): Promise<SuscripcionForPreference | undefined> {
    return this.kysely
      .selectFrom("suscripciones")
      .innerJoin("planes", "planes.id", "suscripciones.plan_id")
      .select([
        "suscripciones.id",
        "planes.nombre as plan_nombre",
        "planes.precio as plan_precio",
      ])
      .where("suscripciones.id", "=", suscripcionId)
      .executeTakeFirst();
  }

  applyPayment(input: ApplyPagoInput): Promise<ApplyPagoResult> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const insertedRows = await trx
          .insertInto("pagos")
          .values({
            suscripcion_id: input.suscripcionId,
            mp_payment_id: input.mpPaymentId,
            estado: input.estadoPago,
            monto: input.monto,
            raw_webhook: input.rawWebhook,
          })
          .onConflict((oc) => oc.column("mp_payment_id").doNothing())
          .returning(["id"])
          .execute();
        if (insertedRows.length === 0) {
          return { applied: false };
        }
        if (input.estadoPago === estadoPagoAprobado) {
          await trx
            .updateTable("suscripciones")
            .set({
              estado: estadoSuscripcionActiva,
              fecha_inicio: new Date().toISOString(),
            })
            .where("id", "=", input.suscripcionId)
            .execute();
        }
        return { applied: true };
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
