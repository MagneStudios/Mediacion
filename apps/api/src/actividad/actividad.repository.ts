import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { KYSELY } from "../database/database.tokens";
import type { ActivityEvent } from "./actividad.types";

/**
 * Only entities both parties share. `items` and `propuestas` are per-party and
 * are excluded on purpose: even without `detalle`, "party B created an item" at
 * a given moment leaks the timing of a private submission.
 */
const sharedEntities = ["casos", "acuerdos", "firmas", "mediaciones"] as const;

@Injectable()
export class ActividadRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  /**
   * Events for the caso row itself plus the acuerdos that belong to it.
   *
   * The acuerdo ids are resolved through a subquery rather than a join on
   * `entidad_id`, because `entidad_id` is untyped across tables and a plain join
   * would match ids from unrelated entities that happen to collide.
   */
  listForCaso(casoId: string, limit: number): Promise<ActivityEvent[]> {
    return this.kysely
      .selectFrom("auditoria")
      .select(["accion", "entidad", "created_at"])
      .where("entidad", "in", [...sharedEntities])
      .where((builder) =>
        builder.or([
          builder("entidad_id", "=", casoId),
          builder(
            "entidad_id",
            "in",
            builder
              .selectFrom("acuerdos")
              .select("id")
              .where("caso_id", "=", casoId),
          ),
        ]),
      )
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute() as unknown as Promise<ActivityEvent[]>;
  }

  listForAcuerdo(acuerdoId: string, limit: number): Promise<ActivityEvent[]> {
    return this.kysely
      .selectFrom("auditoria")
      .select(["accion", "entidad", "created_at"])
      .where("entidad", "in", ["acuerdos", "firmas"])
      .where("entidad_id", "=", acuerdoId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute() as unknown as Promise<ActivityEvent[]>;
  }
}
