import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../../config/config";
import { APP_CONFIG } from "../../config/config.tokens";
import type {
  CreatePreferenceInput,
  CreatePreferenceOutput,
  GatewayCancellation,
  MercadoPagoClient,
  MercadoPagoPayment,
} from "./mercado-pago-client";

const mercadoPagoRequestTimeoutMs = 30_000;
const mercadoPagoBaseUrl = "https://api.mercadopago.com";
const singleItemQuantity = 1;
const cancelledPreapprovalStatus = "cancelled";

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
};

type MercadoPagoPreapprovalSearch = {
  results?: { id?: string; status?: string }[];
};

type MercadoPagoPaymentResponse = {
  id?: number | string;
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number;
};

@Injectable()
export class HttpMercadoPagoClient implements MercadoPagoClient {
  constructor(@Inject(APP_CONFIG) private readonly appConfig: AppConfig) {}

  async createPreference(
    input: CreatePreferenceInput,
  ): Promise<CreatePreferenceOutput> {
    const response = await fetch(`${mercadoPagoBaseUrl}/checkout/preferences`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({
        external_reference: input.suscripcionId,
        items: [
          {
            title: input.planNombre,
            quantity: singleItemQuantity,
            unit_price: input.precio,
            currency_id: input.moneda,
          },
        ],
      }),
      signal: AbortSignal.timeout(mercadoPagoRequestTimeoutMs),
    });
    if (!response.ok) {
      throw new Error(
        `Mercado Pago preference creation failed with status ${response.status}`,
      );
    }
    const body = (await response.json()) as MercadoPagoPreferenceResponse;
    if (typeof body.init_point !== "string" || body.init_point.length === 0) {
      throw new Error("Mercado Pago response did not include an init_point");
    }
    return { id: body.id ?? "", initPoint: body.init_point };
  }

  async getPayment(paymentId: string): Promise<MercadoPagoPayment> {
    const response = await fetch(
      `${mercadoPagoBaseUrl}/v1/payments/${paymentId}`,
      {
        method: "GET",
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(mercadoPagoRequestTimeoutMs),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Mercado Pago payment lookup failed with status ${response.status}`,
      );
    }
    const body = (await response.json()) as MercadoPagoPaymentResponse;
    return {
      id: String(body.id ?? paymentId),
      status: body.status ?? "",
      externalReference: body.external_reference ?? null,
      transactionAmount: body.transaction_amount ?? 0,
    };
  }

  async cancelSubscription(
    suscripcionId: string,
  ): Promise<GatewayCancellation> {
    const preapprovalId = await this.findPreapprovalId(suscripcionId);
    if (!preapprovalId) {
      return { cancelled: false };
    }
    const response = await fetch(
      `${mercadoPagoBaseUrl}/preapproval/${preapprovalId}`,
      {
        method: "PUT",
        headers: this.authHeaders(),
        body: JSON.stringify({ status: cancelledPreapprovalStatus }),
        signal: AbortSignal.timeout(mercadoPagoRequestTimeoutMs),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Mercado Pago subscription cancellation failed with status ${response.status}`,
      );
    }
    return { cancelled: true };
  }

  private async findPreapprovalId(
    suscripcionId: string,
  ): Promise<string | undefined> {
    const response = await fetch(
      `${mercadoPagoBaseUrl}/preapproval/search?external_reference=${encodeURIComponent(suscripcionId)}`,
      {
        method: "GET",
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(mercadoPagoRequestTimeoutMs),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Mercado Pago preapproval search failed with status ${response.status}`,
      );
    }
    const body = (await response.json()) as MercadoPagoPreapprovalSearch;
    const active = body.results?.find(
      (result) => result.status !== cancelledPreapprovalStatus,
    );
    return typeof active?.id === "string" ? active.id : undefined;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.appConfig.mpAccessToken}`,
      "Content-Type": "application/json",
    };
  }
}
