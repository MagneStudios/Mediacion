import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { Public } from "../auth/public.decorator";
import { Roles } from "../auth/roles.decorator";
import type { TokenVerifier } from "../auth/token-verifier";
import { TOKEN_VERIFIER } from "../auth/token-verifier";
import { resolveRequestMetadata } from "./client-metadata";
import { LegalService } from "./legal.service";
import type {
  AcceptanceExportFilters,
  AceptacionStatus,
  LegalDocumentView,
  SolicitudReceipt,
} from "./legal.types";
import { resolveOptionalCallerId } from "./optional-caller";
import { PublicRateLimiter } from "./rate-limiter";

type CsvResponse = {
  setHeader(name: string, value: string): void;
  send(body: string): void;
};

@Controller("legal")
export class LegalController {
  constructor(
    @Inject(LegalService) private readonly legalService: LegalService,
    @Inject(PublicRateLimiter)
    private readonly publicRateLimiter: PublicRateLimiter,
    @Inject(TOKEN_VERIFIER) private readonly tokenVerifier: TokenVerifier,
  ) {}

  @Public()
  @Get("documentos/:tipo")
  getDocumento(@Param("tipo") tipo: string): Promise<LegalDocumentView> {
    return this.legalService.getDocumentoVigente(tipo);
  }

  @Post("aceptaciones")
  @HttpCode(HttpStatus.NO_CONTENT)
  registerAcceptance(
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: unknown,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
    @Ip() ip: string,
  ): Promise<void> {
    return this.legalService.registerAcceptance(
      caller.id,
      body,
      resolveRequestMetadata(forwardedFor, ip, userAgent),
    );
  }

  @Get("aceptaciones/vigente")
  getAcceptanceStatus(
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<AceptacionStatus> {
    return this.legalService.getAcceptanceStatus(caller.id);
  }

  @Get("aceptaciones/export")
  @Roles("admin")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async exportAcceptances(
    @Query() filters: AcceptanceExportFilters,
    @Res({ passthrough: true }) response: CsvResponse,
  ): Promise<string> {
    const exported = await this.legalService.exportAcceptances(filters);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${exported.filename}"`,
    );
    return exported.csv;
  }

  @Public()
  @Post("arrepentimiento")
  async registerArrepentimiento(
    @Body() body: unknown,
    @Headers("authorization") authorization: string | undefined,
    @Ip() ip: string,
  ): Promise<SolicitudReceipt> {
    this.publicRateLimiter.assertWithinLimit(ip);
    return this.legalService.registerArrepentimiento(
      body,
      await resolveOptionalCallerId(this.tokenVerifier, authorization),
    );
  }

  @Public()
  @Post("contacto")
  async registerContacto(
    @Body() body: unknown,
    @Headers("authorization") authorization: string | undefined,
    @Ip() ip: string,
  ): Promise<SolicitudReceipt> {
    this.publicRateLimiter.assertWithinLimit(ip);
    return this.legalService.registerContacto(
      body,
      await resolveOptionalCallerId(this.tokenVerifier, authorization),
    );
  }
}
