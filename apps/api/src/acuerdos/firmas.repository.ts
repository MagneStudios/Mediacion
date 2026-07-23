import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type { Firma } from "./acuerdos.types";
import { docusignStatusPending } from "./acuerdos.types";

@Injectable()
export class FirmasRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  insertMany(acuerdoId: string, usuarioIds: string[]): Promise<Firma[]> {
    return this.kysely
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
}
