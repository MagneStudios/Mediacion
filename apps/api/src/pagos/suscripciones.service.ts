import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { UsersRepository } from "../auth/users.repository";
import { normalizeTimestamp } from "../common/db/timestamp";
import { ConflictError } from "../common/errors/domain-errors";
import type { EmailProvider } from "../notificaciones/notificaciones.types";
import { EMAIL_PROVIDER } from "../notificaciones/providers/notificaciones.tokens";
import type { MercadoPagoClient } from "./mercadopago/mercado-pago-client";
import { MERCADO_PAGO_CLIENT } from "./mercadopago/mercado-pago-client";
import type {
  CreateSuscripcionDto,
  CreateSuscripcionInput,
  SuscripcionCancelada,
  SuscripcionCreated,
  SuscripcionOwnership,
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

function suscripcionNotFound(): HttpException {
  return new HttpException(
    { code: "suscripcion_not_found", message: "Suscripcion not found" },
    HttpStatus.NOT_FOUND,
  );
}

function forbidEstudio(message: string): never {
  throw new HttpException(
    { code: "forbidden_estudio", message },
    HttpStatus.FORBIDDEN,
  );
}

@Injectable()
export class SuscripcionesService {
  private readonly logger = new Logger(SuscripcionesService.name);

  constructor(
    @Inject(SuscripcionesRepository)
    private readonly suscripcionesRepository: SuscripcionesRepository,
    @Inject(UsersRepository)
    private readonly usersRepository: UsersRepository,
    @Inject(MERCADO_PAGO_CLIENT)
    private readonly mercadoPagoClient: MercadoPagoClient,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
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

  async cancelSuscripcion(
    caller: AuthenticatedUser,
    suscripcionId: string,
  ): Promise<SuscripcionCancelada> {
    const suscripcion =
      await this.suscripcionesRepository.findOwnershipById(suscripcionId);
    if (!suscripcion) {
      throw suscripcionNotFound();
    }
    await this.assertOwnership(caller.id, suscripcion);
    const cancelled = await this.suscripcionesRepository.cancelActiva(
      suscripcionId,
      new Date().toISOString(),
    );
    if (!cancelled) {
      throw new ConflictError(
        `suscripcion ${suscripcionId} is not activa, current estado ${suscripcion.estado}`,
      );
    }
    try {
      await this.mercadoPagoClient.cancelSubscription(suscripcionId);
    } catch (error) {
      await this.suscripcionesRepository.restoreActiva(suscripcionId);
      throw error;
    }
    await this.confirmCancellation(caller, suscripcionId);
    return {
      id: cancelled.id,
      estado: cancelled.estado,
      fecha_fin: normalizeTimestamp(cancelled.fecha_fin),
    };
  }

  private async assertOwnership(
    callerId: string,
    suscripcion: SuscripcionOwnership,
  ): Promise<void> {
    if (suscripcion.usuario_id === callerId) {
      return;
    }
    if (suscripcion.estudio_id === null) {
      throw suscripcionNotFound();
    }
    const profile = await this.usersRepository.findProfileById(callerId);
    if (profile?.estudio_id !== suscripcion.estudio_id) {
      throw suscripcionNotFound();
    }
  }

  private async confirmCancellation(
    caller: AuthenticatedUser,
    suscripcionId: string,
  ): Promise<void> {
    try {
      await this.emailProvider.send({
        to: caller.email,
        evento: `Baja de suscripción ${suscripcionId} confirmada`,
      });
    } catch (error) {
      this.logger.error(
        `suscripciones.cancel confirmation email failed for ${suscripcionId}`,
        error,
      );
    }
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
