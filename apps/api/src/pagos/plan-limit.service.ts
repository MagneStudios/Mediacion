import type { Database } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { UsersRepository } from "../auth/users.repository";
import { KYSELY } from "../database/database.tokens";
import { estadoSuscripcionActiva } from "./pagos.types";

const unlimitedLimit = -1;

type CaseLimitScope =
  | { type: "usuario"; id: string }
  | { type: "estudio"; id: string };

type ActiveCaseLimit = {
  limiteCasos: number;
  scope: CaseLimitScope;
};

function planLimitExceeded(): HttpException {
  return new HttpException(
    { code: "plan_limit_exceeded", message: "Plan case limit reached" },
    HttpStatus.FORBIDDEN,
  );
}

@Injectable()
export class PlanLimitService {
  constructor(
    @Inject(KYSELY) private readonly kysely: Kysely<Database>,
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
  ) {}

  async assertCanCreateCase(callerId: string): Promise<void> {
    const activeLimit = await this.resolveActiveCaseLimit(callerId);
    if (!activeLimit || activeLimit.limiteCasos === unlimitedLimit) {
      return;
    }
    const count = await this.countCases(activeLimit.scope);
    if (count >= activeLimit.limiteCasos) {
      throw planLimitExceeded();
    }
  }

  private async resolveActiveCaseLimit(
    callerId: string,
  ): Promise<ActiveCaseLimit | undefined> {
    const personal = await this.findActiveSuscripcionByUsuario(callerId);
    if (personal) {
      return {
        limiteCasos: personal.limite_casos,
        scope: { type: "usuario", id: callerId },
      };
    }
    const profile = await this.usersRepository.findProfileById(callerId);
    if (!profile?.estudio_id) {
      return undefined;
    }
    const estudio = await this.findActiveSuscripcionByEstudio(
      profile.estudio_id,
    );
    if (!estudio) {
      return undefined;
    }
    return {
      limiteCasos: estudio.limite_casos,
      scope: { type: "estudio", id: profile.estudio_id },
    };
  }

  private findActiveSuscripcionByUsuario(usuarioId: string) {
    return this.kysely
      .selectFrom("suscripciones")
      .innerJoin("planes", "planes.id", "suscripciones.plan_id")
      .select(["planes.limite_casos"])
      .where("suscripciones.usuario_id", "=", usuarioId)
      .where("suscripciones.estado", "=", estadoSuscripcionActiva)
      .executeTakeFirst();
  }

  private findActiveSuscripcionByEstudio(estudioId: string) {
    return this.kysely
      .selectFrom("suscripciones")
      .innerJoin("planes", "planes.id", "suscripciones.plan_id")
      .select(["planes.limite_casos"])
      .where("suscripciones.estudio_id", "=", estudioId)
      .where("suscripciones.estado", "=", estadoSuscripcionActiva)
      .executeTakeFirst();
  }

  private async countCases(scope: CaseLimitScope): Promise<number> {
    const query = this.kysely
      .selectFrom("casos")
      .select((eb) => eb.fn.countAll<number>().as("count"));
    const scopedQuery =
      scope.type === "usuario"
        ? query.where("creador_id", "=", scope.id)
        : query.where("estudio_id", "=", scope.id);
    const row = await scopedQuery.executeTakeFirst();
    return Number(row?.count ?? 0);
  }
}
