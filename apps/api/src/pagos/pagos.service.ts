import type { Json } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { UsersRepository } from "../auth/users.repository";
import type {
  MercadoPagoClient,
  MercadoPagoPayment,
} from "./mercadopago/mercado-pago-client";
import { MERCADO_PAGO_CLIENT } from "./mercadopago/mercado-pago-client";
import { PagosRepository } from "./pagos.repository";
import type {
  EstadoPago,
  PreferenceResult,
  SuscripcionOwnerFilter,
} from "./pagos.types";

const approvedStatus = "approved";
const rejectedStatus = "rejected";

function suscripcionNotFound(): HttpException {
  return new HttpException(
    { code: "suscripcion_not_found", message: "Suscripcion not found" },
    HttpStatus.NOT_FOUND,
  );
}

function mapMercadoPagoStatus(status: string): EstadoPago {
  if (status === approvedStatus) {
    return "aprobado";
  }
  if (status === rejectedStatus) {
    return "rechazado";
  }
  return "pendiente";
}

@Injectable()
export class PagosService {
  constructor(
    @Inject(PagosRepository) private readonly pagosRepository: PagosRepository,
    @Inject(MERCADO_PAGO_CLIENT)
    private readonly mercadoPagoClient: MercadoPagoClient,
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
  ) {}

  async createPreference(
    suscripcionId: string,
    callerId: string,
  ): Promise<PreferenceResult> {
    const ownerFilter = await this.resolveOwnerFilter(callerId);
    const suscripcion = await this.pagosRepository.findSuscripcionForPreference(
      suscripcionId,
      ownerFilter,
    );
    if (!suscripcion) {
      throw suscripcionNotFound();
    }
    const preference = await this.mercadoPagoClient.createPreference({
      suscripcionId: suscripcion.id,
      planNombre: suscripcion.plan_nombre,
      precio: suscripcion.plan_precio,
      moneda: suscripcion.plan_moneda,
    });
    return { init_point: preference.initPoint };
  }

  async processWebhookPayment(mpPaymentId: string): Promise<void> {
    const payment = await this.mercadoPagoClient.getPayment(mpPaymentId);
    if (!payment.externalReference) {
      return;
    }
    await this.pagosRepository.applyPayment({
      suscripcionId: payment.externalReference,
      mpPaymentId: payment.id,
      estadoPago: mapMercadoPagoStatus(payment.status),
      monto: payment.transactionAmount,
      rawWebhook: toRawWebhook(payment),
    });
  }

  private async resolveOwnerFilter(
    callerId: string,
  ): Promise<SuscripcionOwnerFilter> {
    const profile = await this.usersRepository.findProfileById(callerId);
    return { usuarioId: callerId, estudioId: profile?.estudio_id ?? null };
  }
}

function toRawWebhook(payment: MercadoPagoPayment): Json {
  return {
    id: payment.id,
    status: payment.status,
    externalReference: payment.externalReference,
    transactionAmount: payment.transactionAmount,
  };
}
