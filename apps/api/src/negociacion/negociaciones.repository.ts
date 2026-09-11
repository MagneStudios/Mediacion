import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import {
  estadoAcuerdoBorrador,
  estadoAcuerdoFirmado,
} from "../acuerdos/acuerdos.types";
import { CasosRepository } from "../casos/casos.repository";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  Acuerdo,
  MateriaAcuerdo,
  MetodoCaso,
  NegociacionView,
  RenegociacionView,
} from "./negociacion.types";
import {
  estadoNegociacionAcordada,
  estadoNegociacionActiva,
  estadoNegociacionBorrador,
} from "./negociacion.types";
import {
  buildBumpNegociacionRoundQuery,
  buildInsertNextRondaQuery,
} from "./rondas.repository";

/**
 * Every negociacion of a caso, each with the acuerdo currently in force.
 *
 * The acuerdo is joined left and on `vigente`, so a negociacion with no
 * agreement — or one whose only agreements were superseded — still comes back,
 * with the acuerdo columns null. Flattened here and nested by the repository:
 * the join is what keeps this one query instead of one per negociacion.
 */
export function buildListNegociacionesByCasoQuery(
  db: Kysely<Database>,
  casoId: string,
) {
  return db
    .selectFrom("negociaciones")
    .leftJoin("acuerdos", (join) =>
      join
        .onRef("acuerdos.negociacion_id", "=", "negociaciones.id")
        .on("acuerdos.vigente", "=", true),
    )
    .select([
      "negociaciones.id as id",
      "negociaciones.caso_id as caso_id",
      "negociaciones.materia as subject_type",
      "negociaciones.method as metodo",
      "negociaciones.estado as estado",
      "negociaciones.round as ronda_actual",
      "negociaciones.created_at as created_at",
      "acuerdos.id as acuerdo_id",
      "acuerdos.estado as acuerdo_estado",
      "acuerdos.version as acuerdo_version",
    ])
    .where("negociaciones.caso_id", "=", casoId)
    .orderBy("negociaciones.created_at", "asc");
}

/**
 * The negociacion a propuesta belongs to. `propuestas.negociacion_id` is NOT
 * NULL since the migration that moved the negotiation under a materia, so the
 * propuesta id alone answers "which materia was just agreed" — no walk through
 * `rondas` needed.
 */
export function buildResolveNegociacionByPropuestaQuery(
  db: Kysely<Database>,
  propuestaId: string,
) {
  return db
    .selectFrom("propuestas")
    .select("negociacion_id")
    .where("id", "=", propuestaId);
}

/**
 * The negociacion of a propuesta together with its current round. The
 * rejection branch of `resolveRespuesta` opens the next ronda, and the round it
 * has to bump is the one of the propuesta's own materia — reading the caso's
 * legacy negociacion instead moved tenencia forward because alimentos was
 * rejected.
 */
export function buildResolveNegociacionRoundByPropuestaQuery(
  db: Kysely<Database>,
  propuestaId: string,
) {
  return db
    .selectFrom("propuestas")
    .innerJoin("negociaciones", "negociaciones.id", "propuestas.negociacion_id")
    .select(["negociaciones.id as id", "negociaciones.round as round"])
    .where("propuestas.id", "=", propuestaId);
}

/**
 * Opens a materia. `onConflict().doNothing()` over
 * `negociaciones_caso_materia_unique` rather than an existence check: under
 * READ COMMITTED two callers adding `tenencia` at the same moment both read
 * "absent", and the second insert is what has to be recognised as the
 * duplicate. No row back therefore means the materia was already open.
 */
export function buildInsertNegociacionQuery(
  db: Kysely<Database>,
  casoId: string,
  materia: MateriaAcuerdo,
  method: MetodoCaso,
) {
  return db
    .insertInto("negociaciones")
    .values({ caso_id: casoId, materia, method })
    .onConflict((oc) => oc.columns(["caso_id", "materia"]).doNothing())
    .returning([
      "id",
      "caso_id",
      "method as metodo",
      "estado",
      "round as ronda_actual",
      "created_at",
    ]);
}

/**
 * Marks one materia agreed. Guarded on the state it is leaving so a replayed
 * acceptance is a no-op instead of a second write, and scoped to the
 * negociacion: agreeing on tenencia must not say anything about alimentos.
 */
export function buildMarkNegociacionAcordadaQuery(
  db: Kysely<Database>,
  negociacionId: string,
) {
  return db
    .updateTable("negociaciones")
    .set({ estado: estadoNegociacionAcordada })
    .where("id", "=", negociacionId)
    .where("estado", "!=", estadoNegociacionAcordada);
}

/**
 * The negociacion plus the acuerdo in force, locked for the renegotiation:
 * two callers renegotiating the same materia at once must not both read v1 as
 * current and each insert a v2. Joined inner on `vigente` so a negociacion
 * with nothing in force simply produces no row — the caller reports that as
 * "not agreed", the same as an unsigned one.
 */
export function buildFindRenegociableQuery(
  db: Kysely<Database>,
  negociacionId: string,
) {
  return db
    .selectFrom("negociaciones")
    .innerJoin("acuerdos", (join) =>
      join
        .onRef("acuerdos.negociacion_id", "=", "negociaciones.id")
        .on("acuerdos.vigente", "=", true),
    )
    .select([
      "negociaciones.id as negociacion_id",
      "negociaciones.caso_id as caso_id",
      "negociaciones.round as round",
      "acuerdos.id as acuerdo_id",
      "acuerdos.estado as acuerdo_estado",
      "acuerdos.version as acuerdo_version",
      "acuerdos.contenido as acuerdo_contenido",
    ])
    .where("negociaciones.id", "=", negociacionId)
    .forUpdate();
}

/** Retires the previous agreement without deleting it: it is legal proof. */
export function buildSupersedeAcuerdoQuery(
  db: Kysely<Database>,
  acuerdoId: string,
) {
  return db
    .updateTable("acuerdos")
    .set({ vigente: false })
    .where("id", "=", acuerdoId)
    .where("vigente", "=", true);
}

/**
 * The next version, preloaded with the retired one's content — the "starting
 * point" §2.4 asks for. Not re-rendered from the accepted propuesta: the
 * clause catalogue that would drive that does not exist yet.
 */
export function buildInsertAcuerdoSiguienteQuery(
  db: Kysely<Database>,
  previo: {
    caso_id: string;
    negociacion_id: string;
    version: number;
    acuerdo_id: string;
    contenido: Acuerdo["contenido"];
  },
) {
  return db
    .insertInto("acuerdos")
    .values({
      caso_id: previo.caso_id,
      negociacion_id: previo.negociacion_id,
      contenido: previo.contenido,
      estado: estadoAcuerdoBorrador,
      version: previo.version + 1,
      supersedes_agreement_id: previo.acuerdo_id,
      vigente: true,
    })
    .returning(["id"]);
}

/**
 * Saca una materia de `borrador` cuando empieza a negociarse de verdad — el
 * mismo momento en que el caso pasa a `en_negociacion`. Sin esto la columna
 * que la 40 creó nunca salía de su default: una negociación con propuestas y
 * rondas seguía figurando `borrador`, y la tarjeta por materia del front
 * mostraba "Borrador" para algo vivo (pedido 4 de
 * `docs/pedidos-db-post-auditoria-09-09.md`).
 *
 * Guardada en `borrador` a propósito: es idempotente, y una materia ya
 * `acordada` que recibe otra propuesta no puede volver atrás por este camino
 * (para eso está `renegociar`, que sí es explícito).
 */
export function buildActivarNegociacionQuery(
  db: Kysely<Database>,
  negociacionId: string,
) {
  return db
    .updateTable("negociaciones")
    .set({ estado: estadoNegociacionActiva })
    .where("id", "=", negociacionId)
    .where("estado", "=", estadoNegociacionBorrador);
}

export function buildReactivarNegociacionQuery(
  db: Kysely<Database>,
  negociacionId: string,
) {
  return db
    .updateTable("negociaciones")
    .set({ estado: estadoNegociacionActiva })
    .where("id", "=", negociacionId);
}

type NegociacionRow = Omit<NegociacionView, "acuerdo_vigente"> & {
  acuerdo_id: string | null;
  acuerdo_estado:
    | NonNullable<NegociacionView["acuerdo_vigente"]>["estado"]
    | null;
  acuerdo_version: number | null;
};

function toView(row: NegociacionRow): NegociacionView {
  const { acuerdo_id, acuerdo_estado, acuerdo_version, ...negociacion } = row;
  return {
    ...negociacion,
    acuerdo_vigente:
      acuerdo_id === null || acuerdo_estado === null || acuerdo_version === null
        ? null
        : { id: acuerdo_id, estado: acuerdo_estado, version: acuerdo_version },
  };
}

/**
 * The caso a negociacion belongs to and the round it is on — what every route
 * addressed by negociacion id needs before it can assert membership or resolve
 * a ronda.
 */
export function buildFindNegociacionByIdQuery(
  db: Kysely<Database>,
  negociacionId: string,
) {
  return db
    .selectFrom("negociaciones")
    .select(["caso_id", "round"])
    .where("id", "=", negociacionId);
}

export function negociacionMateriaAlreadyExists(): HttpException {
  return new HttpException(
    {
      code: "negociacion_materia_already_exists",
      message: "This caso already has a negociacion for that materia",
    },
    HttpStatus.CONFLICT,
  );
}

export function negociacionNotAcordada(): HttpException {
  return new HttpException(
    {
      code: "negociacion_not_acordada",
      message: "This negociacion has no signed agreement in force",
    },
    HttpStatus.CONFLICT,
  );
}

@Injectable()
export class NegociacionesRepository {
  constructor(
    @Inject(KYSELY) private readonly kysely: Kysely<Database>,
    @Inject(CasosRepository) private readonly casosRepository: CasosRepository,
  ) {}

  /**
   * Takes the caller's transaction rather than opening its own: this runs
   * inside the same unit of work that accepted the propuesta, so a rollback
   * there must not leave a negociacion marked agreed.
   */
  async markAcordadaByPropuesta(
    propuestaId: string,
    trx: Kysely<Database>,
  ): Promise<void> {
    const propuesta = await buildResolveNegociacionByPropuestaQuery(
      trx,
      propuestaId,
    ).executeTakeFirstOrThrow();
    await buildMarkNegociacionAcordadaQuery(
      trx,
      propuesta.negociacion_id,
    ).execute();
  }

  /** Afectar cero filas es normal: la materia ya estaba activa o acordada. */
  activar(negociacionId: string): Promise<void> {
    return buildActivarNegociacionQuery(this.kysely, negociacionId)
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findById(
    negociacionId: string,
  ): Promise<{ caso_id: string; round: number } | undefined> {
    return buildFindNegociacionByIdQuery(
      this.kysely,
      negociacionId,
    ).executeTakeFirst();
  }

  /**
   * Opens a materia and, in the same transaction, drops the caso out of
   * `acordado`: "every negociacion of this caso is signed" stops being true the
   * moment one more exists. `reopenFromAcordado` is a no-op on a caso that was
   * not agreed, which is the common case.
   */
  crear(
    casoId: string,
    materia: MateriaAcuerdo,
    method: MetodoCaso,
  ): Promise<NegociacionView> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const creada = await buildInsertNegociacionQuery(
          trx,
          casoId,
          materia,
          method,
        ).executeTakeFirst();
        if (!creada) {
          throw negociacionMateriaAlreadyExists();
        }
        await this.casosRepository.reopenFromAcordado(casoId, trx);
        return toView({
          ...creada,
          subject_type: materia,
          acuerdo_id: null,
          acuerdo_estado: null,
          acuerdo_version: null,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof HttpException) {
          throw error;
        }
        throw toDomainError(error);
      });
  }

  /**
   * Reopens one materia over its signed agreement. Every step is in the same
   * transaction on purpose: a superseded v1 with no v2, or a bumped round with
   * no ronda row, would each leave the case unusable.
   *
   * The caso is reopened last and unconditionally — `reopenFromAcordado` is a
   * no-op unless the caso really was `acordado`, which it only is when every
   * materia was signed. That is exactly the claim this call invalidates.
   */
  renegociar(negociacionId: string): Promise<RenegociacionView> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const previo = await buildFindRenegociableQuery(
          trx,
          negociacionId,
        ).executeTakeFirst();
        if (!previo || previo.acuerdo_estado !== estadoAcuerdoFirmado) {
          throw negociacionNotAcordada();
        }
        await buildSupersedeAcuerdoQuery(trx, previo.acuerdo_id).execute();
        const siguiente = await buildInsertAcuerdoSiguienteQuery(trx, {
          caso_id: previo.caso_id,
          negociacion_id: previo.negociacion_id,
          version: previo.acuerdo_version,
          acuerdo_id: previo.acuerdo_id,
          contenido: previo.acuerdo_contenido,
        }).executeTakeFirstOrThrow();
        await buildReactivarNegociacionQuery(trx, negociacionId).execute();
        const numero = previo.round + 1;
        await buildBumpNegociacionRoundQuery(
          trx,
          negociacionId,
          numero,
        ).execute();
        await buildInsertNextRondaQuery(
          trx,
          previo.caso_id,
          negociacionId,
          numero,
        ).executeTakeFirstOrThrow();
        await this.casosRepository.reopenFromAcordado(previo.caso_id, trx);
        return {
          negotiation_id: negociacionId,
          agreement_id: siguiente.id,
        };
      })
      .catch((error: unknown) => {
        if (error instanceof HttpException) {
          throw error;
        }
        throw toDomainError(error);
      });
  }

  async listByCaso(casoId: string): Promise<NegociacionView[]> {
    const rows = (await buildListNegociacionesByCasoQuery(
      this.kysely,
      casoId,
    ).execute()) as unknown as NegociacionRow[];
    return rows.map(toView);
  }
}
