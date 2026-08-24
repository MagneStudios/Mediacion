import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import {
  type ApplyPagoInput,
  type ApplyPagoResult,
  estadoSuscripcionActiva,
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
