import type { UpdateProfileDto } from "./me.types";

/**
 * Everything a caller may change about themselves. `rol`, `email`, `activo`,
 * `estudio_id` and `verif_biometrica` are deliberately absent: they are
 * privilege or identity fields and must never be settable from a self-service
 * patch.
 */
export function pickUpdatableProfileFields(
  patch: UpdateProfileDto,
): UpdateProfileDto {
  const result: UpdateProfileDto = {};
  if (patch.nombre !== undefined) {
    result.nombre = patch.nombre;
  }
  if (patch.apellido !== undefined) {
    result.apellido = patch.apellido;
  }
  if (patch.telefono !== undefined) {
    result.telefono = patch.telefono;
  }
  if (patch.idioma !== undefined) {
    result.idioma = patch.idioma;
  }
  return result;
}
