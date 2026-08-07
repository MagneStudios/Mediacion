import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { UsersRepository } from "../auth/users.repository";
import { MembershipService } from "../casos/membership.service";
import type {
  EstadoMediacion,
  Mediacion,
  MediacionView,
  MediadorOption,
} from "./mediacion.types";
import {
  estadoMediacionAceptada,
  estadoMediacionActiva,
  estadoMediacionFinalizada,
  estadoMediacionRechazada,
  estadoMediacionSolicitada,
  rn05MediadorDesdeRonda,
  rolEnCasoMediador,
} from "./mediacion.types";
import { MediacionesRepository } from "./mediaciones.repository";

const rolAdmin = "admin";
const rolMediador = "mediador";
const validEstados: EstadoMediacion[] = [
  estadoMediacionSolicitada,
  estadoMediacionAceptada,
  estadoMediacionRechazada,
  estadoMediacionActiva,
  estadoMediacionFinalizada,
];

function casoNotFound(): HttpException {
  return new HttpException(
    { code: "caso_not_found", message: "Case not found" },
    HttpStatus.NOT_FOUND,
  );
}

function invalidMediadorId(): HttpException {
  return new HttpException(
    {
      code: "invalid_mediador",
      message: "mediadorId must reference a mediador",
    },
    HttpStatus.BAD_REQUEST,
  );
}

function rondaBelowThreshold(): HttpException {
  return new HttpException(
    {
      code: "ronda_below_mediacion_threshold",
      message: `Human mediation is only available from ronda ${rn05MediadorDesdeRonda}`,
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

function mediacionNotFound(): HttpException {
  return new HttpException(
    { code: "mediacion_not_found", message: "Mediacion not found" },
    HttpStatus.NOT_FOUND,
  );
}

function selfAssignedMediador(): HttpException {
  return new HttpException(
    { code: "invalid_input", message: "mediadorId cannot be the caller" },
    HttpStatus.BAD_REQUEST,
  );
}

function mediacionAlreadyActive(): HttpException {
  return new HttpException(
    {
      code: "mediacion_already_active",
      message: "Caso already has an active mediacion",
    },
    HttpStatus.CONFLICT,
  );
}

function mediadorIsParty(): HttpException {
  return new HttpException(
    {
      code: "mediador_is_party",
      message: "mediadorId already has a caso_partes membership for this caso",
    },
    HttpStatus.CONFLICT,
  );
}

function invalidEstado(): HttpException {
  return new HttpException(
    {
      code: "invalid_input",
      message: `estado must be one of ${validEstados.join(", ")}`,
    },
    HttpStatus.BAD_REQUEST,
  );
}

function transitionNotAllowed(): HttpException {
  return new HttpException(
    {
      code: "mediacion_transition_not_allowed",
      message: "Caller is not allowed to perform this mediacion transition",
    },
    HttpStatus.CONFLICT,
  );
}

function assertValidMediadorId(mediadorId: string): void {
  if (typeof mediadorId !== "string" || mediadorId.trim().length === 0) {
    throw new HttpException(
      { code: "invalid_input", message: "mediadorId is required" },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function assertValidEstado(estado: EstadoMediacion): void {
  if (!validEstados.includes(estado)) {
    throw invalidEstado();
  }
}

function resolveGrantMembership(target: EstadoMediacion): boolean {
  return target === estadoMediacionAceptada;
}

function resolveTransitionAuthority(
  caller: AuthenticatedUser,
  mediacion: Mediacion,
  target: EstadoMediacion,
): void {
  if (caller.rol === rolMediador && caller.id === mediacion.mediador_id) {
    const mediadorAllowed =
      mediacion.estado === estadoMediacionSolicitada &&
      (target === estadoMediacionAceptada ||
        target === estadoMediacionRechazada);
    if (!mediadorAllowed) {
      throw transitionNotAllowed();
    }
    return;
  }
  if (caller.rol === rolAdmin) {
    const adminAllowed =
      (mediacion.estado === estadoMediacionAceptada &&
        target === estadoMediacionActiva) ||
      (mediacion.estado === estadoMediacionActiva &&
        target === estadoMediacionFinalizada);
    if (!adminAllowed) {
      throw transitionNotAllowed();
    }
    return;
  }
  throw mediacionNotFound();
}

@Injectable()
export class MediacionService {
  constructor(
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(MediacionesRepository)
    private readonly mediacionesRepository: MediacionesRepository,
    @Inject(UsersRepository)
    private readonly usersRepository: UsersRepository,
  ) {}

  async requestMediacion(
    casoId: string,
    callerId: string,
    mediadorId: string,
  ): Promise<MediacionView> {
    const membership = await this.membershipService.assertMembership(
      casoId,
      callerId,
    );
    if (membership.rol_en_caso === rolEnCasoMediador) {
      throw casoNotFound();
    }
    assertValidMediadorId(mediadorId);
    if (mediadorId === callerId) {
      throw selfAssignedMediador();
    }
    const rondaActual =
      await this.mediacionesRepository.currentRondaActual(casoId);
    if (rondaActual === undefined) {
      throw casoNotFound();
    }
    if (rondaActual < rn05MediadorDesdeRonda) {
      throw rondaBelowThreshold();
    }
    const mediadorUser = await this.usersRepository.findAuthById(mediadorId);
    if (!mediadorUser || mediadorUser.rol !== rolMediador) {
      throw invalidMediadorId();
    }
    const mediadorAlreadyParty =
      await this.mediacionesRepository.existsCasoParte(casoId, mediadorId);
    if (mediadorAlreadyParty) {
      throw mediadorIsParty();
    }
    const mediacionActiva =
      await this.mediacionesRepository.findActivaByCasoId(casoId);
    if (mediacionActiva) {
      throw mediacionAlreadyActive();
    }
    return this.mediacionesRepository.insertSolicitud(
      casoId,
      mediadorId,
      rondaActual,
    );
  }

  /**
   * The caso's mediacion as a party sees it, or null when none was ever
   * requested — which is a legitimate state, not an error, and is why this
   * answers null instead of 404.
   *
   * Membership is asserted first, so a stranger gets the same caso_not_found a
   * nonexistent caso would: whether a caso has a mediacion is itself private.
   */
  async getForCaso(
    casoId: string,
    callerId: string,
  ): Promise<MediacionView | null> {
    await this.membershipService.assertMembership(casoId, callerId);
    const mediacion = await this.mediacionesRepository.findByCasoId(casoId);
    return mediacion ?? null;
  }

  /**
   * Mediadores a party may request. Requires membership in the caso the request
   * is for, so the roster is not a public directory of every mediador in the
   * system — and it never includes a mediador who is already a party to that
   * caso, which `requestMediacion` would reject anyway.
   */
  async listMediadoresForCaso(
    casoId: string,
    callerId: string,
  ): Promise<MediadorOption[]> {
    await this.membershipService.assertMembership(casoId, callerId);
    const mediadores = await this.mediacionesRepository.listMediadores();
    const eligibility = await Promise.all(
      mediadores.map(async (mediador) => ({
        mediador,
        isParty: await this.mediacionesRepository.existsCasoParte(
          casoId,
          mediador.id,
        ),
      })),
    );
    return eligibility
      .filter(({ mediador, isParty }) => !isParty && mediador.id !== callerId)
      .map(({ mediador }) => mediador);
  }

  async updateEstado(
    mediacionId: string,
    caller: AuthenticatedUser,
    targetEstado: EstadoMediacion,
  ): Promise<MediacionView> {
    assertValidEstado(targetEstado);
    const mediacion = await this.mediacionesRepository.findById(mediacionId);
    if (!mediacion) {
      throw mediacionNotFound();
    }
    resolveTransitionAuthority(caller, mediacion, targetEstado);
    return this.mediacionesRepository.transitionEstado(
      mediacionId,
      mediacion.caso_id,
      mediacion.mediador_id,
      mediacion.estado,
      targetEstado,
      resolveGrantMembership(targetEstado),
    );
  }
}
