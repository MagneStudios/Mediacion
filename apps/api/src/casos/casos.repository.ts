import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { ConflictError } from "../common/errors/domain-errors";
import { KYSELY } from "../database/database.tokens";
import type {
  CaseDetailRow,
  CaseSummaryRow,
  Caso,
  ContraparteByCaso,
  CreateCasoDto,
} from "./casos.types";
import { estadoInvitacionAceptada, rolesParte } from "./casos.types";

const caseDetailColumns = [
  "casos.id",
  "casos.codigo",
  "casos.nombre",
  "casos.descripcion",
  "casos.metodo",
  "casos.estado",
  "casos.creador_id",
  "casos.created_at",
  "casos.updated_at",
  "casos.plazo",
  "casos.sla_tipo",
] as const;

const caseSummaryColumns = [
  "casos.id",
  "casos.codigo",
  "casos.nombre",
  "casos.estado",
  "casos.metodo",
  "casos.created_at",
  "casos.plazo",
  "casos.sla_tipo",
] as const;

/**
 * `ronda_actual` moved from `casos` to `negociaciones.round`. Kysely widens
 * any subquery-as-column selection with `| null` (it can't statically know a
 * correlated subquery always matches), so this is built with the `sql` tag
 * instead of `eb.selectFrom(...).as(...)` to keep the column's real,
 * non-nullable type — every caso has exactly one legacy (materia IS NULL)
 * negociación by construction (`CasosRepository.createCaseWithParteA`).
 */
function withRondaActual() {
  return sql<number>`(
    select "round" from "negociaciones"
    where "negociaciones"."caso_id" = "casos"."id"
      and "negociaciones"."materia" is null
  )`.as("ronda_actual");
}

/**
 * `acordado` is derived, not written: a caso is agreed only once **every** one
 * of its negociaciones has an acuerdo in force and signed
 * (`docs/decisiones-db/2026-09-06-acuerdos-modulares.md` §3). Before materias
 * existed this was set on the first accepted propuesta, which with three
 * materias would switch off the two nobody had agreed on yet.
 *
 * One UPDATE with two `NOT EXISTS`, never a read-then-write: with two
 * signatures completing at once, only the last one to commit sees every
 * negociacion covered. The `estado = 'en_negociacion'` guard is what makes a
 * replayed webhook a no-op, and the first `EXISTS` keeps a caso with no
 * negociaciones at all from vacuously satisfying "all of them are signed".
 */
export function buildRecomputeAcordadoQuery(
  db: Kysely<Database>,
  casoId: string,
) {
  return db
    .updateTable("casos")
    .set({ estado: "acordado" })
    .where("id", "=", casoId)
    .where("estado", "=", "en_negociacion")
    .where(({ exists, not, selectFrom }) =>
      exists(
        selectFrom("negociaciones")
          .select("negociaciones.id")
          .whereRef("negociaciones.caso_id", "=", "casos.id"),
      ).and(
        not(
          exists(
            selectFrom("negociaciones")
              .select("negociaciones.id")
              .whereRef("negociaciones.caso_id", "=", "casos.id")
              .where(
                ({ not: notInner, exists: existsInner, selectFrom: from }) =>
                  notInner(
                    existsInner(
                      from("acuerdos")
                        .select("acuerdos.id")
                        .whereRef(
                          "acuerdos.negociacion_id",
                          "=",
                          "negociaciones.id",
                        )
                        .where("acuerdos.vigente", "=", true)
                        .where("acuerdos.estado", "=", "firmado"),
                    ),
                  ),
              ),
          ),
        ),
      ),
    )
    .returning(["id"]);
}

const estadosElegiblesVencimiento: Caso["estado"][] = [
  "nuevo",
  "activo",
  "en_negociacion",
];

const eventoVencimiento = "vencimiento";
const estadosNotificacionTerminales = ["enviada", "fallida"] as const;

const sweepBatchSize = 25;

const activacionSavepoint = "gate_activacion_suscripciones";

const casoBloqueadoSuscripcionesCode = "caso_bloqueado_suscripciones";

/** True only for the C-01 gate's own conflict, never for conflicts at large. */
function isGateBlocked(error: unknown): boolean {
  if (!(error instanceof ConflictError)) {
    return false;
  }
  const body = error.getResponse();
  return (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    (body as { code: unknown }).code === casoBloqueadoSuscripcionesCode
  );
}

@Injectable()
export class CasosRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  createCaseWithParteA(
    input: CreateCasoDto,
    creadorId: string,
    beforeInsert?: (trx: Kysely<Database>) => Promise<void>,
  ): Promise<Caso> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        if (beforeInsert) {
          await beforeInsert(trx);
        }
        const caso = await trx
          .insertInto("casos")
          .values({
            creador_id: creadorId,
            nombre: input.nombre,
            descripcion: input.descripcion ?? null,
            metodo: input.metodo,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("negociaciones")
          .values({
            caso_id: caso.id,
            materia: null,
            method: input.metodo,
          })
          .execute();

        await trx
          .insertInto("caso_partes")
          .values({
            caso_id: caso.id,
            usuario_id: creadorId,
            rol_en_caso: "parte_a",
            estado_invitacion: estadoInvitacionAceptada,
            fecha_union: new Date().toISOString(),
          })
          .execute();

        return caso;
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findOwnCases(callerId: string): Promise<CaseSummaryRow[]> {
    return this.kysely
      .selectFrom("casos")
      .innerJoin("caso_partes", "caso_partes.caso_id", "casos.id")
      .select([...caseSummaryColumns])
      .select(() => withRondaActual())
      .where("caso_partes.usuario_id", "=", callerId)
      .where("caso_partes.estado_invitacion", "=", estadoInvitacionAceptada)
      .execute();
  }

  /**
   * Resolved in a single round trip for every caso on screen. Mediadores are
   * excluded on purpose: the dashboard labels the opposing parte, not the staff.
   */
  findContrapartes(
    casoIds: string[],
    callerId: string,
  ): Promise<ContraparteByCaso[]> {
    if (casoIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.kysely
      .selectFrom("caso_partes")
      .innerJoin("usuarios", "usuarios.id", "caso_partes.usuario_id")
      .select([
        "caso_partes.caso_id",
        "caso_partes.usuario_id",
        "caso_partes.rol_en_caso",
        "usuarios.nombre",
        "usuarios.apellido",
      ])
      .where("caso_partes.caso_id", "in", casoIds)
      .where("caso_partes.usuario_id", "!=", callerId)
      .where("caso_partes.rol_en_caso", "in", rolesParte)
      .where("caso_partes.estado_invitacion", "=", estadoInvitacionAceptada)
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findDetailForMember(
    casoId: string,
    callerId: string,
  ): Promise<CaseDetailRow | undefined> {
    return this.kysely
      .selectFrom("casos")
      .innerJoin("caso_partes", "caso_partes.caso_id", "casos.id")
      .select([...caseDetailColumns])
      .select(() => withRondaActual())
      .where("casos.id", "=", casoId)
      .where("caso_partes.usuario_id", "=", callerId)
      .where("caso_partes.estado_invitacion", "=", estadoInvitacionAceptada)
      .executeTakeFirst();
  }

  /**
   * Moves a caso out of `nuevo` when the second party joins: to `activo` when
   * the C-01 gate lets it through, and to `pendiente_suscripciones` when it
   * does not.
   *
   * The gate (`trg_casos_gate_suscripciones`) is the authority on "are both
   * parties paid up", so this asks by attempting the real transition rather
   * than re-deriving the rule here — there is no preview RPC, and a copy of the
   * rule in application code is a copy that can drift from the trigger.
   *
   * The attempt runs inside a savepoint because a `RAISE EXCEPTION` poisons the
   * whole transaction: without it, the gate firing would roll back the join
   * that this activation is the last step of, and the party who just accepted
   * their invitation would not be a member of anything. Rolling back to the
   * savepoint discards only the failed UPDATE and leaves the join intact.
   *
   * Any conflict other than the gate propagates untouched — an invalid
   * transition is still a real error, not something to hold.
   */
  async activateOrHoldForSuscripciones(
    casoId: string,
    trx: Kysely<Database>,
  ): Promise<void> {
    await sql`savepoint ${sql.raw(activacionSavepoint)}`.execute(trx);
    try {
      await trx
        .updateTable("casos")
        .set({ estado: "activo" })
        .where("id", "=", casoId)
        .where("estado", "=", "nuevo")
        .execute();
    } catch (error: unknown) {
      const domainError = toDomainError(error);
      if (!isGateBlocked(domainError)) {
        throw domainError;
      }
      await sql`rollback to savepoint ${sql.raw(activacionSavepoint)}`.execute(
        trx,
      );
      await trx
        .updateTable("casos")
        .set({ estado: "pendiente_suscripciones" })
        .where("id", "=", casoId)
        .where("estado", "=", "nuevo")
        .execute()
        .catch((holdError: unknown) => {
          throw toDomainError(holdError);
        });
      return;
    }
    await sql`release savepoint ${sql.raw(activacionSavepoint)}`.execute(trx);
  }

  activateNegotiation(casoId: string): Promise<void> {
    return this.kysely
      .updateTable("casos")
      .set({ estado: "en_negociacion" })
      .where("id", "=", casoId)
      .where("estado", "=", "activo")
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  /**
   * Affecting no rows is the normal outcome, not an error: most signatures
   * complete with other materias still open. Takes the caller's connection so
   * it can run inside the transaction that marked the acuerdo signed.
   */
  recomputeAcordado(
    casoId: string,
    db: Kysely<Database> = this.kysely,
  ): Promise<void> {
    return buildRecomputeAcordadoQuery(db, casoId)
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  updatePlazo(
    casoId: string,
    plazo: string,
  ): Promise<Pick<Caso, "id" | "plazo">> {
    return this.kysely
      .updateTable("casos")
      .set({ plazo })
      .where("id", "=", casoId)
      .returning(["id", "plazo"])
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  updateEstado(
    casoId: string,
    estado: Caso["estado"],
  ): Promise<Pick<Caso, "id" | "estado">> {
    return this.kysely
      .updateTable("casos")
      .set({ estado })
      .where("id", "=", casoId)
      .returning(["id", "estado"])
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findPlazo(casoId: string): Promise<Pick<Caso, "id" | "plazo"> | undefined> {
    return this.kysely
      .selectFrom("casos")
      .select(["id", "plazo"])
      .where("id", "=", casoId)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findOverdueCasos(now: Date): Promise<Pick<Caso, "id">[]> {
    return this.kysely
      .selectFrom("casos")
      .select(["id"])
      .where("plazo", "is not", null)
      .where("plazo", "<=", now.toISOString())
      .where("estado", "in", estadosElegiblesVencimiento)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("caso_partes as cp")
            .select("cp.usuario_id")
            .whereRef("cp.caso_id", "=", "casos.id")
            .where("cp.estado_invitacion", "=", estadoInvitacionAceptada)
            .where((ebParte) =>
              ebParte.not(
                ebParte.exists(
                  ebParte
                    .selectFrom("notificaciones as n")
                    .select("n.id")
                    .whereRef("n.caso_id", "=", "casos.id")
                    .where("n.evento", "=", eventoVencimiento)
                    .whereRef("n.usuario_id", "=", "cp.usuario_id")
                    .where("n.estado", "in", estadosNotificacionTerminales),
                ),
              ),
            ),
        ),
      )
      .orderBy("plazo", "asc")
      .limit(sweepBatchSize)
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
