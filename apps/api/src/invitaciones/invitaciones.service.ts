import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { MembershipService } from "../casos/membership.service";
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
  constructor(
    @Inject(InvitacionesRepository)
    private readonly invitacionesRepository: InvitacionesRepository,
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
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
    return this.invitacionesRepository.createInvite(
      casoId,
      dto.tipo,
      token,
      dto.email_destino ?? null,
    );
  }

  joinCase(
    token: string,
    callerId: string,
    callerEmail: string,
  ): Promise<JoinedCaso> {
    return this.invitacionesRepository.joinCase(token, callerId, callerEmail);
  }
}
