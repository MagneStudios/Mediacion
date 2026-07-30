import type { UpdateProfileDto } from "./me.types";
import { pickUpdatableProfileFields } from "./profile-allowlist";

describe("pickUpdatableProfileFields", () => {
  it("keeps the four self-service fields", () => {
    const patch: UpdateProfileDto = {
      nombre: "Ana",
      apellido: "Perez",
      telefono: "+5491100000000",
      idioma: "es",
    };

    expect(pickUpdatableProfileFields(patch)).toEqual(patch);
  });

  it("drops rol, so a parte cannot promote itself to admin", () => {
    const patch = {
      nombre: "Ana",
      rol: "admin",
    } as unknown as UpdateProfileDto;

    const result = pickUpdatableProfileFields(patch);

    expect(result).toEqual({ nombre: "Ana" });
    expect(result).not.toHaveProperty("rol");
  });

  it("drops email, activo, estudio_id and verif_biometrica", () => {
    const patch = {
      email: "attacker@example.com",
      activo: false,
      estudio_id: "estudio-otro",
      verif_biometrica: true,
    } as unknown as UpdateProfileDto;

    expect(pickUpdatableProfileFields(patch)).toEqual({});
  });

  it("keeps an explicit null so a caller can clear an optional field", () => {
    const patch: UpdateProfileDto = { telefono: null };

    expect(pickUpdatableProfileFields(patch)).toEqual({ telefono: null });
  });

  it("omits absent keys rather than writing undefined over stored values", () => {
    const result = pickUpdatableProfileFields({ nombre: "Ana" });

    expect(Object.keys(result)).toEqual(["nombre"]);
  });
});
