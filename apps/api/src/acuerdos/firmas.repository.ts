import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { Firma } from "./acuerdos.types";
import { docusignStatusPending, docusignStatusSigned } from "./acuerdos.types";

export type FirmaByEnvelope = Pick<
  Firma,
  "id" | "acuerdo_id" | "docusign_status"
>;

export type FirmaStatus = Pick<
  Firma,
  "id" | "usuario_id" | "docusign_status" | "fecha_firma"
>;

@Injectable()
export class FirmasRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  insertMany(
    acuerdoId: string,
    usuarioIds: string[],
    db: Kysely<Database> = this.kysely,
  ): Promise<Firma[]> {
    return db
      .insertInto("firmas")
      .values(
        usuarioIds.map((usuarioId) => ({
          acuerdo_id: acuerdoId,
          usuario_id: usuarioId,
          docusign_status: docusignStatusPending,
        })),
      )
      .returningAll()
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  updateStatus(
    firmaId: string,
    status: string,
    db: Kysely<Database> = this.kysely,
  ): Promise<void> {
    const values =
      status === docusignStatusSigned
        ? { docusign_status: status, fecha_firma: new Date().toISOString() }
        : { docusign_status: status };
    return db
      .updateTable("firmas")
      .set(values)
      .where("id", "=", firmaId)
      .execute()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findByEnvelopeAndEmail(
    envelopeId: string,
    email: string,
  ): Promise<FirmaByEnvelope | undefined> {
    return this.kysely
      .selectFrom("firmas")
      .innerJoin("acuerdos", "acuerdos.id", "firmas.acuerdo_id")
      .innerJoin("usuarios", "usuarios.id", "firmas.usuario_id")
      .select(["firmas.id", "firmas.acuerdo_id", "firmas.docusign_status"])
      .where("acuerdos.docusign_envelope_id", "=", envelopeId)
      .where("usuarios.email", "=", email)
      .executeTakeFirst();
  }

  listByAcuerdo(acuerdoId: string): Promise<FirmaStatus[]> {
    return this.kysely
      .selectFrom("firmas")
      .select(["id", "usuario_id", "docusign_status", "fecha_firma"])
      .where("acuerdo_id", "=", acuerdoId)
      .orderBy("id", "asc")
      .execute();
  }

  async allSignedForAcuerdo(acuerdoId: string): Promise<boolean> {
    const result = await this.kysely
      .selectFrom("firmas")
      .select((eb) => eb.fn.countAll<string>().as("pendingCount"))
      .where("acuerdo_id", "=", acuerdoId)
      .where("docusign_status", "!=", docusignStatusSigned)
      .executeTakeFirst();
    return Number(result?.pendingCount ?? 0) === 0;
  }
}
