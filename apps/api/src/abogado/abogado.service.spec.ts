import { HttpException } from "@nestjs/common";
import type { MembershipService } from "../casos/membership.service";
import { buildTestAppConfig } from "../config/config.test-fixture";
import type { MercadoPagoClient } from "../pagos/mercadopago/mercado-pago-client";
import type { AbogadoRepository } from "./abogado.repository";
import { AbogadoService } from "./abogado.service";

const solicitudPendiente = {
  id: "solicitud-1",
  caso_id: "caso-1",
  status: "pendiente_pago" as const,
  moneda: "ARS",
  monto_minor: 5_000_000,
  external_reference: "lawreq_solicitud-1",
  paid_at: null,
  created_at: "2026-09-09T10:00:00.000Z",
};

function buildService(overrides?: {
  assertMembership?: jest.Mock;
  createOrReusePendiente?: jest.Mock;
  findLatestByCaso?: jest.Mock;
  persistPreference?: jest.Mock;
  settleByReference?: jest.Mock;
  createOneOffPreference?: jest.Mock;
  lawyerFeeArsMinor?: number;
}) {
  const membershipService = {
    assertMembership:
      overrides?.assertMembership ?? jest.fn().mockResolvedValue({}),
  } as unknown as MembershipService;
  const abogadoRepository = {
    createOrReusePendiente:
      overrides?.createOrReusePendiente ??
      jest.fn().mockResolvedValue(solicitudPendiente),
    findLatestByCaso: overrides?.findLatestByCaso ?? jest.fn(),
    persistPreference:
      overrides?.persistPreference ?? jest.fn().mockResolvedValue(undefined),
    settleByReference:
      overrides?.settleByReference ??
      jest.fn().mockResolvedValue(solicitudPendiente),
  } as unknown as AbogadoRepository;
  const mercadoPagoClient = {
    createOneOffPreference:
      overrides?.createOneOffPreference ??
      jest
        .fn()
        .mockResolvedValue({ id: "pref-1", initPoint: "https://mp/checkout" }),
  } as unknown as MercadoPagoClient;
  return {
    service: new AbogadoService(
      membershipService,
      abogadoRepository,
      mercadoPagoClient,
      buildTestAppConfig({
        lawyerFeeArsMinor: overrides?.lawyerFeeArsMinor ?? 5_000_000,
      }),
    ),
    membershipService,
    abogadoRepository,
    mercadoPagoClient,
  };
}

describe("AbogadoService.requestForCaso", () => {
  it("returns the checkout for the caller's own caso", async () => {
    const { service, membershipService } = buildService();

    const result = await service.requestForCaso("caso-1", "user-a");

    expect(membershipService.assertMembership).toHaveBeenCalledWith(
      "caso-1",
      "user-a",
    );
    expect(result.init_point).toBe("https://mp/checkout");
    expect(result.solicitud).toBe(solicitudPendiente);
  });

  it("freezes the configured fee on the row, in minor units", async () => {
    const createOrReusePendiente = jest
      .fn()
      .mockResolvedValue(solicitudPendiente);
    const { service } = buildService({
      createOrReusePendiente,
      lawyerFeeArsMinor: 5_000_000,
    });

    await service.requestForCaso("caso-1", "user-a");

    expect(createOrReusePendiente).toHaveBeenCalledWith({
      casoId: "caso-1",
      solicitanteId: "user-a",
      montoMinor: 5_000_000,
      moneda: "ARS",
    });
  });

  /**
   * The row stores minor units and the gateway prices in major ones. Sending
   * 5_000_000 to Mercado Pago would charge fifty million pesos.
   */
  it("charges the gateway in major units, converted from the frozen minor amount", async () => {
    const createOneOffPreference = jest
      .fn()
      .mockResolvedValue({ id: "pref-1", initPoint: "https://mp/checkout" });
    const { service } = buildService({ createOneOffPreference });

    await service.requestForCaso("caso-1", "user-a");

    expect(createOneOffPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: "lawreq_solicitud-1",
        precio: 50_000,
        moneda: "ARS",
      }),
    );
  });

  it("quotes the price stored on a reused solicitud, not today's configured fee", async () => {
    const createOneOffPreference = jest
      .fn()
      .mockResolvedValue({ id: "pref-1", initPoint: "https://mp/checkout" });
    const { service } = buildService({
      createOrReusePendiente: jest
        .fn()
        .mockResolvedValue({ ...solicitudPendiente, monto_minor: 4_000_000 }),
      createOneOffPreference,
      lawyerFeeArsMinor: 5_000_000,
    });

    await service.requestForCaso("caso-1", "user-a");

    expect(createOneOffPreference).toHaveBeenCalledWith(
      expect.objectContaining({ precio: 40_000 }),
    );
  });

  it("stores the preference id against the solicitud", async () => {
    const persistPreference = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({ persistPreference });

    await service.requestForCaso("caso-1", "user-a");

    expect(persistPreference).toHaveBeenCalledWith("solicitud-1", "pref-1");
  });

  it("blocks a non-member before creating anything", async () => {
    const createOrReusePendiente = jest.fn();
    const { service } = buildService({
      createOrReusePendiente,
      assertMembership: jest
        .fn()
        .mockRejectedValue(
          new HttpException(
            { code: "caso_not_found", message: "Case not found" },
            404,
          ),
        ),
    });

    await expect(
      service.requestForCaso("caso-1", "outsider"),
    ).rejects.toMatchObject({ status: 404 });
    expect(createOrReusePendiente).not.toHaveBeenCalled();
  });
});

describe("AbogadoService.getForCaso", () => {
  it("returns the caso's latest solicitud to a member", async () => {
    const { service } = buildService({
      findLatestByCaso: jest.fn().mockResolvedValue(solicitudPendiente),
    });

    await expect(service.getForCaso("caso-1", "user-a")).resolves.toBe(
      solicitudPendiente,
    );
  });

  it("answers solicitud_abogado_not_found when the caso never had one", async () => {
    const { service } = buildService({
      findLatestByCaso: jest.fn().mockResolvedValue(undefined),
    });

    await expect(service.getForCaso("caso-1", "user-a")).rejects.toMatchObject({
      status: 404,
      response: { code: "solicitud_abogado_not_found" },
    });
  });
});

describe("AbogadoService.settlePayment", () => {
  it("settles the row the external reference points at", async () => {
    const settleByReference = jest.fn().mockResolvedValue(solicitudPendiente);
    const { service } = buildService({ settleByReference });

    await service.settlePayment({
      externalReference: "lawreq_solicitud-1",
      mpPaymentId: "mp-1",
      approved: true,
    });

    expect(settleByReference).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: "lawreq_solicitud-1",
        mpPaymentId: "mp-1",
        approved: true,
      }),
    );
  });

  /**
   * A redelivered webhook finds nothing pending. Throwing would make Mercado
   * Pago redeliver the same settled event again.
   */
  it("resolves quietly when there is no pending row left to settle", async () => {
    const { service } = buildService({
      settleByReference: jest.fn().mockResolvedValue(undefined),
    });

    await expect(
      service.settlePayment({
        externalReference: "lawreq_solicitud-1",
        mpPaymentId: "mp-1",
        approved: true,
      }),
    ).resolves.toBeUndefined();
  });
});
