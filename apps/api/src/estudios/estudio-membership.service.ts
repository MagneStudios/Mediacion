import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { RolUsuario } from "../auth/authenticated-user";
import { KYSELY } from "../database/database.tokens";

const adminRole: RolUsuario = "admin";

@Injectable()
export class EstudioMembershipService {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  async assertEstudioAccess(
    callerId: string,
    callerRole: RolUsuario,
    pathId: string,
  ): Promise<string> {
    if (callerRole === adminRole) {
      return pathId;
    }

    const usuario = await this.kysely
      .selectFrom("usuarios")
      .select(["estudio_id"])
      .where("id", "=", callerId)
      .executeTakeFirst();

    if (!usuario || usuario.estudio_id !== pathId) {
      throw new HttpException(
        { code: "estudio_not_found", message: "Estudio not found" },
        HttpStatus.NOT_FOUND,
      );
    }

    return pathId;
  }
}
