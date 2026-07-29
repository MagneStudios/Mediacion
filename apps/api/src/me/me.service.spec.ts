import { HttpException } from "@nestjs/common";
import type { AuthenticatedUser, MeProfile } from "../auth/authenticated-user";
import type { UsersRepository } from "../auth/users.repository";
import { MeService } from "./me.service";

function buildProfile(overrides: Partial<MeProfile>): MeProfile {
  return {
    id: "user-1",
    rol: "parte" satisfies AuthenticatedUser["rol"],
    nombre: "Ana",
    apellido: "Diaz",
    email: "a@b.com",
    telefono: null,
    idioma: "es",
    verif_biometrica: "pendiente",
    estudio_id: null,
    activo: true,
    ...overrides,
  };
}

describe("MeService", () => {
  it("delegates to the repository's profile lookup using the caller's id", async () => {
    const profile = buildProfile({});
    const findProfileById = jest.fn().mockResolvedValue(profile);
    const usersRepository = { findProfileById } as unknown as UsersRepository;
    const service = new MeService(usersRepository);

    const result = await service.findOwnProfile("user-1");

    expect(findProfileById).toHaveBeenCalledWith("user-1");
    expect(result).toBe(profile);
  });

  it("returns undefined when the repository finds no row", async () => {
    const findProfileById = jest.fn().mockResolvedValue(undefined);
    const usersRepository = { findProfileById } as unknown as UsersRepository;
    const service = new MeService(usersRepository);

    const result = await service.findOwnProfile("missing-user");

    expect(result).toBeUndefined();
  });

  describe("updateOwnProfile", () => {
    function buildService(updateProfileById: jest.Mock) {
      const usersRepository = {
        findProfileById: jest.fn(),
        updateProfileById,
      } as unknown as UsersRepository;
      return new MeService(usersRepository);
    }

    it("updates the caller's own row and returns the refreshed profile", async () => {
      const updated = buildProfile({ nombre: "Ana Maria" });
      const updateProfileById = jest.fn().mockResolvedValue(updated);
      const service = buildService(updateProfileById);

      const result = await service.updateOwnProfile("user-1", {
        nombre: "Ana Maria",
      });

      expect(updateProfileById).toHaveBeenCalledWith("user-1", {
        nombre: "Ana Maria",
      });
      expect(result).toBe(updated);
    });

    it("strips rol from the patch, so a parte cannot escalate to admin", async () => {
      const updateProfileById = jest.fn().mockResolvedValue(buildProfile({}));
      const service = buildService(updateProfileById);

      await service.updateOwnProfile("user-1", {
        nombre: "Ana",
        rol: "admin",
      } as never);

      expect(updateProfileById).toHaveBeenCalledWith("user-1", {
        nombre: "Ana",
      });
    });

    it("rejects a patch that carries only non-updatable fields with 400 no_updatable_fields", async () => {
      const updateProfileById = jest.fn();
      const service = buildService(updateProfileById);

      let thrown: unknown;
      try {
        await service.updateOwnProfile("user-1", { rol: "admin" } as never);
      } catch (error) {
        thrown = error;
      }

      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(JSON.stringify((thrown as HttpException).getResponse())).toContain(
        "no_updatable_fields",
      );
      expect(updateProfileById).not.toHaveBeenCalled();
    });

    it("rejects an empty patch without touching the repository", async () => {
      const updateProfileById = jest.fn();
      const service = buildService(updateProfileById);

      await expect(
        service.updateOwnProfile("user-1", {}),
      ).rejects.toBeInstanceOf(HttpException);
      expect(updateProfileById).not.toHaveBeenCalled();
    });

    it("rejects a blank nombre before touching the repository", async () => {
      const updateProfileById = jest.fn();
      const service = buildService(updateProfileById);

      let thrown: unknown;
      try {
        await service.updateOwnProfile("user-1", { nombre: "   " });
      } catch (error) {
        thrown = error;
      }

      expect((thrown as HttpException).getStatus()).toBe(400);
      expect(updateProfileById).not.toHaveBeenCalled();
    });

    it("accepts an explicit null telefono so the caller can clear it", async () => {
      const updateProfileById = jest.fn().mockResolvedValue(buildProfile({}));
      const service = buildService(updateProfileById);

      await service.updateOwnProfile("user-1", { telefono: null });

      expect(updateProfileById).toHaveBeenCalledWith("user-1", {
        telefono: null,
      });
    });

    it("returns 404 profile_not_found when the row disappeared", async () => {
      const updateProfileById = jest.fn().mockResolvedValue(undefined);
      const service = buildService(updateProfileById);

      let thrown: unknown;
      try {
        await service.updateOwnProfile("ghost", { nombre: "Ana" });
      } catch (error) {
        thrown = error;
      }

      expect((thrown as HttpException).getStatus()).toBe(404);
    });
  });
});
