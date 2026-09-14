import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import { billingPeriodStartingAt } from "./billing-period";
import {
  type ApplyPagoInput,
  type ApplyPagoResult,
  estadoSuscripcionActiva,
  estadoSuscripcionPendientePago,
  type SuscripcionForPreference,
  type SuscripcionOwnerFilter,
} from "./pagos.types";

const estadoPagoAprobado = "aprobado";

@Injectable()
export class PagosRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  findSuscripcionForPreference(
    suscripcionId: string,
    ownerFilter: SuscripcionOwnerFilter,
  ): Promise<SuscripcionForPreference | undefined> {
    return this.kysely
      .selectFrom("suscripciones")
      .innerJoin("planes", "planes.id", "suscripciones.plan_id")
      .select([
        "suscripciones.id",
        "planes.nombre as plan_nombre",
        "planes.precio as plan_precio",
        "planes.moneda as plan_moneda",
      ])
      .where("suscripciones.id", "=", suscripcionId)
      .where((eb) => {
        const conditions = [
          eb("suscripciones.usuario_id", "=", ownerFilter.usuarioId),
        ];
        if (ownerFilter.estudioId !== null) {
          conditions.push(
            eb("suscripciones.estudio_id", "=", ownerFilter.estudioId),
          );
        }
        return eb.or(conditions);
      })
      .executeTakeFirst();
  }

  /**
   * Activa una suscripción que no tiene nada que cobrar (plan de precio 0).
   *
   * Escribe exactamente los mismos cuatro campos que `applyPayment` cuando el
   * pago queda aprobado, y por la misma razón: `consume_quota` exige estado
   * `activa` **y** un período no nulo, así que activar sin fechas cambia el
   * error de `NO_ACTIVE_SUBSCRIPTION` a `NO_BILLING_PERIOD` sin desbloquear
   * nada. No inserta en `pagos`: no hubo pago, y una fila de importe cero ahí
   * mentiría sobre una transacción que nunca existió.
   *
   * El `where` sobre `pendiente_pago` es lo que hace idempotente un reintento:
   * una suscripción ya activa no vuelve a mover su período, que es lo que
   * pasaría si alguien toca "pagar" dos veces.
   */
  async activateFreeSuscripcion(suscripcionId: string): Promise<void> {
    const period = billingPeriodStartingAt(new Date());
    await this.kysely
      .updateTable("suscripciones")
      .set({
        estado: estadoSuscripcionActiva,
        fecha_inicio: period.period_start,
        current_period_start: period.period_start,
        current_period_end: period.period_end,
      })
      .where("id", "=", suscripcionId)
      .where("estado", "=", estadoSuscripcionPendientePago)
      .execute();
  }

  applyPayment(input: ApplyPagoInput): Promise<ApplyPagoResult> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const upsertedRows = await trx
          .insertInto("pagos")
          .values({
            suscripcion_id: input.suscripcionId,
            mp_payment_id: input.mpPaymentId,
            estado: input.estadoPago,
            monto: input.monto,
            raw_webhook: input.rawWebhook,
          })
          .onConflict((oc) =>
            oc
              .column("mp_payment_id")
              .doUpdateSet({
                estado: input.estadoPago,
                raw_webhook: input.rawWebhook,
              })
              .where("pagos.estado", "!=", estadoPagoAprobado),
          )
          .returning(["id", "estado"])
          .execute();
        if (upsertedRows.length === 0) {
          return { applied: false };
        }
        if (upsertedRows[0].estado === estadoPagoAprobado) {
          const period = billingPeriodStartingAt(new Date());
          await trx
            .updateTable("suscripciones")
            .set({
              estado: estadoSuscripcionActiva,
              fecha_inicio: period.period_start,
              current_period_start: period.period_start,
              current_period_end: period.period_end,
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
