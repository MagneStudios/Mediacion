import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  CreateSuscripcionInput,
  Suscripcion,
  SuscripcionOwnerFilter,
  SuscripcionOwnership,
  SuscripcionVigenteRow,
} from "./pagos.types";
import {
  estadoSuscripcionActiva,
  estadoSuscripcionCancelada,
  suscripcionVigenteColumns,
} from "./pagos.types";

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
