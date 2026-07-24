import { HttpException } from "@nestjs/common";
import type { UsersRepository } from "../auth/users.repository";
import type { CreateSuscripcionDto } from "./pagos.types";
import type { SuscripcionesRepository } from "./suscripciones.repository";
import { SuscripcionesService } from "./suscripciones.service";

describe("SuscripcionesService", () => {
  function buildService(options?: {
    createSuscripcion?: jest.Mock;
    findProfileById?: jest.Mock;
  }) {
    const suscripcionesRepository = {
      createSuscripcion: options?.createSuscripcion ?? jest.fn(),
    } as unknown as SuscripcionesRepository;
    const usersRepository = {
      findProfileById: options?.findProfileById ?? jest.fn(),
    } as unknown as UsersRepository;
    return {
      service: new SuscripcionesService(
        suscripcionesRepository,
        usersRepository,
      ),
      suscripcionesRepository,
      usersRepository,
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
});
