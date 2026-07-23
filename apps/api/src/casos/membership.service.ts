import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { KYSELY } from "../database/database.tokens";
import type { CasoParteMembership } from "./casos.types";
import { estadoInvitacionAceptada } from "./casos.types";

@Injectable()
export class MembershipService {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  async assertMembership(
    casoId: string,
    callerId: string,
  ): Promise<CasoParteMembership> {
    const parte = await this.kysely
      .selectFrom("caso_partes")
      .select([
        "id",
        "caso_id",
        "usuario_id",
        "rol_en_caso",
        "estado_invitacion",
      ])
      .where("caso_id", "=", casoId)
      .where("usuario_id", "=", callerId)
      .where("estado_invitacion", "=", estadoInvitacionAceptada)
      .executeTakeFirst();
    if (!parte) {
      throw new HttpException(
        { code: "caso_not_found", message: "Case not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    return parte;
  }
}
