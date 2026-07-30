import type { Database, Json } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { Acuerdo } from "./acuerdos.types";
import {
  estadoAcuerdoBorrador,
  estadoAcuerdoEnviadoAFirma,
  estadoAcuerdoFirmado,
} from "./acuerdos.types";
import { FirmasRepository } from "./firmas.repository";

function acuerdoAlreadyExists(): HttpException {
  return new HttpException(
    {
      code: "acuerdo_already_exists",
      message: "An agreement already exists for this case",
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

  insertDraft(casoId: string, contenido: Json): Promise<Acuerdo> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        const existing = await trx
          .selectFrom("acuerdos")
          .select("id")
          .where("caso_id", "=", casoId)
          .executeTakeFirst();
        if (existing) {
          throw acuerdoAlreadyExists();
        }
        return trx
          .insertInto("acuerdos")
          .values({
            caso_id: casoId,
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
