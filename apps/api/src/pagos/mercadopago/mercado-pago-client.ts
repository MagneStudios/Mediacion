export type CreatePreferenceInput = {
  suscripcionId: string;
  planNombre: string;
  precio: number;
};

export type CreatePreferenceOutput = {
  id: string;
  initPoint: string;
};

export type MercadoPagoPayment = {
  id: string;
  status: string;
  externalReference: string | null;
  transactionAmount: number;
};

export interface MercadoPagoClient {
  createPreference(
    input: CreatePreferenceInput,
  ): Promise<CreatePreferenceOutput>;
  getPayment(paymentId: string): Promise<MercadoPagoPayment>;
  cancelSubscription(suscripcionId: string): Promise<void>;
}

export const MERCADO_PAGO_CLIENT = Symbol("MERCADO_PAGO_CLIENT");
