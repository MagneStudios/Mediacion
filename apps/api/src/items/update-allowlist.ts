import type { UpdateItemDto } from "./items.types";

export function pickUpdatableFields(patch: UpdateItemDto): UpdateItemDto {
  const result: UpdateItemDto = {};
  if (patch.categoria !== undefined) {
    result.categoria = patch.categoria;
  }
  if (patch.nombre !== undefined) {
    result.nombre = patch.nombre;
  }
  if (patch.descripcion !== undefined) {
    result.descripcion = patch.descripcion;
  }
  if (patch.valor_min !== undefined) {
    result.valor_min = patch.valor_min;
  }
  if (patch.valor_max !== undefined) {
    result.valor_max = patch.valor_max;
  }
  if (patch.puede_ceder !== undefined) {
    result.puede_ceder = patch.puede_ceder;
  }
  if (patch.condiciones_cesion !== undefined) {
    result.condiciones_cesion = patch.condiciones_cesion;
  }
  return result;
}
