import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { CasosRepository } from "../casos/casos.repository";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  DecisionPropuesta,
  EstadoPropuesta,
  Propuesta,
  PropuestaContenido,
  PropuestaDetail,
  PropuestaView,
} from "./negociacion.types";
import { propuestaViewColumns } from "./negociacion.types";
import { buildPropuestaLockQuery } from "./propuesta-lock-query";
import {
  buildFindByPropuestaQuery,
  buildInsertRespuestaQuery,
} from "./respuestas.repository";
import {
  buildCurrentRondaActualQuery,
  buildInsertNextRondaQuery,
} from "./rondas.repository";

const estadoPendiente: EstadoPropuesta = "pendiente";
const estadoAceptada: EstadoPropuesta = "aceptada";
const estadoRechazada: EstadoPropuesta = "rechazada";
const decisionAcepta: DecisionPropuesta = "acepta";
const decisionRechaza: DecisionPropuesta = "rechaza";

function propuestaNotFound(): HttpException {
  return new HttpException(
    { code: "propuesta_not_found", message: "Propuesta not found" },
    HttpStatus.NOT_FOUND,
  );
}

function propuestaNotPendiente(): HttpException {
  return new HttpException(
    {
      code: "propuesta_not_pendiente",
      message: "Propuesta is not pending a response",
    },
    HttpStatus.CONFLICT,
  );
}

function propuestaNotReady(): HttpException {
  return new HttpException(
    {
      code: "propuesta_not_ready",
      message: "Propuesta narrative generation has not completed yet",
    },
    HttpStatus.CONFLICT,
  );
}

export function buildCreatePendingQuery(
  db: Kysely<Database>,
  casoId: string,
  rondaId: string,
  contenido: Propuesta["contenido"],
  modeloIa: string,
) {
  return db
    .insertInto("propuestas")
    .values({
      caso_id: casoId,
      ronda_id: rondaId,
      contenido,
      modelo_ia: modeloIa,
    })
    .returning([...propuestaViewColumns]);
}

export function buildPatchGeneratedQuery(
  db: Kysely<Database>,
  casoId: string,
  propuestaId: string,
  contenido: Propuesta["contenido"],
  fundamentacion: string | null,
) {
  return db
    .updateTable("propuestas")
    .set({ contenido, fundamentacion })
    .where("id", "=", propuestaId)
    .where("caso_id", "=", casoId)
    .returning([...propuestaViewColumns]);
}

export function buildMarkEstadoQuery(
  db: Kysely<Database>,
  casoId: string,
  propuestaId: string,
  estado: EstadoPropuesta,
) {
  return db
    .updateTable("propuestas")
    .set({ estado })
    .where("id", "=", propuestaId)
    .where("caso_id", "=", casoId)
    .returning([...propuestaViewColumns]);
}

export function buildFindForCaseQuery(db: Kysely<Database>, casoId: string) {
  return db
    .selectFrom("propuestas")
    .select([...propuestaViewColumns])
    .where("caso_id", "=", casoId);
}

/**
 * The respuestas join is scoped to the caller, so one parte can never read the
 * other's decision through this projection — only its own.
 */
export function buildFindDetailForCaseQuery(
  db: Kysely<Database>,
  casoId: string,
  callerId: string,
) {
  return db
    .selectFrom("propuestas")
    .innerJoin("rondas", "rondas.id", "propuestas.ronda_id")
    .leftJoin("respuestas_propuesta as propia", (join) =>
      join
        .onRef("propia.propuesta_id", "=", "propuestas.id")
        .on("propia.parte_id", "=", callerId),
    )
    .select([
      "propuestas.id",
      "propuestas.caso_id",
      "propuestas.ronda_id",
      "propuestas.contenido",
      "propuestas.fundamentacion",
      "propuestas.estado",
      "propuestas.modelo_ia",
      "propuestas.fecha",
      "rondas.numero as ronda_numero",
      "rondas.estado as ronda_estado",
      "propia.decision as own_decision",
    ])
    .where("propuestas.caso_id", "=", casoId)
    .orderBy("rondas.numero", "asc");
}

export function buildExistsForRondaQuery(
  db: Kysely<Database>,
  casoId: string,
  rondaId: string,
) {
  return db
    .selectFrom("propuestas")
    .select("id")
    .where("caso_id", "=", casoId)
    .where("ronda_id", "=", rondaId)
    .limit(1);
}

export function buildFindCasoIdQuery(
  db: Kysely<Database>,
  propuestaId: string,
) {
  return db
    .selectFrom("propuestas")
    .select("caso_id")
    .where("id", "=", propuestaId);
}

export function buildFindByIdQuery(
  db: Kysely<Database>,
  casoId: string,
  propuestaId: string,
) {
  return db
    .selectFrom("propuestas")
    .select([...propuestaViewColumns])
    .where("id", "=", propuestaId)
    .where("caso_id", "=", casoId);
}

@Injectable()
export class PropuestasRepository {
  constructor(
    @Inject(KYSELY) private readonly kysely: Kysely<Database>,
    @Inject(CasosRepository) private readonly casosRepository: CasosRepository,
  ) {}

  createPending(
    casoId: string,
    rondaId: string,
    contenido: Propuesta["contenido"],
    modeloIa: string,
  ): Promise<PropuestaView> {
    return buildCreatePendingQuery(
      this.kysely,
      casoId,
      rondaId,
      contenido,
      modeloIa,
    )
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  patchGenerated(
    casoId: string,
    propuestaId: string,
    contenido: Propuesta["contenido"],
    fundamentacion: string | null,
  ): Promise<PropuestaView | undefined> {
    return buildPatchGeneratedQuery(
      this.kysely,
      casoId,
      propuestaId,
      contenido,
      fundamentacion,
    )
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  markEstado(
    casoId: string,
    propuestaId: string,
    estado: EstadoPropuesta,
  ): Promise<PropuestaView | undefined> {
    return buildMarkEstadoQuery(this.kysely, casoId, propuestaId, estado)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findForCase(casoId: string): Promise<PropuestaView[]> {
    return buildFindForCaseQuery(this.kysely, casoId).execute();
  }

  findDetailForCase(
    casoId: string,
    callerId: string,
  ): Promise<PropuestaDetail[]> {
    return buildFindDetailForCaseQuery(this.kysely, casoId, callerId)
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  async existsForRonda(casoId: string, rondaId: string): Promise<boolean> {
    const row = await buildExistsForRondaQuery(
      this.kysely,
      casoId,
      rondaId,
    ).executeTakeFirst();
    return row !== undefined;
  }

  readBothPartyPositionsForEngine(casoId: string) {
    return this.kysely
      .selectFrom("items")
      .select(["parte_id", "categoria", "nombre", "valor_min", "valor_max"])
      .where("caso_id", "=", casoId)
      .execute();
  }

  async findCasoId(propuestaId: string): Promise<string | undefined> {
    const row = await buildFindCasoIdQuery(
      this.kysely,
      propuestaId,
    ).executeTakeFirst();
    return row?.caso_id;
  }

  resolveRespuesta(
    casoId: string,
    propuestaId: string,
    parteId: string,
    decision: DecisionPropuesta,
  ): Promise<PropuestaView> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const locked = await buildPropuestaLockQuery(
          trx,
          casoId,
          propuestaId,
        ).executeTakeFirst();
        if (!locked) {
          throw propuestaNotFound();
        }
        const current = await buildFindByIdQuery(
          trx,
          casoId,
          propuestaId,
        ).executeTakeFirstOrThrow();
        if (current.estado !== estadoPendiente) {
          throw propuestaNotPendiente();
        }
        if ((current.contenido as PropuestaContenido).narrative === null) {
          throw propuestaNotReady();
        }
        await buildInsertRespuestaQuery(
          trx,
          propuestaId,
          parteId,
          decision,
        ).executeTakeFirstOrThrow();

        if (decision === decisionRechaza) {
          const rechazada = await buildMarkEstadoQuery(
            trx,
            casoId,
            propuestaId,
            estadoRechazada,
          ).executeTakeFirstOrThrow();
          const { ronda_actual: numeroActual } =
            await buildCurrentRondaActualQuery(
              trx,
              casoId,
            ).executeTakeFirstOrThrow();
          await buildInsertNextRondaQuery(
            trx,
            casoId,
            numeroActual + 1,
          ).executeTakeFirstOrThrow();
          return rechazada;
        }

        const responses = await buildFindByPropuestaQuery(
          trx,
          propuestaId,
        ).execute();
        const bothAccepted =
          responses.length === 2 &&
          responses.every((response) => response.decision === decisionAcepta);
        if (!bothAccepted) {
          return current;
        }
        const aceptada = await buildMarkEstadoQuery(
          trx,
          casoId,
          propuestaId,
          estadoAceptada,
        ).executeTakeFirstOrThrow();
        await this.casosRepository.markAcordado(casoId, trx);
        return aceptada;
      })
      .catch((error: unknown) => {
        if (error instanceof HttpException) {
          throw error;
        }
        throw toDomainError(error);
      });
  }
}

export type EnginePosition = Awaited<
  ReturnType<PropuestasRepository["readBothPartyPositionsForEngine"]>
>[number];
