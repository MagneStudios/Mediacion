import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { MembershipService } from "../casos/membership.service";
import type { AppConfig } from "../config/config";
import { APP_CONFIG } from "../config/config.tokens";
import type { MercadoPagoClient } from "../pagos/mercadopago/mercado-pago-client";
import { MERCADO_PAGO_CLIENT } from "../pagos/mercadopago/mercado-pago-client";
import { AbogadoRepository } from "./abogado.repository";
import type {
  SolicitudAbogadoCheckout,
  SolicitudAbogadoView,
} from "./abogado.types";
import { monedaSolicitudArs } from "./abogado.types";
import type {
  LawyerPaymentHandler,
  LawyerPaymentSettlement,
} from "./lawyer-payment.port";

const solicitudTitle = "Pactum — Asistencia legal profesional";
const minorUnitsPerUnit = 100;

function solicitudNotFound(): HttpException {
  return new HttpException(
    {
      code: "solicitud_abogado_not_found",
      message: "No lawyer request for this case",
    },
    HttpStatus.NOT_FOUND,
  );
}

/**
 * Mercado Pago prices a preference in major units; the row stores minor units,
 * because that is the only representation a price may be stored or compared in
 * (spec §7.3). The conversion happens here, at the gateway boundary, and
 * nowhere else.
 */
function toMajorUnits(montoMinor: number): number {
  return montoMinor / minorUnitsPerUnit;
}

@Injectable()
export class AbogadoService implements LawyerPaymentHandler {
  private readonly logger = new Logger(AbogadoService.name);

  constructor(
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
    @Inject(AbogadoRepository)
    private readonly abogadoRepository: AbogadoRepository,
    @Inject(MERCADO_PAGO_CLIENT)
    private readonly mercadoPagoClient: MercadoPagoClient,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  /**
   * Opens (or reuses) the caso's lawyer request and returns the checkout for it.
   *
   * The price is read from config and frozen on the row at creation: a user who
   * pays two hours later pays what they were shown, and the webhook never
   * re-quotes.
   */
  async requestForCaso(
    casoId: string,
    callerId: string,
  ): Promise<SolicitudAbogadoCheckout> {
    await this.membershipService.assertMembership(casoId, callerId);
    const solicitud = await this.abogadoRepository.createOrReusePendiente({
      casoId,
      solicitanteId: callerId,
      montoMinor: this.appConfig.lawyerFeeArsMinor,
      moneda: monedaSolicitudArs,
    });
    const preference = await this.mercadoPagoClient.createOneOffPreference({
      externalReference: solicitud.external_reference,
      title: solicitudTitle,
      precio: toMajorUnits(solicitud.monto_minor),
      moneda: solicitud.moneda,
    });
    await this.abogadoRepository.persistPreference(solicitud.id, preference.id);
    return { solicitud, init_point: preference.initPoint };
  }

  async getForCaso(
    casoId: string,
    callerId: string,
  ): Promise<SolicitudAbogadoView> {
    await this.membershipService.assertMembership(casoId, callerId);
    const solicitud = await this.abogadoRepository.findLatestByCaso(casoId);
    if (!solicitud) {
      throw solicitudNotFound();
    }
    return solicitud;
  }

  /**
   * Settles the row the gateway's external reference points at. A reference
   * with no pending row left — a redelivered webhook, or an attempt already
   * settled — is logged and dropped, never retried: answering the webhook with
   * an error would only make Mercado Pago redeliver the same settled event.
   */
  async settlePayment(input: LawyerPaymentSettlement): Promise<void> {
    const settled = await this.abogadoRepository.settleByReference({
      externalReference: input.externalReference,
      mpPaymentId: input.mpPaymentId,
      approved: input.approved,
      paidAt: new Date().toISOString(),
    });
    if (!settled) {
      this.logger.log(
        `lawyer request ${input.externalReference} had no pending row to settle`,
      );
    }
  }
}
