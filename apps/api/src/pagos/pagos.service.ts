import type { Json } from "@mediacion/db-types";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { UsersRepository } from "../auth/users.repository";
import type {
  MercadoPagoClient,
  MercadoPagoPayment,
} from "./mercadopago/mercado-pago-client";
import { MERCADO_PAGO_CLIENT } from "./mercadopago/mercado-pago-client";
import { PagosRepository } from "./pagos.repository";
import {
  type EstadoPago,
  estadoSuscripcionActiva,
  type PreferenceResult,
  type SuscripcionOwnerFilter,
} from "./pagos.types";

const approvedStatus = "approved";
const rejectedStatus = "rejected";

/**
 * `planes.precio` es NUMERIC, y el driver lo entrega como string: "0.00".
 * Compararlo contra "0" o apoyarse en falsy da falso negativo, así que se
 * parsea. Un precio ilegible se trata como pago, que es el lado seguro: peor
 * que mandar a Mercado Pago un plan gratis es saltear el cobro de uno que no
 * lo es.
 */
function isFreePlan(precio: string | number): boolean {
  const parsed = typeof precio === "number" ? precio : Number(precio);
  return Number.isFinite(parsed) && parsed === 0;
}

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
    /**
     * Un plan de precio 0 no pasa por Mercado Pago: rechaza con 400 toda
     * preferencia de monto cero, y como la única vía a `activa` es el webhook
     * de un pago aprobado, el plan gratuito quedaba inalcanzable — la
     * suscripción nacía en `pendiente_pago` y ahí se quedaba, con
     * `consume_quota` negando cada alta de caso.
     *
     * Se compara sobre el precio parseado y no sobre el texto de la columna
     * porque `planes.precio` es NUMERIC y llega como string: "0.00" no es
     * igual a "0", y ninguno de los dos es falsy.
     */
    if (isFreePlan(suscripcion.plan_precio)) {
      await this.pagosRepository.activateFreeSuscripcion(suscripcion.id);
      return { init_point: null, estado: estadoSuscripcionActiva };
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
