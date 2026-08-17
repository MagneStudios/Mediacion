import { HttpException, Logger } from "@nestjs/common";
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
    findVigenteByOwner?: jest.Mock;
    cancelActiva?: jest.Mock;
    restoreActiva?: jest.Mock;
    cancelSubscription?: jest.Mock;
    send?: jest.Mock;
  }) {
    const suscripcionesRepository = {
      createSuscripcion: options?.createSuscripcion ?? jest.fn(),
      findOwnershipById: options?.findOwnershipById ?? jest.fn(),
      findVigenteByOwner: options?.findVigenteByOwner ?? jest.fn(),
      cancelActiva: options?.cancelActiva ?? jest.fn(),
      restoreActiva: options?.restoreActiva ?? jest.fn(),
    } as unknown as SuscripcionesRepository;
    const usersRepository = {
      findProfileById: options?.findProfileById ?? jest.fn(),
    } as unknown as UsersRepository;
    const mercadoPagoClient = {
      cancelSubscription:
        options?.cancelSubscription ??
        jest.fn().mockResolvedValue({ cancelled: true }),
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

  describe("getVigente", () => {
    it("resolves the caller's own suscripcion with normalized timestamps", async () => {
      const findVigenteByOwner = jest.fn().mockResolvedValue({
        id: "sus-1",
        plan_id: "plan-1",
        estado: "activa",
        fecha_inicio: new Date("2026-08-01T00:00:00.000Z"),
        fecha_fin: null,
      });
      const findProfileById = jest.fn().mockResolvedValue({ estudio_id: null });
      const { service } = buildService({
        findVigenteByOwner,
        findProfileById,
      });

      await expect(service.getVigente("user-1")).resolves.toEqual({
        id: "sus-1",
        plan_id: "plan-1",
        estado: "activa",
        fecha_inicio: "2026-08-01T00:00:00.000Z",
        fecha_fin: null,
      });
      expect(findVigenteByOwner).toHaveBeenCalledWith({
        usuarioId: "user-1",
        estudioId: null,
      });
    });

    it("resolves titularidad through the estudio, the same criterion as the baja", async () => {
      const findVigenteByOwner = jest.fn().mockResolvedValue({
        id: "sus-2",
        plan_id: "plan-2",
        estado: "activa",
        fecha_inicio: new Date("2026-08-01T00:00:00.000Z"),
        fecha_fin: null,
      });
      const findProfileById = jest.fn().mockResolvedValue({
        estudio_id: "estudio-1",
        rol: "estudio",
        activo: true,
      });
      const { service } = buildService({
        findVigenteByOwner,
        findProfileById,
      });

      await service.getVigente("user-1");

      expect(findVigenteByOwner).toHaveBeenCalledWith({
        usuarioId: "user-1",
        estudioId: "estudio-1",
      });
    });

    it.each([
      [
        "a parte who merely carries the estudio_id",
        { rol: "parte", activo: true },
      ],
      ["a deactivated titular", { rol: "estudio", activo: false }],
    ])(
      "does not resolve the estudio's suscripcion for %s",
      async (_case, profile) => {
        // The trigger this cycle added requires rol = 'estudio' AND activo for
        // an estudio to CONTRACT. The read has to use the same criterion, or a
        // non-titular discovers the estudio's id here and cancels the plan of
        // every member through POST /suscripciones/:id/baja.
        const findVigenteByOwner = jest.fn().mockResolvedValue(undefined);
        const { service } = buildService({
          findVigenteByOwner,
          findProfileById: jest
            .fn()
            .mockResolvedValue({ estudio_id: "estudio-1", ...profile }),
        });

        await expect(service.getVigente("user-1")).rejects.toMatchObject({
          status: 404,
        });
        expect(findVigenteByOwner).toHaveBeenCalledWith({
          usuarioId: "user-1",
          estudioId: null,
        });
      },
    );

    it("keeps returning a suscripcion already dada de baja, with its fecha_fin", async () => {
      const findVigenteByOwner = jest.fn().mockResolvedValue({
        id: "sus-1",
        plan_id: "plan-1",
        estado: "cancelada",
        fecha_inicio: new Date("2026-08-01T00:00:00.000Z"),
        fecha_fin: new Date("2026-08-15T12:00:00.000Z"),
      });
      const { service } = buildService({
        findVigenteByOwner,
        findProfileById: jest.fn().mockResolvedValue(undefined),
      });

      await expect(service.getVigente("user-1")).resolves.toMatchObject({
        estado: "cancelada",
        fecha_fin: "2026-08-15T12:00:00.000Z",
      });
    });

    it("answers 404 suscripcion_not_found when the caller has none", async () => {
      const { service } = buildService({
        findVigenteByOwner: jest.fn().mockResolvedValue(undefined),
        findProfileById: jest.fn().mockResolvedValue(undefined),
      });

      await expect(service.getVigente("user-1")).rejects.toMatchObject({
        status: 404,
        response: { code: "suscripcion_not_found" },
      });
    });
  });

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
      const cancelSubscription = jest
        .fn()
        .mockResolvedValue({ cancelled: true });
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

    it("completes the local baja but warns when the gateway had nothing to cancel", async () => {
      const cancelSubscription = jest
        .fn()
        .mockResolvedValue({ cancelled: false });
      const restoreActiva = jest.fn();
      const { service } = buildService({
        findOwnershipById: jest.fn().mockResolvedValue(activa),
        cancelActiva: jest.fn().mockResolvedValue(cancelada),
        cancelSubscription,
        restoreActiva,
      });
      const warn = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);

      await expect(
        service.cancelSuscripcion(caller, "sus-1"),
      ).resolves.toMatchObject({ estado: "cancelada" });

      expect(restoreActiva).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("nothing to cancel at the gateway for sus-1"),
      );
      warn.mockRestore();
    });

    it("does not warn when the gateway did cancel something", async () => {
      const { service } = buildService({
        findOwnershipById: jest.fn().mockResolvedValue(activa),
        cancelActiva: jest.fn().mockResolvedValue(cancelada),
        cancelSubscription: jest.fn().mockResolvedValue({ cancelled: true }),
      });
      const warn = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);

      await service.cancelSuscripcion(caller, "sus-1");

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
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
      const cancelSubscription = jest
        .fn()
        .mockResolvedValue({ cancelled: true });
      const { service } = buildService({
        findOwnershipById: jest.fn().mockResolvedValue({
          ...activa,
          usuario_id: null,
          estudio_id: "estudio-1",
        }),
        findProfileById: jest.fn().mockResolvedValue({
          estudio_id: "estudio-1",
          rol: "estudio",
          activo: true,
        }),
        cancelActiva: jest.fn().mockResolvedValue(cancelada),
        cancelSubscription,
      });

      await service.cancelSuscripcion(caller, "sus-1");

      expect(cancelSubscription).toHaveBeenCalledWith("sus-1");
    });

    it.each([
      ["a parte of the owning estudio", { rol: "parte", activo: true }],
      ["a deactivated titular", { rol: "estudio", activo: false }],
    ])(
      "hides the estudio's suscripcion from %s behind a 404",
      async (_case, profile) => {
        const cancelActiva = jest.fn();
        const { service } = buildService({
          findOwnershipById: jest.fn().mockResolvedValue({
            ...activa,
            usuario_id: null,
            estudio_id: "estudio-1",
          }),
          findProfileById: jest
            .fn()
            .mockResolvedValue({ estudio_id: "estudio-1", ...profile }),
          cancelActiva,
        });

        await expect(
          service.cancelSuscripcion(caller, "sus-1"),
        ).rejects.toMatchObject({
          status: 404,
          response: { code: "suscripcion_not_found" },
        });
        expect(cancelActiva).not.toHaveBeenCalled();
      },
    );

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
