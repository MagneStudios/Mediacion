import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { estadoAcuerdoConAviso } from "../acuerdos/acuerdos.types";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  AcuerdoForBreach,
  IncumplimientoView,
} from "./incumplimientos.types";
import { incumplimientoViewColumns } from "./incumplimientos.types";

@Injectable()
export class IncumplimientosRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  findAcuerdo(acuerdoId: string): Promise<AcuerdoForBreach | undefined> {
    return this.kysely
      .selectFrom("acuerdos")
      .select(["id", "caso_id", "estado"])
      .where("id", "=", acuerdoId)
      .executeTakeFirst();
  }

  listByAcuerdo(acuerdoId: string): Promise<IncumplimientoView[]> {
    return this.kysely
      .selectFrom("incumplimientos")
      .select(incumplimientoViewColumns)
      .where("acuerdo_id", "=", acuerdoId)
      .orderBy("fecha", "desc")
      .execute();
  }

  registerBreach(
    acuerdoId: string,
    reportanteId: string,
    descripcion: string,
  ): Promise<IncumplimientoView> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const registered = await trx
          .insertInto("incumplimientos")
          .values({
            acuerdo_id: acuerdoId,
            reportante_id: reportanteId,
            descripcion,
          })
          .returning(incumplimientoViewColumns)
          .executeTakeFirstOrThrow();
        await trx
          .updateTable("acuerdos")
          .set({ estado: estadoAcuerdoConAviso })
          .where("id", "=", acuerdoId)
          .execute();
        return registered;
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
