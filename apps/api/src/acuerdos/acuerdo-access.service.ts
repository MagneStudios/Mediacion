import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import { MembershipService } from "../casos/membership.service";
import { KYSELY } from "../database/database.tokens";

const rolEstudio: Selectable<Database["usuarios"]>["rol"] = "estudio";

function isNotFound(error: unknown): boolean {
  return (
    error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND
  );
}

function casoNotFound(): HttpException {
  return new HttpException(
    { code: "caso_not_found", message: "Case not found" },
    HttpStatus.NOT_FOUND,
  );
}

@Injectable()
export class AcuerdoAccessService {
  constructor(
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(KYSELY) private readonly kysely: Kysely<Database>,
  ) {}

  async assertReadAccess(casoId: string, callerId: string): Promise<void> {
    try {
      await this.membershipService.assertMembership(casoId, callerId);
      return;
    } catch (error: unknown) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
    const sharesEstudio = await this.kysely
      .selectFrom("casos")
      .innerJoin("usuarios", "usuarios.estudio_id", "casos.estudio_id")
      .select("casos.id")
      .where("casos.id", "=", casoId)
      .where("usuarios.id", "=", callerId)
      .where("usuarios.rol", "=", rolEstudio)
      .where("usuarios.activo", "=", true)
      .executeTakeFirst();
    if (!sharesEstudio) {
      throw casoNotFound();
    }
  }
}
