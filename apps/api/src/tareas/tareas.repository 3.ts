import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { EstadoTarea, NewTarea, Tarea, TareaView } from "./tareas.types";
import { tareaViewColumns, tipoTareaEventoCalendario } from "./tareas.types";

export function tareaNotFound(): HttpException {
  return new HttpException(
    { code: "tarea_not_found", message: "Task not found" },
    HttpStatus.NOT_FOUND,
  );
}

@Injectable()
export class TareasRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  listByCaso(casoId: string): Promise<TareaView[]> {
    return this.kysely
      .selectFrom("tareas")
      .select(tareaViewColumns)
      .where("caso_id", "=", casoId)
      .orderBy("created_at", "asc")
      .execute();
  }

  findById(tareaId: string): Promise<Tarea | undefined> {
    return this.kysely
      .selectFrom("tareas")
      .selectAll()
      .where("id", "=", tareaId)
      .executeTakeFirst();
  }

  updateEstado(tareaId: string, estado: EstadoTarea): Promise<TareaView> {
    return this.kysely
      .updateTable("tareas")
      .set({ estado })
      .where("id", "=", tareaId)
      .returning(tareaViewColumns)
      .executeTakeFirst()
      .then((updated) => {
        if (!updated) {
          throw tareaNotFound();
        }
        return updated;
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  scheduleCalendarEvent(
    tareaId: string,
    fechaEvento: string,
  ): Promise<TareaView> {
    return this.kysely
      .updateTable("tareas")
      .set({
        tipo: tipoTareaEventoCalendario,
        fecha_evento: fechaEvento,
      })
      .where("id", "=", tareaId)
      .returning(tareaViewColumns)
      .executeTakeFirst()
      .then((updated) => {
        if (!updated) {
          throw tareaNotFound();
        }
        return updated;
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  insertGenerated(acuerdoId: string, tareas: NewTarea[]): Promise<TareaView[]> {
    if (tareas.length === 0) {
      return Promise.resolve([]);
    }
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const existing = await trx
          .selectFrom("tareas")
          .select("id")
          .where("acuerdo_id", "=", acuerdoId)
          .executeTakeFirst();
        if (existing) {
          return [];
        }
        return trx
          .insertInto("tareas")
          .values(tareas)
          .onConflict((oc) =>
            oc.columns(["acuerdo_id", "descripcion"]).doNothing(),
          )
          .returningAll()
          .execute();
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
