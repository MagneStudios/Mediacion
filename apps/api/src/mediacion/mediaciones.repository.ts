import type { Database } from "@mediacion/db-types";
import { HttpException, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  EstadoMediacion,
  Mediacion,
  MediacionView,
  MediadorOption,
} from "./mediacion.types";
import {
  estadoMediacionAceptada,
  estadoMediacionFinalizada,
  estadosMediacionActivos,
  mediacionViewColumns,
  rolEnCasoMediador,
} from "./mediacion.types";

const casoPartesUniqueColumns = ["caso_id", "usuario_id"] as const;

const estadoInvitacionAceptada = "aceptada";

export function buildInsertSolicitudQuery(
  db: Kysely<Database>,
  casoId: string,
  mediadorId: string,
  ronda: number,
) {
  return db
    .insertInto("mediaciones")
    .values({ caso_id: casoId, mediador_id: mediadorId, ronda })
    .returning([...mediacionViewColumns]);
}

export function buildFindByIdQuery(db: Kysely<Database>, mediacionId: string) {
  return db.selectFrom("mediaciones").selectAll().where("id", "=", mediacionId);
}

export function buildCurrentRondaActualQuery(
  db: Kysely<Database>,
  casoId: string,
) {
  return db.selectFrom("casos").select("ronda_actual").where("id", "=", casoId);
}

export function buildFindByCasoIdQuery(db: Kysely<Database>, casoId: string) {
  return db
    .selectFrom("mediaciones")
    .select([...mediacionViewColumns])
    .where("caso_id", "=", casoId)
    .orderBy("fecha_solicitud", "desc")
    .limit(1);
}

export function buildListMediadoresQuery(db: Kysely<Database>) {
  return db
    .selectFrom("usuarios")
    .select(["id", "nombre", "apellido"])
    .where("rol", "=", "mediador")
    .where("activo", "=", true)
    .orderBy("apellido", "asc")
    .orderBy("nombre", "asc");
}

export function buildFindActivaByCasoIdQuery(
  db: Kysely<Database>,
  casoId: string,
) {
  return db
    .selectFrom("mediaciones")
    .selectAll()
    .where("caso_id", "=", casoId)
    .where("estado", "in", estadosMediacionActivos);
}

export function buildExistsCasoParteQuery(
  db: Kysely<Database>,
  casoId: string,
  usuarioId: string,
) {
  return db
    .selectFrom("caso_partes")
    .select("id")
    .where("caso_id", "=", casoId)
    .where("usuario_id", "=", usuarioId)
    .limit(1);
}

@Injectable()
export class MediacionesRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  insertSolicitud(
    casoId: string,
    mediadorId: string,
    ronda: number,
  ): Promise<MediacionView> {
    return buildInsertSolicitudQuery(this.kysely, casoId, mediadorId, ronda)
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findById(mediacionId: string): Promise<Mediacion | undefined> {
    return buildFindByIdQuery(this.kysely, mediacionId).executeTakeFirst();
  }

  async currentRondaActual(casoId: string): Promise<number | undefined> {
    const row = await buildCurrentRondaActualQuery(
      this.kysely,
      casoId,
    ).executeTakeFirst();
    return row?.ronda_actual;
  }

  /** The most recent mediacion for a caso, whatever its estado — including rechazada/finalizada, which a party still needs to see. */
  findByCasoId(casoId: string): Promise<MediacionView | undefined> {
    return buildFindByCasoIdQuery(this.kysely, casoId).executeTakeFirst();
  }

  listMediadores(): Promise<MediadorOption[]> {
    return buildListMediadoresQuery(this.kysely).execute();
  }

  findActivaByCasoId(casoId: string): Promise<Mediacion | undefined> {
    return buildFindActivaByCasoIdQuery(this.kysely, casoId).executeTakeFirst();
  }

  async existsCasoParte(casoId: string, usuarioId: string): Promise<boolean> {
    const row = await buildExistsCasoParteQuery(
      this.kysely,
      casoId,
      usuarioId,
    ).executeTakeFirst();
    return row !== undefined;
  }

  transitionEstado(
    mediacionId: string,
    casoId: string,
    mediadorId: string,
    fromEstado: EstadoMediacion,
    toEstado: EstadoMediacion,
    grantMediadorMembership: boolean,
  ): Promise<MediacionView> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const updated = await trx
          .updateTable("mediaciones")
          .set(
            toEstado === estadoMediacionAceptada
              ? { estado: toEstado, fecha_aceptacion: new Date().toISOString() }
              : { estado: toEstado },
          )
          .where("id", "=", mediacionId)
          .where("estado", "=", fromEstado)
          .returning([...mediacionViewColumns])
          .executeTakeFirstOrThrow(() => mediacionTransitionConflict());
        if (grantMediadorMembership) {
          await trx
            .insertInto("caso_partes")
            .values({
              caso_id: casoId,
              usuario_id: mediadorId,
              rol_en_caso: rolEnCasoMediador,
              estado_invitacion: estadoInvitacionAceptada,
              fecha_union: new Date().toISOString(),
            })
            .onConflict((oc) =>
              oc.columns([...casoPartesUniqueColumns]).doNothing(),
            )
            .execute();
        }
        if (toEstado === estadoMediacionFinalizada) {
          await trx
            .deleteFrom("caso_partes")
            .where("caso_id", "=", casoId)
            .where("usuario_id", "=", mediadorId)
            .where("rol_en_caso", "=", rolEnCasoMediador)
            .execute();
        }
        return updated;
      })
      .catch((error: unknown) => {
        if (error instanceof HttpException) {
          throw error;
        }
        throw toDomainError(error);
      });
  }
}

function mediacionTransitionConflict(): HttpException {
  return new HttpException(
    {
      code: "mediacion_transition_conflict",
      message: "Mediacion is not in the expected state for this transition",
    },
    409,
  );
}
