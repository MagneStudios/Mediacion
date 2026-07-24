import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { MembershipService } from "../casos/membership.service";
import { NotificacionesService } from "../notificaciones/notificaciones.service";
import { InvitacionesRepository } from "./invitaciones.repository";
import type {
  CreateInvitacionDto,
  InvitacionCreated,
  JoinedCaso,
  TipoInvitacion,
} from "./invitaciones.types";
import { generateToken } from "./token";

const validTipos: TipoInvitacion[] = ["link", "codigo", "email"];
const tipoInvitacionEmail = "email" as const;
const canalEmail = "email" as const;
const eventoInvitacionEnviada = "invitacion_enviada";

function assertValidTipo(tipo: TipoInvitacion): void {
  if (!validTipos.includes(tipo)) {
    throw new HttpException(
      {
        code: "invalid_input",
        message: `tipo must be one of ${validTipos.join(", ")}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function assertValidEmailDestino(dto: CreateInvitacionDto): void {
  if (
    dto.tipo === tipoInvitacionEmail &&
    (!dto.email_destino || dto.email_destino.trim().length === 0)
  ) {
    throw new HttpException(
      {
        code: "invalid_input",
        message: "email_destino is required for tipo=email",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

@Injectable()
export class InvitacionesService {
  private readonly logger = new Logger(InvitacionesService.name);

  constructor(
    @Inject(InvitacionesRepository)
    private readonly invitacionesRepository: InvitacionesRepository,
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(NotificacionesService)
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async createInvitation(
    casoId: string,
    callerId: string,
    dto: CreateInvitacionDto,
  ): Promise<InvitacionCreated> {
    assertValidTipo(dto.tipo);
    assertValidEmailDestino(dto);
    const parte = await this.membershipService.assertMembership(
      casoId,
      callerId,
    );
    if (parte.rol_en_caso !== "parte_a") {
      throw new HttpException(
        { code: "forbidden", message: "Only the case creator can invite" },
        HttpStatus.FORBIDDEN,
      );
    }
    const token = generateToken();
    const invitation = await this.invitacionesRepository.createInvite(
      casoId,
      dto.tipo,
      token,
      dto.email_destino ?? null,
    );
    try {
      await this.notifyInvitedUsuario(casoId, dto.email_destino);
    } catch (error) {
      this.logger.error(
        `invitacion notification failed after invite persisted for caso ${casoId}`,
        error,
      );
    }
    return invitation;
  }

  private async notifyInvitedUsuario(
    casoId: string,
    emailDestino: string | undefined,
  ): Promise<void> {
    if (!emailDestino) {
      return;
    }
    const usuarioId =
      await this.invitacionesRepository.findUsuarioIdByEmail(emailDestino);
    if (!usuarioId) {
      return;
    }
    this.notificacionesService.emit({
      usuarioId,
      casoId,
      canal: canalEmail,
      evento: eventoInvitacionEnviada,
    });
  }

  joinCase(
    token: string,
    callerId: string,
    callerEmail: string,
  ): Promise<JoinedCaso> {
    return this.invitacionesRepository.joinCase(token, callerId, callerEmail);
  }
}
