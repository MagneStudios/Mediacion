import { HttpException } from "@nestjs/common";
import type { CarpetasRepository } from "./carpetas.repository";
import type { EstudioMembershipService } from "./estudio-membership.service";
import type { EstudiosRepository } from "./estudios.repository";
import { EstudiosService } from "./estudios.service";
import type { CreateCarpetaDto } from "./estudios.types";

describe("EstudiosService", () => {
  function buildService(overrides?: {
    listCasosByCarpeta?: jest.Mock;
    createCarpeta?: jest.Mock;
    findOwn?: jest.Mock;
    updateMarcaConfig?: jest.Mock;
    assertEstudioAccess?: jest.Mock;
  }) {
    const carpetasRepository = {
      listCasosByCarpeta: overrides?.listCasosByCarpeta ?? jest.fn(),
      createCarpeta: overrides?.createCarpeta ?? jest.fn(),
    } as unknown as CarpetasRepository;
    const estudiosRepository = {
      findOwn: overrides?.findOwn ?? jest.fn(),
      updateMarcaConfig: overrides?.updateMarcaConfig ?? jest.fn(),
    } as unknown as EstudiosRepository;
    const membershipService = {
      assertEstudioAccess:
        overrides?.assertEstudioAccess ??
        jest.fn().mockResolvedValue("estudio-1"),
    } as unknown as EstudioMembershipService;
    return {
      service: new EstudiosService(
        carpetasRepository,
        estudiosRepository,
        membershipService,
      ),
      carpetasRepository,
      estudiosRepository,
      membershipService,
    };
  }

  describe("listCasos", () => {
    it("groups the flat rows by carpeta, with a null bucket for unfiled casos", async () => {
      const listCasosByCarpeta = jest.fn().mockResolvedValue([
        {
          id: "caso-1",
          nombre: "Divorcio",
          estado: "nuevo",
          metodo: "mediacion",
          created_at: "now",
          carpeta_id: "carpeta-1",
          carpeta_nombre: "Familia",
        },
        {
          id: "caso-2",
          nombre: "Sucesion",
          estado: "nuevo",
          metodo: "mediacion",
          created_at: "now",
          carpeta_id: "carpeta-1",
          carpeta_nombre: "Familia",
        },
        {
          id: "caso-3",
          nombre: "Laboral",
          estado: "nuevo",
          metodo: "negociacion",
          created_at: "now",
          carpeta_id: null,
          carpeta_nombre: null,
        },
      ]);
      const { service, membershipService } = buildService({
        listCasosByCarpeta,
      });

      const result = await service.listCasos("user-1", "estudio", "estudio-1");

      expect(membershipService.assertEstudioAccess).toHaveBeenCalledWith(
        "user-1",
        "estudio",
        "estudio-1",
      );
      expect(listCasosByCarpeta).toHaveBeenCalledWith("estudio-1");
      expect(result).toEqual([
        {
          carpeta: { id: "carpeta-1", nombre: "Familia" },
          casos: [
            {
              id: "caso-1",
              nombre: "Divorcio",
              estado: "nuevo",
              metodo: "mediacion",
              created_at: "now",
            },
            {
              id: "caso-2",
              nombre: "Sucesion",
              estado: "nuevo",
              metodo: "mediacion",
              created_at: "now",
            },
          ],
        },
        {
          carpeta: null,
          casos: [
            {
              id: "caso-3",
              nombre: "Laboral",
              estado: "nuevo",
              metodo: "negociacion",
              created_at: "now",
            },
          ],
        },
      ]);
    });

    it("omits the null bucket when every caso has a carpeta", async () => {
      const listCasosByCarpeta = jest.fn().mockResolvedValue([
        {
          id: "caso-1",
          nombre: "Divorcio",
          estado: "nuevo",
          metodo: "mediacion",
          created_at: "now",
          carpeta_id: "carpeta-1",
          carpeta_nombre: "Familia",
        },
      ]);
      const { service } = buildService({ listCasosByCarpeta });

      const result = await service.listCasos("user-1", "estudio", "estudio-1");

      expect(result).toHaveLength(1);
      expect(result[0]?.carpeta).toEqual({
        id: "carpeta-1",
        nombre: "Familia",
      });
    });

    it("propagates the 404 thrown by the isolation gate without touching the repository", async () => {
      const notFound = new HttpException(
        { code: "estudio_not_found", message: "Estudio not found" },
        404,
      );
      const assertEstudioAccess = jest.fn().mockRejectedValue(notFound);
      const listCasosByCarpeta = jest.fn();
      const { service } = buildService({
        assertEstudioAccess,
        listCasosByCarpeta,
      });

      let thrown: unknown;
      try {
        await service.listCasos("user-2", "estudio", "estudio-1");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(notFound);
      expect(listCasosByCarpeta).not.toHaveBeenCalled();
    });
  });

  describe("createCarpeta", () => {
    it("creates the carpeta under the asserted estudio and returns only its id", async () => {
      const createCarpeta = jest.fn().mockResolvedValue({
        id: "carpeta-1",
        estudio_id: "estudio-1",
        nombre: "Familia",
        created_at: "now",
        updated_at: "now",
      });
      const { service, membershipService } = buildService({ createCarpeta });
      const dto: CreateCarpetaDto = { nombre: "Familia" };

      const result = await service.createCarpeta(
        "user-1",
        "estudio",
        "estudio-1",
        dto,
      );

      expect(membershipService.assertEstudioAccess).toHaveBeenCalledWith(
        "user-1",
        "estudio",
        "estudio-1",
      );
      expect(createCarpeta).toHaveBeenCalledWith("estudio-1", "Familia");
      expect(result).toEqual({ id: "carpeta-1" });
    });

    it("rejects an empty nombre before touching the repository or the gate", async () => {
      const createCarpeta = jest.fn();
      const assertEstudioAccess = jest.fn();
      const { service } = buildService({
        createCarpeta,
        assertEstudioAccess,
      });

      let thrown: unknown;
      try {
        await service.createCarpeta("user-1", "estudio", "estudio-1", {
          nombre: "   ",
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(assertEstudioAccess).not.toHaveBeenCalled();
      expect(createCarpeta).not.toHaveBeenCalled();
    });
  });

  describe("getMarcaConfig", () => {
    it("returns the marca_config for the asserted estudio", async () => {
      const findOwn = jest.fn().mockResolvedValue({
        id: "estudio-1",
        nombre: "Estudio Uno",
        marca_config: { color: "#fff" },
        plan_id: null,
        activo: true,
        created_at: "now",
        updated_at: "now",
      });
      const { service, membershipService } = buildService({ findOwn });

      const result = await service.getMarcaConfig(
        "user-1",
        "estudio",
        "estudio-1",
      );

      expect(membershipService.assertEstudioAccess).toHaveBeenCalledWith(
        "user-1",
        "estudio",
        "estudio-1",
      );
      expect(findOwn).toHaveBeenCalledWith("estudio-1");
      expect(result).toEqual({ marca_config: { color: "#fff" } });
    });

    it("returns 404 when the asserted estudio row cannot be found", async () => {
      const findOwn = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({ findOwn });

      let thrown: unknown;
      try {
        await service.getMarcaConfig("admin-1", "admin", "estudio-missing");
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(404);
    });
  });

  describe("updateMarcaConfig", () => {
    it("replaces the marca_config for the asserted estudio", async () => {
      const updateMarcaConfig = jest.fn().mockResolvedValue({
        id: "estudio-1",
        nombre: "Estudio Uno",
        marca_config: { color: "#000" },
        plan_id: null,
        activo: true,
        created_at: "now",
        updated_at: "now",
      });
      const { service, membershipService } = buildService({
        updateMarcaConfig,
      });

      const result = await service.updateMarcaConfig(
        "user-1",
        "estudio",
        "estudio-1",
        { color: "#000" },
      );

      expect(membershipService.assertEstudioAccess).toHaveBeenCalledWith(
        "user-1",
        "estudio",
        "estudio-1",
      );
      expect(updateMarcaConfig).toHaveBeenCalledWith("estudio-1", {
        color: "#000",
      });
      expect(result).toEqual({ marca_config: { color: "#000" } });
    });

    it("rejects a non-object payload with 400 before touching the gate or the repository", async () => {
      const updateMarcaConfig = jest.fn();
      const assertEstudioAccess = jest.fn();
      const { service } = buildService({
        updateMarcaConfig,
        assertEstudioAccess,
      });

      let thrown: unknown;
      try {
        await service.updateMarcaConfig(
          "user-1",
          "estudio",
          "estudio-1",
          "not-an-object",
        );
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(assertEstudioAccess).not.toHaveBeenCalled();
      expect(updateMarcaConfig).not.toHaveBeenCalled();
    });

    it("rejects an array payload with 400", async () => {
      const { service } = buildService();

      let thrown: unknown;
      try {
        await service.updateMarcaConfig("user-1", "estudio", "estudio-1", [
          "a",
        ]);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
    });

    it("rejects an undefined payload with 400", async () => {
      const { service } = buildService();

      let thrown: unknown;
      try {
        await service.updateMarcaConfig(
          "user-1",
          "estudio",
          "estudio-1",
          undefined,
        );
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(400);
    });

    it("returns 404 when the asserted estudio row cannot be found", async () => {
      const updateMarcaConfig = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService({ updateMarcaConfig });

      let thrown: unknown;
      try {
        await service.updateMarcaConfig("admin-1", "admin", "estudio-missing", {
          color: "#000",
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      expect((thrown as HttpException).getStatus()).toBe(404);
    });
  });
});
