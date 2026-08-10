import type { LimitFieldValue, PlanInput } from '../types/plan';

export type PlanFormMessages = {
  nombreRequired: string;
  precioRequired: string;
  precioInvalid: string;
  limitRequired: string;
  limitInvalid: string;
  limitNegative: string;
};

export type PlanFormErrors = {
  nombreError?: string;
  precioError?: string;
  limiteCasosError?: string;
  limiteCarpetasError?: string;
  limiteIteracionesIaError?: string;
};

function validateLimit(field: LimitFieldValue, messages: PlanFormMessages): string | undefined {
  if (field.unlimited) return undefined;
  const trimmed = field.value.trim();
  if (!trimmed) return messages.limitRequired;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return messages.limitInvalid;
  if (parsed < 0) return messages.limitNegative;
  return undefined;
}

/** Pure validation for the R-10 admin plan form — shared by create and edit. */
export function validatePlanForm(
  nombre: string,
  precio: string,
  limiteCasos: LimitFieldValue,
  limiteCarpetas: LimitFieldValue,
  limiteIteracionesIa: LimitFieldValue,
  messages: PlanFormMessages,
): PlanFormErrors {
  const errors: PlanFormErrors = {};

  if (!nombre.trim()) {
    errors.nombreError = messages.nombreRequired;
  }

  const trimmedPrecio = precio.trim();
  if (!trimmedPrecio) {
    errors.precioError = messages.precioRequired;
  } else {
    const parsedPrecio = Number(trimmedPrecio.replace(',', '.'));
    if (!Number.isFinite(parsedPrecio) || parsedPrecio < 0) {
      errors.precioError = messages.precioInvalid;
    }
  }

  errors.limiteCasosError = validateLimit(limiteCasos, messages);
  errors.limiteCarpetasError = validateLimit(limiteCarpetas, messages);
  errors.limiteIteracionesIaError = validateLimit(limiteIteracionesIa, messages);

  return errors;
}

export function hasPlanFormErrors(errors: PlanFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** Only call once `validatePlanForm` reports no errors — trusts well-formed input, does not re-validate. */
export function toPlanInput(
  nombre: string,
  precio: string,
  limiteCasos: LimitFieldValue,
  limiteCarpetas: LimitFieldValue,
  limiteIteracionesIa: LimitFieldValue,
): PlanInput {
  return {
    nombre: nombre.trim(),
    precio: Number(precio.trim().replace(',', '.')),
    limiteCasos: limiteCasos.unlimited ? null : Number(limiteCasos.value.trim()),
    limiteCarpetas: limiteCarpetas.unlimited ? -1 : Number(limiteCarpetas.value.trim()),
    limiteIteracionesIa: limiteIteracionesIa.unlimited ? -1 : Number(limiteIteracionesIa.value.trim()),
  };
}
