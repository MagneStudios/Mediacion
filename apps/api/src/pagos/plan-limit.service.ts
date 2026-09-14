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
  limiteCasos: number | null;
  scope: CaseLimitScope;
};

const recursoCasos = "casos";

/**
 * El mismo código que `consume_quota` levanta como `NO_ACTIVE_SUBSCRIPTION`
 * más adentro, en la misma transacción del alta. Sin esto los dos chequeos
 * discrepaban: acá "sin suscripción" se leía como "sin límite configurado" y
 * dejaba pasar, y recién el trigger cortaba. El usuario veía el mismo error,
 * pero después de abrir una transacción que nunca podía terminar bien.
 */
function noActiveSubscription(): HttpException {
  return new HttpException(
    {
      code: "no_active_subscription",
      message: "An active subscription is required",
    },
    HttpStatus.FORBIDDEN,
  );
}

function planLimitExceeded(usado: number, limite: number): HttpException {
  return new HttpException(
    {
      code: "plan_limit_exceeded",
      message: "Plan case limit reached",
      recurso: recursoCasos,
      usado,
      limite,
    },
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
    if (!activeLimit) {
      throw noActiveSubscription();
    }
    if (
      activeLimit.limiteCasos === unlimitedLimit ||
      activeLimit.limiteCasos === null
    ) {
      return;
    }
    const count = await this.countCases(activeLimit.scope);
    if (count >= activeLimit.limiteCasos) {
      throw planLimitExceeded(count, activeLimit.limiteCasos);
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
