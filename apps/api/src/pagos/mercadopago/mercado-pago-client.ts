export type CreatePreferenceInput = {
  suscripcionId: string;
  planNombre: string;
  precio: number;
  moneda: string;
};

export type CreatePreferenceOutput = {
  id: string;
  initPoint: string;
};

/**
 * A one-off charge, not a subscription: the caller owns the external reference
 * because the row it points at is not a suscripcion. Kept apart from
 * CreatePreferenceInput so the subscription preference can become a preapproval
 * without dragging every one-off charge with it.
 */
export type CreateOneOffPreferenceInput = {
  externalReference: string;
  title: string;
  precio: number;
  moneda: string;
};

export type MercadoPagoPayment = {
  id: string;
  status: string;
  externalReference: string | null;
  transactionAmount: number;
};

export type GatewayCancellation = {
  cancelled: boolean;
};

export interface MercadoPagoClient {
  createPreference(
    input: CreatePreferenceInput,
  ): Promise<CreatePreferenceOutput>;
  createOneOffPreference(
    input: CreateOneOffPreferenceInput,
  ): Promise<CreatePreferenceOutput>;
  getPayment(paymentId: string): Promise<MercadoPagoPayment>;
  cancelSubscription(suscripcionId: string): Promise<GatewayCancellation>;
}

export const MERCADO_PAGO_CLIENT = Symbol("MERCADO_PAGO_CLIENT");
