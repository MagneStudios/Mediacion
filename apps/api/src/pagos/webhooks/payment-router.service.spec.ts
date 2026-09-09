import type { LawyerPaymentHandler } from "../../abogado/lawyer-payment.port";
import type { MercadoPagoClient } from "../mercadopago/mercado-pago-client";
import type { PagosService } from "../pagos.service";
import { PaymentRouterService } from "./payment-router.service";

function buildRouter(payment: {
  id: string;
  status: string;
  externalReference: string | null;
}) {
  const getPayment = jest.fn().mockResolvedValue({
    ...payment,
    transactionAmount: 50000,
  });
  const processWebhookPayment = jest.fn().mockResolvedValue(undefined);
  const settlePayment = jest.fn().mockResolvedValue(undefined);
  return {
    router: new PaymentRouterService(
      { getPayment } as unknown as MercadoPagoClient,
      { processWebhookPayment } as unknown as PagosService,
      { settlePayment } as unknown as LawyerPaymentHandler,
    ),
    getPayment,
    processWebhookPayment,
    settlePayment,
  };
}

describe("PaymentRouterService", () => {
  it("settles a lawyer request and never touches the subscription path", async () => {
    const { router, processWebhookPayment, settlePayment } = buildRouter({
      id: "mp-1",
      status: "approved",
      externalReference: "lawreq_solicitud-1",
    });

    await router.processWebhookPayment("mp-1");

    expect(settlePayment).toHaveBeenCalledWith({
      externalReference: "lawreq_solicitud-1",
      mpPaymentId: "mp-1",
      approved: true,
    });
    expect(processWebhookPayment).not.toHaveBeenCalled();
  });

  it("marks a rejected lawyer payment as not approved instead of dropping it", async () => {
    const { router, settlePayment } = buildRouter({
      id: "mp-2",
      status: "rejected",
      externalReference: "lawreq_solicitud-2",
    });

    await router.processWebhookPayment("mp-2");

    expect(settlePayment).toHaveBeenCalledWith(
      expect.objectContaining({ approved: false }),
    );
  });

  /**
   * The regression this router exists for: a `lawreq_` reference reaching the
   * subscription path is written as `pagos.suscripcion_id` and dies on the uuid
   * cast, which makes Mercado Pago redeliver the event forever.
   */
  it("routes a bare suscripcion reference to the subscription path untouched", async () => {
    const { router, processWebhookPayment, settlePayment } = buildRouter({
      id: "mp-3",
      status: "approved",
      externalReference: "6f1e7a2c-0000-4000-8000-000000000000",
    });

    await router.processWebhookPayment("mp-3");

    expect(processWebhookPayment).toHaveBeenCalledWith("mp-3");
    expect(settlePayment).not.toHaveBeenCalled();
  });

  it("leaves a payment with no external reference to the subscription path, which ignores it", async () => {
    const { router, processWebhookPayment, settlePayment } = buildRouter({
      id: "mp-4",
      status: "approved",
      externalReference: null,
    });

    await router.processWebhookPayment("mp-4");

    expect(processWebhookPayment).toHaveBeenCalledWith("mp-4");
    expect(settlePayment).not.toHaveBeenCalled();
  });
});
