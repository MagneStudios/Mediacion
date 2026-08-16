import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { normalizeTimestamp } from "../common/db/timestamp";
import type { AppConfig } from "../config/config";
import { APP_CONFIG } from "../config/config.tokens";
import type { EmailProvider } from "../notificaciones/notificaciones.types";
import { EMAIL_PROVIDER } from "../notificaciones/providers/notificaciones.tokens";
import {
  buildAcceptancesCsv,
  buildAcceptancesFilename,
} from "./acceptance-csv";
import { assertValidAcceptanceBody } from "./acceptance-payload";
import { LegalRepository } from "./legal.repository";
import type {
  AcceptanceExportFilters,
  AceptacionRequestMetadata,
  AceptacionStatus,
  AcuerdoTipo,
  DocumentoTipo,
  LegalDocumentRow,
  LegalDocumentView,
  SolicitudReceipt,
} from "./legal.types";
import { documentoTipos } from "./legal.types";
import {
  assertValidArrepentimiento,
  assertValidContacto,
} from "./solicitud-payload";

export type AcceptanceExport = { filename: string; csv: string };

function invalidInput(message: string): HttpException {
  return new HttpException(
    { code: "invalid_input", message },
    HttpStatus.BAD_REQUEST,
  );
}

function legalDocumentNotFound(): HttpException {
  return new HttpException(
    { code: "legal_document_not_found", message: "Legal document not found" },
    HttpStatus.NOT_FOUND,
  );
}

function assertValidTipo(tipo: string): DocumentoTipo {
  const known = documentoTipos.find((candidate) => candidate === tipo);
  if (!known) {
    throw invalidInput(`tipo must be one of ${documentoTipos.join(", ")}`);
  }
  return known;
}

function assertValidRange(filters: AcceptanceExportFilters): void {
  if (!filters.desde || !filters.hasta) {
    return;
  }
  if (filters.desde > filters.hasta) {
    throw invalidInput("desde must not be after hasta");
  }
}

function toView(row: LegalDocumentRow): LegalDocumentView {
  return {
    tipo: row.tipo,
    version: row.version,
    contenido: row.contenido,
    valid_from: normalizeTimestamp(row.valid_from),
    valid_to: normalizeTimestamp(row.valid_to),
    is_substantial: row.is_substantial,
    resumen_cambios: row.resumen_cambios,
  };
}

@Injectable()
export class LegalService {
  private readonly logger = new Logger(LegalService.name);

  constructor(
    @Inject(LegalRepository) private readonly legalRepository: LegalRepository,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  async getDocumentoVigente(tipo: string): Promise<LegalDocumentView> {
    const documento = await this.legalRepository.findVigente(
      assertValidTipo(tipo),
      new Date().toISOString(),
    );
    if (!documento) {
      throw legalDocumentNotFound();
    }
    return toView(documento);
  }

  async registerAcceptance(
    callerId: string,
    body: unknown,
    metadata: AceptacionRequestMetadata,
  ): Promise<void> {
    const { marketing } = assertValidAcceptanceBody(body);
    const vigentes = await this.legalRepository.findVigentes(
      new Date().toISOString(),
    );
    const buildRow = (
      documentType: AcuerdoTipo,
      documentVersion: string,
      accepted: boolean,
    ) => ({
      user_id: callerId,
      document_type: documentType,
      document_version: documentVersion,
      ip: metadata.ip,
      user_agent: metadata.userAgent,
      accepted,
    });
    const versiones = documentoTipos.map((tipo) => {
      const documento = vigentes.find((candidate) => candidate.tipo === tipo);
      if (!documento) {
        throw legalDocumentNotFound();
      }
      return { tipo, version: documento.version };
    });
    const rows = versiones.map(({ tipo, version }) =>
      buildRow(tipo, version, true),
    );
    if (marketing !== undefined) {
      const [terms] = versiones;
      rows.push(buildRow("marketing", terms.version, marketing));
    }
    await this.legalRepository.insertAcceptances(rows);
  }

  async getAcceptanceStatus(callerId: string): Promise<AceptacionStatus> {
    const vigentes = await this.legalRepository.findVigentes(
      new Date().toISOString(),
    );
    const pendientes: DocumentoTipo[] = [];
    let requiereReaceptacion = false;
    for (const tipo of documentoTipos) {
      const documento = vigentes.find((candidate) => candidate.tipo === tipo);
      if (!documento) {
        continue;
      }
      const accepted = await this.legalRepository.hasAcceptedCurrent(
        callerId,
        tipo,
      );
      if (accepted) {
        continue;
      }
      pendientes.push(tipo);
      requiereReaceptacion = requiereReaceptacion || documento.is_substantial;
    }
    return { pendientes, requiere_reaceptacion: requiereReaceptacion };
  }

  async exportAcceptances(
    filters: AcceptanceExportFilters,
  ): Promise<AcceptanceExport> {
    assertValidRange(filters);
    const rows = await this.legalRepository.listAcceptances(filters);
    return {
      filename: buildAcceptancesFilename(filters.desde, filters.hasta),
      csv: buildAcceptancesCsv(rows),
    };
  }

  async registerArrepentimiento(
    body: unknown,
    usuarioId: string | null,
  ): Promise<SolicitudReceipt> {
    const input = assertValidArrepentimiento(body);
    const created = await this.legalRepository.insertArrepentimiento(
      input,
      usuarioId,
    );
    if (!created) {
      throw new HttpException(
        { code: "internal_error", message: "Internal error" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const receipt = {
      id: created.codigo ?? "",
      received_at: normalizeTimestamp(created.received_at),
    };
    await this.notifyOperaciones(
      `Solicitud de arrepentimiento ${receipt.id} de ${input.email}: ${input.detalle}`,
    );
    return receipt;
  }

  async registerContacto(
    body: unknown,
    usuarioId: string | null,
  ): Promise<SolicitudReceipt> {
    const input = assertValidContacto(body);
    const created = await this.legalRepository.insertContacto(input, usuarioId);
    if (!created) {
      throw new HttpException(
        { code: "internal_error", message: "Internal error" },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const receipt = {
      id: created.codigo ?? "",
      received_at: normalizeTimestamp(created.received_at),
    };
    await this.notifyOperaciones(
      `Consulta de contacto ${receipt.id} de ${input.email}: ${input.mensaje}`,
    );
    return receipt;
  }

  private async notifyOperaciones(evento: string): Promise<void> {
    const to = this.appConfig.operacionesEmail;
    if (!to) {
      this.logger.error(
        `legal.notifyOperaciones skipped, OPERACIONES_EMAIL is not configured: ${evento}`,
      );
      return;
    }
    try {
      await this.emailProvider.send({ to, evento });
    } catch (error) {
      this.logger.error(`legal.notifyOperaciones failed: ${evento}`, error);
    }
  }
}
