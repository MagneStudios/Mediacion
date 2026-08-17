import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Insertable, Kysely } from "kysely";
import { sql } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  AcceptanceExportFilters,
  AcceptanceExportRow,
  ArrepentimientoDto,
  ContactoDto,
  DocumentoTipo,
  LegalDocumentRow,
  PublicacionProgramada,
  SolicitudArrepentimiento,
  SolicitudContacto,
  UsuarioActivo,
} from "./legal.types";
import { acceptanceExportColumns, legalDocumentColumns } from "./legal.types";

const solicitudReceiptColumns = ["codigo", "received_at"] as const;

const publicacionColumns = [
  "tipo",
  "version",
  "valid_from",
  "resumen_cambios",
] as const;

type AcceptanceInsert = Insertable<Database["user_agreements"]>;

type AvisoClaim = { id: string };

@Injectable()
export class LegalRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  findVigente(
    tipo: DocumentoTipo,
    now: string,
  ): Promise<LegalDocumentRow | undefined> {
    return this.kysely
      .selectFrom("legal_documents")
      .select(legalDocumentColumns)
      .where("tipo", "=", tipo)
      .where("valid_from", "<=", now)
      .where((eb) =>
        eb.or([eb("valid_to", "is", null), eb("valid_to", ">", now)]),
      )
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findProgramada(
    tipo: DocumentoTipo,
    now: string,
  ): Promise<LegalDocumentRow | undefined> {
    return this.kysely
      .selectFrom("legal_documents")
      .select(legalDocumentColumns)
      .where("tipo", "=", tipo)
      .where("valid_from", ">", now)
      .orderBy("valid_from")
      .limit(1)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findVigentes(now: string): Promise<LegalDocumentRow[]> {
    return this.kysely
      .selectFrom("legal_documents")
      .select(legalDocumentColumns)
      .where("valid_from", "<=", now)
      .where((eb) =>
        eb.or([eb("valid_to", "is", null), eb("valid_to", ">", now)]),
      )
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  insertAcceptances(rows: AcceptanceInsert[]): Promise<void> {
    return this.kysely
      .transaction()
      .execute(async (trx) => {
        await trx.insertInto("user_agreements").values(rows).execute();
      })
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  async hasAcceptedCurrent(
    userId: string,
    documentType: DocumentoTipo,
  ): Promise<boolean> {
    const row = await this.kysely
      .selectNoFrom(
        sql<boolean>`public.has_accepted_current(${userId}::uuid, ${documentType}::text)`.as(
          "accepted",
        ),
      )
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
    return row?.accepted === true;
  }

  listAcceptances(
    filters: AcceptanceExportFilters,
  ): Promise<AcceptanceExportRow[]> {
    let query = this.kysely
      .selectFrom("user_agreements")
      .select(acceptanceExportColumns);
    if (filters.usuario_id) {
      query = query.where("user_id", "=", filters.usuario_id);
    }
    if (filters.desde) {
      query = query.where("accepted_at", ">=", filters.desde);
    }
    if (filters.hasta) {
      query = query.where("accepted_at", "<=", filters.hasta);
    }
    if (filters.document_type) {
      query = query.where("document_type", "=", filters.document_type);
    }
    if (filters.version) {
      query = query.where("document_version", "=", filters.version);
    }
    return query
      .orderBy("accepted_at", "desc")
      .orderBy("id")
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  insertArrepentimiento(
    input: ArrepentimientoDto,
    usuarioId: string | null,
  ): Promise<
    Pick<SolicitudArrepentimiento, "codigo" | "received_at"> | undefined
  > {
    return this.kysely
      .insertInto("solicitudes_arrepentimiento")
      .values({ ...input, usuario_id: usuarioId })
      .returning(solicitudReceiptColumns)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  insertContacto(
    input: ContactoDto,
    usuarioId: string | null,
  ): Promise<Pick<SolicitudContacto, "codigo" | "received_at"> | undefined> {
    return this.kysely
      .insertInto("solicitudes_contacto")
      .values({ ...input, usuario_id: usuarioId })
      .returning(solicitudReceiptColumns)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findPublicacionesProgramadas(
    desde: string,
    hasta: string,
  ): Promise<PublicacionProgramada[]> {
    return this.kysely
      .selectFrom("legal_documents")
      .select(publicacionColumns)
      .where("valid_from", ">", desde)
      .where("valid_from", "<=", hasta)
      .orderBy("valid_from")
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findUsuariosActivos(): Promise<UsuarioActivo[]> {
    return this.kysely
      .selectFrom("usuarios")
      .select(["id", "email"])
      .where("activo", "=", true)
      .execute()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  claimAviso(
    usuarioId: string,
    tipo: string,
    version: string,
  ): Promise<AvisoClaim | undefined> {
    return this.kysely
      .insertInto("avisos_version_legal")
      .values({ usuario_id: usuarioId, tipo, version })
      .onConflict((oc) =>
        oc.columns(["usuario_id", "tipo", "version"]).doNothing(),
      )
      .returning("id")
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  findAvisoPendiente(
    usuarioId: string,
    tipo: string,
    version: string,
  ): Promise<AvisoClaim | undefined> {
    return this.kysely
      .selectFrom("avisos_version_legal")
      .select("id")
      .where("usuario_id", "=", usuarioId)
      .where("tipo", "=", tipo)
      .where("version", "=", version)
      .where("enviado_at", "is", null)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  markAvisoEnviado(id: string, enviadoAt: string): Promise<unknown> {
    return this.kysely
      .updateTable("avisos_version_legal")
      .set({ enviado_at: enviadoAt })
      .where("id", "=", id)
      .executeTakeFirst()
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }
}
