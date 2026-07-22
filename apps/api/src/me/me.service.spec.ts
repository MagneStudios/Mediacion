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
});
