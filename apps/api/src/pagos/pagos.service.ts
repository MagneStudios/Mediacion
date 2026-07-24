import type { Json } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type {
  MercadoPagoClient,
  MercadoPagoPayment,
} from "./mercadopago/mercado-pago-client";
import { MERCADO_PAGO_CLIENT } from "./mercadopago/mercado-pago-client";
import { PagosRepository } from "./pagos.repository";
import type { EstadoPago, PreferenceResult } from "./pagos.types";

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
  ) {}

  async createPreference(suscripcionId: string): Promise<PreferenceResult> {
    const suscripcion =
      await this.pagosRepository.findSuscripcionForPreference(suscripcionId);
    if (!suscripcion) {
      throw suscripcionNotFound();
    }
    const preference = await this.mercadoPagoClient.createPreference({
      suscripcionId: suscripcion.id,
      planNombre: suscripcion.plan_nombre,
      precio: suscripcion.plan_precio,
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
}

function toRawWebhook(payment: MercadoPagoPayment): Json {
  return {
    id: payment.id,
    status: payment.status,
    externalReference: payment.externalReference,
    transactionAmount: payment.transactionAmount,
  };
}
