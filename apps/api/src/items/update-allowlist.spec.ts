import type { UpdateItemDto } from "./items.types";
import { pickUpdatableFields } from "./update-allowlist";

describe("pickUpdatableFields", () => {
  it("keeps only the allowlisted fields present in the patch", () => {
    const result = pickUpdatableFields({ nombre: "Bici", valor_min: "100" });

    expect(result).toEqual({ nombre: "Bici", valor_min: "100" });
  });

  it("strips parte_id, caso_id, id, privado, created_at and updated_at even if present on the raw object", () => {
    const maliciousPatch = {
      nombre: "Bici",
      parte_id: "user-b",
      caso_id: "other-case",
      id: "hijacked-id",
      privado: false,
      created_at: "2000-01-01",
      updated_at: "2000-01-01",
    } as unknown as UpdateItemDto;

    const result = pickUpdatableFields(maliciousPatch);

    expect(result).toEqual({ nombre: "Bici" });
    expect(result).not.toHaveProperty("parte_id");
    expect(result).not.toHaveProperty("caso_id");
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("privado");
    expect(result).not.toHaveProperty("created_at");
    expect(result).not.toHaveProperty("updated_at");
  });

  it("returns an empty object when the patch has no allowlisted fields", () => {
    expect(pickUpdatableFields({})).toEqual({});
  });

  it("omits allowlisted fields that are undefined rather than setting them explicitly", () => {
    const result = pickUpdatableFields({
      nombre: "Bici",
      descripcion: undefined,
    });

    expect(result).toEqual({ nombre: "Bici" });
    expect(result).not.toHaveProperty("descripcion");
  });
});
