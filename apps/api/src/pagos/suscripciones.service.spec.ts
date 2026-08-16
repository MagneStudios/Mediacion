import { HttpException } from "@nestjs/common";
import type { UsersRepository } from "../auth/users.repository";
import type { EmailProvider } from "../notificaciones/notificaciones.types";
import type { MercadoPagoClient } from "./mercadopago/mercado-pago-client";
import type { CreateSuscripcionDto } from "./pagos.types";
import type { SuscripcionesRepository } from "./suscripciones.repository";
import { SuscripcionesService } from "./suscripciones.service";

describe("SuscripcionesService", () => {
  function buildService(options?: {
    createSuscripcion?: jest.Mock;
    findProfileById?: jest.Mock;
    findOwnershipById?: jest.Mock;
    cancelActiva?: jest.Mock;
    restoreActiva?: jest.Mock;
    cancelSubscription?: jest.Mock;
    send?: jest.Mock;
  }) {
    const suscripcionesRepository = {
      createSuscripcion: options?.createSuscripcion ?? jest.fn(),
      findOwnershipById: options?.findOwnershipById ?? jest.fn(),
      cancelActiva: options?.cancelActiva ?? jest.fn(),
      restoreActiva: options?.restoreActiva ?? jest.fn(),
    } as unknown as SuscripcionesRepository;
    const usersRepository = {
      findProfileById: options?.findProfileById ?? jest.fn(),
    } as unknown as UsersRepository;
    const mercadoPagoClient = {
      cancelSubscription:
        options?.cancelSubscription ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as MercadoPagoClient;
    const emailProvider = {
      send: options?.send ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as EmailProvider;
    return {
      service: new SuscripcionesService(
        suscripcionesRepository,
        usersRepository,
        mercadoPagoClient,
        emailProvider,
      ),
      suscripcionesRepository,
      usersRepository,
      mercadoPagoClient,
      emailProvider,
    };
  }

  describe("createSuscripcion", () => {
    it("forces usuario_id to the caller id and ignores any usuario_id in the body", async () => {
      const createSuscripcion = jest.fn().mockResolvedValue({
        id: "sus-1",
        estado: "pendiente_pago",
      });
      const { service } = buildService({ createSuscripcion });
      const body = {
        plan_id: "plan-1",
        usuario_id: "attacker",
      } as unknown as CreateSuscripcionDto;

      const result = await service.createSuscripcion("caller-1", body);

      expect(createSuscripcion).toHaveBeenCalledWith({
        plan_id: "plan-1",
        usuario_id: "caller-1",
        estudio_id: null,
      });
      expect(result).toEqual({ id: "sus-1", estado: "pendiente_pago" });
    });

    it("creates an estudio subscription for the caller's own estudio", async () => {
      const createSuscripcion = jest.fn().mockResolvedValue({
        id: "sus-2",
        estado: "pendiente_pago",
      });
      const findProfileById = jest
        .fn()
        .mockResolvedValue({ estudio_id: "estudio-E" });
      const { service } = buildService({ createSuscripcion, findProfileById });
      const dto: CreateSuscripcionDto = {
        plan_id: "plan-1",
        estudio_id: "estudio-E",
      };

      const result = await service.createSuscripcion("caller-1", dto);

      expect(findProfileById).toHaveBeenCalledWith("caller-1");
      expect(createSuscripcion).toHaveBeenCalledWith({
        plan_id: "plan-1",
        usuario_id: null,
        estudio_id: "estudio-E",
      });
      expect(result).toEqual({ id: "sus-2", estado: "pendiente_pago" });
    });

    it("accepts a whitespace-padded estudio_id that matches the caller's own estudio and persists the trimmed value", async () => {
      const createSuscripcion = jest.fn().mockResolvedValue({
        id: "sus-3",
        estado: "pendiente_pago",
      });
      const findProfileById = jest
        .fn()
        .mockResolvedValue({ estudio_id: "estudio-E" });
      const { service } = buildService({ createSuscripcion, findProfileById });
      const dto: CreateSuscripcionDto = {
        plan_id: "plan-1",
        estudio_id: "  estudio-E  ",
      };

      const result = await service.createSuscripcion("caller-1", dto);

      expect(createSuscripcion).toHaveBeenCalledWith({
        plan_id: "plan-1",
        usuario_id: null,
        estudio_id: "estudio-E",
      });
      expect(result).toEqual({ id: "sus-3", estado: "pendiente_pago" });
    });

    it("rejects an estudio subscription for a different estudio than the caller's, creating no row", async () => {
      const createSuscripcion = jest.fn();
      const findProfileById = jest
        .fn()
        .mockResolvedValue({ estudio_id: "estudio-E" });
      const { service } = buildService({ createSuscripcion, findProfileById });
      const dto: CreateSuscripcionDto = {
        plan_id: "plan-1",
        estudio_id: "estudio-X",
      };

      let thrown: unknown;
      try {
        await service.createSuscripcion("caller-1", dto);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(403);
      expect(createSuscripcion).not.toHaveBeenCalled();
    });

    it("rejects an estudio subscription when the caller has no estudio, creating no row", async () => {
      const createSuscripcion = jest.fn();
      const findProfileById = jest.fn().mockResolvedValue({ estudio_id: null });
      const { service } = buildService({ createSuscripcion, findProfileById });
      const dto: CreateSuscripcionDto = {
        plan_id: "plan-1",
        estudio_id: "estudio-X",
      };

      let thrown: unknown;
      try {
        await service.createSuscripcion("caller-1", dto);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(403);
      expect(createSuscripcion).not.toHaveBeenCalled();
    });

    it("rejects an estudio subscription when the caller profile is missing, creating no row", async () => {
      const createSuscripcion = jest.fn();
      const findProfileById = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({ createSuscripcion, findProfileById });
      const dto: CreateSuscripcionDto = {
        plan_id: "plan-1",
        estudio_id: "estudio-X",
      };

      let thrown: unknown;
      try {
        await service.createSuscripcion("caller-1", dto);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(403);
      expect(createSuscripcion).not.toHaveBeenCalled();
    });
  });

  describe("cancelSuscripcion", () => {
    const caller = {
      id: "user-1",
      email: "ana@example.com",
      rol: "parte" as const,
    };

    const activa = {
      id: "sus-1",
      usuario_id: "user-1",
      estudio_id: null,
      estado: "activa" as const,
    };

    const cancelada = {
      id: "sus-1",
      estado: "cancelada" as const,
      fecha_fin: new Date("2026-08-15T12:00:00.000Z"),
    };

    it("cancels in the gateway and returns the cancelled subscription", async () => {
      const cancelSubscription = jest.fn().mockResolvedValue(undefined);
      const send = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({
        findOwnershipById: jest.fn().mockResolvedValue(activa),
        cancelActiva: jest.fn().mockResolvedValue(cancelada),
        cancelSubscription,
        send,
      });

      await expect(service.cancelSuscripcion(caller, "sus-1")).resolves.toEqual(
        {
          id: "sus-1",
          estado: "cancelada",
          fecha_fin: "2026-08-15T12:00:00.000Z",
        },
      );
      expect(cancelSubscription).toHaveBeenCalledWith("sus-1");
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "ana@example.com" }),
      );
    });

    it("hides someone else's subscription behind a 404", async () => {
      const cancelActiva = jest.fn();
      const { service } = buildService({
        findOwnershipById: jest
          .fn()
          .mockResolvedValue({ ...activa, usuario_id: "user-2" }),
        cancelActiva,
      });

      await expect(
        service.cancelSuscripcion(caller, "sus-1"),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "suscripcion_not_found" },
      });
      expect(cancelActiva).not.toHaveBeenCalled();
    });

    it("lets a member of the owning estudio cancel", async () => {
      const cancelSubscription = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({
        findOwnershipById: jest.fn().mockResolvedValue({
          ...activa,
          usuario_id: null,
          estudio_id: "estudio-1",
        }),
        findProfileById: jest.fn().mockResolvedValue({
          estudio_id: "estudio-1",
        }),
        cancelActiva: jest.fn().mockResolvedValue(cancelada),
        cancelSubscription,
      });

      await service.cancelSuscripcion(caller, "sus-1");

      expect(cancelSubscription).toHaveBeenCalledWith("sus-1");
    });

    it("returns 404 for an unknown subscription", async () => {
      const { service } = buildService({
        findOwnershipById: jest.fn().mockResolvedValue(undefined),
      });

      await expect(
        service.cancelSuscripcion(caller, "sus-1"),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("raises a conflict when the subscription is no longer activa", async () => {
      const { service } = buildService({
        findOwnershipById: jest
          .fn()
          .mockResolvedValue({ ...activa, estado: "cancelada" }),
        cancelActiva: jest.fn().mockResolvedValue(undefined),
      });

      await expect(
        service.cancelSuscripcion(caller, "sus-1"),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "conflict" },
      });
    });

    it("compensates the local cancellation when the gateway rejects it", async () => {
      const restoreActiva = jest.fn().mockResolvedValue(undefined);
      const send = jest.fn();
      const { service } = buildService({
        findOwnershipById: jest.fn().mockResolvedValue(activa),
        cancelActiva: jest.fn().mockResolvedValue(cancelada),
        restoreActiva,
        cancelSubscription: jest
          .fn()
          .mockRejectedValue(new Error("mercadopago down")),
        send,
      });

      await expect(service.cancelSuscripcion(caller, "sus-1")).rejects.toThrow(
        "mercadopago down",
      );
      expect(restoreActiva).toHaveBeenCalledWith("sus-1");
      expect(send).not.toHaveBeenCalled();
    });

    it("keeps the cancellation when only the confirmation email fails", async () => {
      const { service } = buildService({
        findOwnershipById: jest.fn().mockResolvedValue(activa),
        cancelActiva: jest.fn().mockResolvedValue(cancelada),
        send: jest.fn().mockRejectedValue(new Error("smtp down")),
      });

      await expect(
        service.cancelSuscripcion(caller, "sus-1"),
      ).resolves.toMatchObject({ estado: "cancelada" });
    });
  });
});
