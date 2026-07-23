import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { UsersRepository } from "../auth/users.repository";
import type {
  CreateSuscripcionDto,
  CreateSuscripcionInput,
  SuscripcionCreated,
} from "./pagos.types";
import { SuscripcionesRepository } from "./suscripciones.repository";

type SuscripcionOwner = Pick<
  CreateSuscripcionInput,
  "usuario_id" | "estudio_id"
>;

function requestedEstudioId(input: CreateSuscripcionDto): string | null {
  if (typeof input.estudio_id !== "string") {
    return null;
  }
  const trimmed = input.estudio_id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function forbidEstudio(message: string): never {
  throw new HttpException(
    { code: "forbidden_estudio", message },
    HttpStatus.FORBIDDEN,
  );
}

@Injectable()
export class SuscripcionesService {
  constructor(
    @Inject(SuscripcionesRepository)
    private readonly suscripcionesRepository: SuscripcionesRepository,
    @Inject(UsersRepository)
    private readonly usersRepository: UsersRepository,
  ) {}

  async createSuscripcion(
    callerId: string,
    input: CreateSuscripcionDto,
  ): Promise<SuscripcionCreated> {
    const owner = await this.resolveOwner(callerId, input);
    const suscripcion = await this.suscripcionesRepository.createSuscripcion({
      plan_id: input.plan_id,
      usuario_id: owner.usuario_id,
      estudio_id: owner.estudio_id,
    });
    return { id: suscripcion.id, estado: suscripcion.estado };
  }

  private async resolveOwner(
    callerId: string,
    input: CreateSuscripcionDto,
  ): Promise<SuscripcionOwner> {
    const estudioId = requestedEstudioId(input);
    if (estudioId === null) {
      return { usuario_id: callerId, estudio_id: null };
    }
    const profile = await this.usersRepository.findProfileById(callerId);
    if (!profile?.estudio_id) {
      forbidEstudio("caller does not belong to an estudio");
    }
    if (profile.estudio_id !== estudioId) {
      forbidEstudio("estudio_id does not match the caller's estudio");
    }
    return { usuario_id: null, estudio_id: estudioId };
  }
}
