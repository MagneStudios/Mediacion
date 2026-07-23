import type { CategoriaPosicion } from '../types/position';

export type PositionRangeMessages = {
  required: string;
  invalidNumber: string;
  minExceedsMax: string;
};

export type PositionRangeErrors = {
  minError?: string;
  maxError?: string;
};

/**
 * Category-sensitive range validation. Only `economico` is ever parsed and
 * ordered as a number — every other category only requires both fields to
 * be non-empty, since comparing free-text values (e.g. "fines de semana")
 * numerically or lexically would be meaningless and misrepresent the model.
 */
export function validatePositionRange(
  category: CategoriaPosicion,
  valueMin: string,
  valueMax: string,
  messages: PositionRangeMessages,
): PositionRangeErrors {
  const min = valueMin.trim();
  const max = valueMax.trim();
  const errors: PositionRangeErrors = {};

  if (!min) errors.minError = messages.required;
  if (!max) errors.maxError = messages.required;
  if (errors.minError || errors.maxError) return errors;

  if (category === 'economico') {
    const minNumber = Number(min.replace(',', '.'));
    const maxNumber = Number(max.replace(',', '.'));
    if (Number.isNaN(minNumber)) errors.minError = messages.invalidNumber;
    if (Number.isNaN(maxNumber)) errors.maxError = messages.invalidNumber;
    if (!errors.minError && !errors.maxError && minNumber > maxNumber) {
      errors.minError = messages.minExceedsMax;
    }
  }

  return errors;
}
