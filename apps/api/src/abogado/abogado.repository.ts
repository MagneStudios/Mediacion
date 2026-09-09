import { randomUUID } from "node:crypto";
import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { SolicitudAbogadoView } from "./abogado.types";
import {
  buildSolicitudExternalReference,
  estadoSolicitudFallida,
  estadoSolicitudPagada,
  estadoSolicitudPendientePago,
  solicitudAbogadoViewColumns,
} from "./abogado.types";
import { buildCasoLockQuery } from "./solicitud-lock-query";

export type CreateSolicitudInput = {
  casoId: string;
  solicitanteId: string;
  montoMinor: number;
  moneda: string;
};

@Injectable()
export class AbogadoRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  /**
   * The caso's current solicitud: the most recent one, whatever its status.
   * The screen needs to show a failed or a paid attempt too, not only a pending
   * one.
   */
  findLatestByCaso(casoId: string): Promise<SolicitudAbogadoView | undefined> {
    return this.kysely
      .selectFrom("lawyer_requests")
      .select([...solicitudAbogadoViewColumns])
      .where("caso_id", "=", casoId)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
  }

  /**
   * Reuses the caso's pending solicitud instead of opening a second one, per
   * spec §7.6 — the price is frozen at creation, so a second row for the same
   * intent would also be a second price. The caso row is locked first because
   * the existence check alone loses a concurrent race.
   */
  createOrReusePendiente(
    input: CreateSolicitudInput,
  ): Promise<SolicitudAbogadoView> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        await buildCasoLockQuery(trx, input.casoId).executeTakeFirst();
        const pendiente = await trx
          .selectFrom("lawyer_requests")
          .select([...solicitudAbogadoViewColumns])
          .where("caso_id", "=", input.casoId)
          .where("status", "=", estadoSolicitudPendientePago)
          .orderBy("created_at", "desc")
          .executeTakeFirst();
        if (pendiente) {
          return pendiente;
        }
        const id = randomUUID();
        return trx
          .insertInto("lawyer_requests")
          .values({
            id,
            caso_id: input.casoId,
            solicitante_id: input.solicitanteId,
            status: estadoSolicitudPendientePago,
            moneda: input.moneda,
            monto_minor: input.montoMinor,
            external_reference: buildSolicitudExternalReference(id),
          })
          .returning([...solicitudAbogadoViewColumns])
          .executeTakeFirstOrThrow();
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  persistPreference(solicitudId: string, preferenceId: string): Promise<void> {
    return this.kysely
      .updateTable("lawyer_requests")
      .set({ mp_preference_id: preferenceId })
      .where("id", "=", solicitudId)
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  /**
   * Settles a pending solicitud from the gateway's verdict.
   *
   * Conditional on `pendiente_pago` so a redelivered webhook cannot move an
   * already-settled solicitud, and so a late `rejected` for an attempt that was
   * already paid cannot undo the payment.
   */
  settleByReference(input: {
    externalReference: string;
    mpPaymentId: string;
    approved: boolean;
    paidAt: string;
  }): Promise<SolicitudAbogadoView | undefined> {
    return this.kysely
      .updateTable("lawyer_requests")
      .set({
        status: input.approved ? estadoSolicitudPagada : estadoSolicitudFallida,
        mp_payment_id: input.mpPaymentId,
        paid_at: input.approved ? input.paidAt : null,
      })
      .where("external_reference", "=", input.externalReference)
      .where("status", "=", estadoSolicitudPendientePago)
      .returning([...solicitudAbogadoViewColumns])
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
