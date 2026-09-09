import type { Database, Json } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import { estadoNegociacionAcordada } from "../negociacion/negociacion.types";
import type { Acuerdo } from "./acuerdos.types";
import {
  estadoAcuerdoBorrador,
  estadoAcuerdoEnviadoAFirma,
  estadoAcuerdoFirmado,
} from "./acuerdos.types";
import { FirmasRepository } from "./firmas.repository";

export function acuerdoAlreadyExists(): HttpException {
  return new HttpException(
    {
      code: "acuerdo_already_exists",
      message: "An agreement is already in force for this negociacion",
    },
    HttpStatus.CONFLICT,
  );
}

export function acuerdoNotBorrador(): HttpException {
  return new HttpException(
    {
      code: "acuerdo_not_borrador",
      message: "Agreement is no longer in borrador state",
    },
    HttpStatus.CONFLICT,
  );
}

export function acuerdoNotFound(): HttpException {
  return new HttpException(
    { code: "acuerdo_not_found", message: "Agreement not found" },
    HttpStatus.NOT_FOUND,
  );
}

/**
 * Every agreed materia of a caso, each with the id of its acuerdo in force —
 * null when it has none yet. Left-joined on `vigente` so a negociacion whose
 * only agreements were superseded still reads as "needs one".
 */
export function buildFindNegociacionesAcordadasQuery(
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
    .select(["negociaciones.id as id", "acuerdos.id as acuerdo_vigente_id"])
    .where("negociaciones.caso_id", "=", casoId)
    .where("negociaciones.estado", "=", estadoNegociacionAcordada)
    .orderBy("negociaciones.created_at", "asc");
}

export type NegociacionAcordada = {
  id: string;
  acuerdo_vigente_id: string | null;
};

@Injectable()
export class AcuerdosRepository {
  constructor(
    @Inject(KYSELY) private readonly kysely: Kysely<Database>,
    @Inject(FirmasRepository)
    private readonly firmasRepository: FirmasRepository,
  ) {}

  findById(acuerdoId: string): Promise<Acuerdo | undefined> {
    return this.kysely
      .selectFrom("acuerdos")
      .selectAll()
      .where("id", "=", acuerdoId)
      .executeTakeFirst();
  }

  findByCasoId(casoId: string): Promise<Acuerdo | undefined> {
    return this.kysely
      .selectFrom("acuerdos")
      .selectAll()
      .where("caso_id", "=", casoId)
      .executeTakeFirst();
  }

  claimForSignature(acuerdoId: string): Promise<Acuerdo> {
    return this.kysely
      .updateTable("acuerdos")
      .set({ estado: estadoAcuerdoEnviadoAFirma })
      .where("id", "=", acuerdoId)
      .where("estado", "=", estadoAcuerdoBorrador)
      .returningAll()
      .executeTakeFirst()
      .then((claimed) => {
        if (!claimed) {
          throw acuerdoNotBorrador();
        }
        return claimed;
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  persistSignatureEnvelope(
    acuerdoId: string,
    envelopeId: string,
    usuarioIds: string[],
  ): Promise<Acuerdo> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const updated = await trx
          .updateTable("acuerdos")
          .set({ docusign_envelope_id: envelopeId })
          .where("id", "=", acuerdoId)
          .returningAll()
          .executeTakeFirstOrThrow();
        await this.firmasRepository.insertMany(acuerdoId, usuarioIds, trx);
        return updated;
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  revertClaimToBorrador(acuerdoId: string): Promise<void> {
    return this.kysely
      .updateTable("acuerdos")
      .set({ estado: estadoAcuerdoBorrador })
      .where("id", "=", acuerdoId)
      .where("estado", "=", estadoAcuerdoEnviadoAFirma)
      .where("docusign_envelope_id", "is", null)
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  markFirmado(acuerdoId: string): Promise<void> {
    return this.kysely
      .updateTable("acuerdos")
      .set({ estado: estadoAcuerdoFirmado })
      .where("id", "=", acuerdoId)
      .where("estado", "=", estadoAcuerdoEnviadoAFirma)
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findNegociacionesAcordadas(casoId: string): Promise<NegociacionAcordada[]> {
    return buildFindNegociacionesAcordadasQuery(
      this.kysely,
      casoId,
    ).execute() as Promise<NegociacionAcordada[]>;
  }

  /**
   * The acuerdo currently in force for one materia. `vigente` — not the row's
   * mere existence — is what "current" means since renegotiation supersedes
   * agreements instead of deleting them.
   */
  findVigenteByNegociacion(
    negociacionId: string,
  ): Promise<Acuerdo | undefined> {
    return this.kysely
      .selectFrom("acuerdos")
      .selectAll()
      .where("negociacion_id", "=", negociacionId)
      .where("vigente", "=", true)
      .executeTakeFirst();
  }

  /**
   * Scoped to the negociacion, not the caso: a caso holds one acuerdo per
   * materia, so rejecting on "this caso already has an agreement" would block
   * alimentos the moment tenencia had one.
   */
  insertDraft(
    casoId: string,
    negociacionId: string,
    contenido: Json,
  ): Promise<Acuerdo> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const existing = await trx
          .selectFrom("acuerdos")
          .select("id")
          .where("negociacion_id", "=", negociacionId)
          .where("vigente", "=", true)
          .executeTakeFirst();
        if (existing) {
          throw acuerdoAlreadyExists();
        }
        return trx
          .insertInto("acuerdos")
          .values({
            caso_id: casoId,
            negociacion_id: negociacionId,
            contenido,
            estado: estadoAcuerdoBorrador,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
