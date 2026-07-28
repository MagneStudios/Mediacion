import type { CategoriaItem } from "../items/items.types";
import { categoriasBase } from "./categorias";

type ListedCategoria = (typeof categoriasBase)[number];
type MissingFromList = Exclude<CategoriaItem, ListedCategoria>;
type NotACategoria = Exclude<ListedCategoria, CategoriaItem>;
type AssertNever<T extends never> = T;
type ListCoversEnum = AssertNever<MissingFromList | NotACategoria>;

describe("categoriasBase", () => {
  it("covers every categoria_item enum value — compile guard", () => {
    const guard: ListCoversEnum extends never ? true : false = true;
    expect(guard).toBe(true);
  });

  it("exposes the predefined base categories in load order", () => {
    expect(categoriasBase).toEqual([
      "cuidado_ninos",
      "cronogramas",
      "bienes",
      "economico",
      "personalizado",
    ]);
  });
});
