import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { Firma, FirmaView, SignatureInboxEntry } from "./acuerdos.types";
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

  /**
   * Joined to usuarios so the caller sees who is still pending by name. Only
   * nombre/apellido are exposed — never email or the raw user id of anyone
   * other than the signers of an acuerdo the caller can already read.
   */
  listViewByAcuerdo(acuerdoId: string): Promise<FirmaView[]> {
    return this.kysely
      .selectFrom("firmas")
      .innerJoin("usuarios", "usuarios.id", "firmas.usuario_id")
      .select([
        "firmas.usuario_id",
        "usuarios.nombre",
        "usuarios.apellido",
        "firmas.docusign_status",
        "firmas.fecha_firma",
      ])
      .where("firmas.acuerdo_id", "=", acuerdoId)
      .orderBy("usuarios.apellido", "asc")
      .execute() as Promise<FirmaView[]>;
  }

  /**
   * Every acuerdo the caller is a signer of, with their own state and how many
   * signers are still outstanding. Scoped by usuario_id, so it can only ever
   * return acuerdos the caller is party to.
   */
  listInboxForUsuario(usuarioId: string): Promise<SignatureInboxEntry[]> {
    return this.kysely
      .selectFrom("firmas as own")
      .innerJoin("acuerdos", "acuerdos.id", "own.acuerdo_id")
      .innerJoin("casos", "casos.id", "acuerdos.caso_id")
      .select((builder) => [
        "own.acuerdo_id as acuerdo_id",
        "acuerdos.caso_id as caso_id",
        "casos.nombre as caso_nombre",
        "casos.codigo as caso_codigo",
        "acuerdos.estado as acuerdo_estado",
        "own.docusign_status as own_status",
        "own.fecha_firma as own_fecha_firma",
        builder
          .selectFrom("firmas as pending")
          .select((inner) => inner.fn.countAll<number>().as("count"))
          .whereRef("pending.acuerdo_id", "=", "own.acuerdo_id")
          .where("pending.docusign_status", "!=", docusignStatusSigned)
          .as("pending_signers"),
      ])
      .where("own.usuario_id", "=", usuarioId)
      .orderBy("acuerdos.created_at", "desc")
      .execute() as unknown as Promise<SignatureInboxEntry[]>;
  }
}
