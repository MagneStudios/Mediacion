import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  BillingPeriod,
  CreateSuscripcionInput,
  Suscripcion,
  SuscripcionForUso,
  SuscripcionOwnerFilter,
  SuscripcionOwnership,
  SuscripcionPeriodRow,
  SuscripcionVigenteRow,
} from "./pagos.types";
import {
  estadoSuscripcionActiva,
  estadoSuscripcionCancelada,
  estadosSuscripcionConPlan,
  suscripcionForUsoColumns,
  suscripcionVigenteColumns,
} from "./pagos.types";

const periodColumns = ["current_period_start", "current_period_end"] as const;

const ownershipColumns = ["id", "usuario_id", "estudio_id", "estado"] as const;

const personalOrderRank = 0;
const estudioOrderRank = 1;
const activaOrderRank = 0;
const inactivaOrderRank = 1;

@Injectable()
export class SuscripcionesRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  createSuscripcion(input: CreateSuscripcionInput): Promise<Suscripcion> {
    return this.kysely
      .insertInto("suscripciones")
      .values({
        usuario_id: input.usuario_id,
        estudio_id: input.estudio_id,
        plan_id: input.plan_id,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findVigenteByOwner(
    ownerFilter: SuscripcionOwnerFilter,
  ): Promise<SuscripcionVigenteRow | undefined> {
    return this.kysely
      .selectFrom("suscripciones")
      .select(suscripcionVigenteColumns)
      .where((eb) => {
        const conditions = [eb("usuario_id", "=", ownerFilter.usuarioId)];
        if (ownerFilter.estudioId !== null) {
          conditions.push(eb("estudio_id", "=", ownerFilter.estudioId));
        }
        return eb.or(conditions);
      })
      .orderBy((eb) =>
        eb
          .case()
          .when("usuario_id", "=", ownerFilter.usuarioId)
          .then(personalOrderRank)
          .else(estudioOrderRank)
          .end(),
      )
      .orderBy((eb) =>
        eb
          .case()
          .when("estado", "=", estadoSuscripcionActiva)
          .then(activaOrderRank)
          .else(inactivaOrderRank)
          .end(),
      )
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findForUsoByOwner(
    ownerFilter: SuscripcionOwnerFilter,
  ): Promise<SuscripcionForUso | undefined> {
    return this.kysely
      .selectFrom("suscripciones")
      .innerJoin("planes", "planes.id", "suscripciones.plan_id")
      .select(suscripcionForUsoColumns)
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
      .where("suscripciones.estado", "in", estadosSuscripcionConPlan)
      .orderBy((eb) =>
        eb
          .case()
          .when("suscripciones.usuario_id", "=", ownerFilter.usuarioId)
          .then(personalOrderRank)
          .else(estudioOrderRank)
          .end(),
      )
      .orderBy((eb) =>
        eb
          .case()
          .when("suscripciones.estado", "=", estadoSuscripcionActiva)
          .then(activaOrderRank)
          .else(inactivaOrderRank)
          .end(),
      )
      .orderBy("suscripciones.created_at", "desc")
      .limit(1)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  async setPeriodIfMissing(
    id: string,
    period: BillingPeriod,
  ): Promise<SuscripcionPeriodRow | undefined> {
    const written = await this.kysely
      .updateTable("suscripciones")
      .set({
        current_period_start: period.period_start,
        current_period_end: period.period_end,
      })
      .where("id", "=", id)
      .where("current_period_start", "is", null)
      .where("current_period_end", "is", null)
      .returning(periodColumns)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
    if (written) {
      return written;
    }
    return this.kysely
      .selectFrom("suscripciones")
      .select(periodColumns)
      .where("id", "=", id)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findOwnershipById(id: string): Promise<SuscripcionOwnership | undefined> {
    return this.kysely
      .selectFrom("suscripciones")
      .select(ownershipColumns)
      .where("id", "=", id)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  cancelActiva(id: string, fechaFin: string): Promise<Suscripcion | undefined> {
    return this.kysely
      .updateTable("suscripciones")
      .set({ estado: estadoSuscripcionCancelada, fecha_fin: fechaFin })
      .where("id", "=", id)
      .where("estado", "=", estadoSuscripcionActiva)
      .returningAll()
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  restoreActiva(id: string): Promise<unknown> {
    return this.kysely
      .updateTable("suscripciones")
      .set({ estado: estadoSuscripcionActiva, fecha_fin: null })
      .where("id", "=", id)
      .where("estado", "=", estadoSuscripcionCancelada)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
