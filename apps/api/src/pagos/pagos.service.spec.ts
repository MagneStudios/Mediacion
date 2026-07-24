import { HttpException } from "@nestjs/common";
import type { MercadoPagoClient } from "./mercadopago/mercado-pago-client";
import type { PagosRepository } from "./pagos.repository";
import { PagosService } from "./pagos.service";

describe("PagosService", () => {
  function buildService(overrides?: {
    findSuscripcionForPreference?: jest.Mock;
    applyPayment?: jest.Mock;
    createPreference?: jest.Mock;
    getPayment?: jest.Mock;
  }) {
    const pagosRepository = {
      findSuscripcionForPreference:
        overrides?.findSuscripcionForPreference ?? jest.fn(),
      applyPayment: overrides?.applyPayment ?? jest.fn(),
    } as unknown as PagosRepository;
    const mercadoPagoClient = {
      createPreference: overrides?.createPreference ?? jest.fn(),
      getPayment: overrides?.getPayment ?? jest.fn(),
    } as unknown as MercadoPagoClient;
    return {
      service: new PagosService(pagosRepository, mercadoPagoClient),
      pagosRepository,
      mercadoPagoClient,
    };
  }

  describe("createPreference", () => {
    it("creates a Mercado Pago preference from the suscripcion's plan price and returns only init_point", async () => {
      const findSuscripcionForPreference = jest.fn().mockResolvedValue({
        id: "sus-1",
        plan_nombre: "plus",
        plan_precio: 19.99,
      });
      const createPreference = jest.fn().mockResolvedValue({
        id: "pref-1",
        initPoint: "https://mp.example.com/checkout/pref-1",
      });
      const { service, pagosRepository } = buildService({
        findSuscripcionForPreference,
        createPreference,
      });

      const result = await service.createPreference("sus-1");

      expect(createPreference).toHaveBeenCalledWith({
        suscripcionId: "sus-1",
        planNombre: "plus",
        precio: 19.99,
      });
      expect(result).toEqual({
        init_point: "https://mp.example.com/checkout/pref-1",
      });
      expect(pagosRepository.applyPayment).not.toHaveBeenCalled();
    });

    it("rejects with 404 when the suscripcion does not exist, without calling Mercado Pago", async () => {
      const findSuscripcionForPreference = jest
        .fn()
        .mockResolvedValue(undefined);
      const createPreference = jest.fn();
      const { service } = buildService({
        findSuscripcionForPreference,
        createPreference,
      });

      let thrown: unknown;
      try {
        await service.createPreference("missing");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(404);
      expect(createPreference).not.toHaveBeenCalled();
    });
  });

  describe("processWebhookPayment", () => {
    it("refetches the payment from Mercado Pago before applying any state change", async () => {
      const callOrder: string[] = [];
      const getPayment = jest.fn().mockImplementation(async () => {
        callOrder.push("getPayment");
        return {
          id: "mp-1",
          status: "approved",
          externalReference: "sus-1",
          transactionAmount: 19.99,
        };
      });
      const applyPayment = jest.fn().mockImplementation(async () => {
        callOrder.push("applyPayment");
        return { applied: true };
      });
      const { service } = buildService({ getPayment, applyPayment });

      await service.processWebhookPayment("mp-1");

      expect(callOrder).toEqual(["getPayment", "applyPayment"]);
      expect(applyPayment).toHaveBeenCalledWith({
        suscripcionId: "sus-1",
        mpPaymentId: "mp-1",
        estadoPago: "aprobado",
        monto: 19.99,
        rawWebhook: {
          id: "mp-1",
          status: "approved",
          externalReference: "sus-1",
          transactionAmount: 19.99,
        },
      });
    });

    it("maps a rejected Mercado Pago status to rechazado", async () => {
      const getPayment = jest.fn().mockResolvedValue({
        id: "mp-2",
        status: "rejected",
        externalReference: "sus-1",
        transactionAmount: 19.99,
      });
      const applyPayment = jest.fn().mockResolvedValue({ applied: true });
      const { service } = buildService({ getPayment, applyPayment });

      await service.processWebhookPayment("mp-2");

      expect(applyPayment).toHaveBeenCalledWith(
        expect.objectContaining({ estadoPago: "rechazado" }),
      );
    });

    it("maps every other Mercado Pago status to pendiente", async () => {
      const getPayment = jest.fn().mockResolvedValue({
        id: "mp-3",
        status: "in_process",
        externalReference: "sus-1",
        transactionAmount: 19.99,
      });
      const applyPayment = jest.fn().mockResolvedValue({ applied: true });
      const { service } = buildService({ getPayment, applyPayment });

      await service.processWebhookPayment("mp-3");

      expect(applyPayment).toHaveBeenCalledWith(
        expect.objectContaining({ estadoPago: "pendiente" }),
      );
    });

    it("never mutates state using the webhook body — only the refetched payment status is used", async () => {
      const getPayment = jest.fn().mockResolvedValue({
        id: "mp-4",
        status: "approved",
        externalReference: "sus-1",
        transactionAmount: 50,
      });
      const applyPayment = jest.fn().mockResolvedValue({ applied: true });
      const { service } = buildService({ getPayment, applyPayment });

      await service.processWebhookPayment("mp-4");

      expect(getPayment).toHaveBeenCalledWith("mp-4");
      expect(applyPayment).toHaveBeenCalledWith(
        expect.objectContaining({ estadoPago: "aprobado", monto: 50 }),
      );
    });

    it("does nothing when the refetched payment has no external_reference to link a suscripcion", async () => {
      const getPayment = jest.fn().mockResolvedValue({
        id: "mp-5",
        status: "approved",
        externalReference: null,
        transactionAmount: 19.99,
      });
      const applyPayment = jest.fn();
      const { service } = buildService({ getPayment, applyPayment });

      await service.processWebhookPayment("mp-5");

      expect(applyPayment).not.toHaveBeenCalled();
    });
  });
});
