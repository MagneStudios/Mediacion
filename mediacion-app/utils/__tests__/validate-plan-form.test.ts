import { hasPlanFormErrors, toPlanInput, validatePlanForm } from '../validate-plan-form';
import type { LimitFieldValue } from '../../types/plan';

const messages = {
  nombreRequired: 'nombre required',
  precioRequired: 'precio required',
  precioInvalid: 'precio invalid',
  limitRequired: 'limit required',
  limitInvalid: 'limit invalid',
  limitNegative: 'limit negative',
};

const unlimited: LimitFieldValue = { unlimited: true, value: '' };
const limited = (value: string): LimitFieldValue => ({ unlimited: false, value });

describe('validatePlanForm', () => {
  it('reports no errors for a fully valid, all-unlimited form', () => {
    const errors = validatePlanForm('estudio', '25.00', unlimited, unlimited, unlimited, messages);
    expect(hasPlanFormErrors(errors)).toBe(false);
  });

  it('reports no errors for a fully valid, all-limited form', () => {
    const errors = validatePlanForm('base', '0', limited('2'), limited('3'), limited('5'), messages);
    expect(hasPlanFormErrors(errors)).toBe(false);
  });

  it('requires a non-blank nombre', () => {
    const errors = validatePlanForm('   ', '10', unlimited, unlimited, unlimited, messages);
    expect(errors.nombreError).toBe('nombre required');
  });

  it('requires a precio', () => {
    const errors = validatePlanForm('base', '', unlimited, unlimited, unlimited, messages);
    expect(errors.precioError).toBe('precio required');
  });

  it('rejects a non-numeric precio', () => {
    const errors = validatePlanForm('base', 'abc', unlimited, unlimited, unlimited, messages);
    expect(errors.precioError).toBe('precio invalid');
  });

  it('rejects a negative precio', () => {
    const errors = validatePlanForm('base', '-5', unlimited, unlimited, unlimited, messages);
    expect(errors.precioError).toBe('precio invalid');
  });

  it('accepts precio 0 (the real base plan is free)', () => {
    const errors = validatePlanForm('base', '0', unlimited, unlimited, unlimited, messages);
    expect(errors.precioError).toBeUndefined();
  });

  it('never validates a limit field marked unlimited, whatever its stale value text is', () => {
    const staleUnlimited: LimitFieldValue = { unlimited: true, value: 'not a number' };
    const errors = validatePlanForm('base', '10', staleUnlimited, staleUnlimited, staleUnlimited, messages);
    expect(errors.limiteCasosError).toBeUndefined();
    expect(errors.limiteCarpetasError).toBeUndefined();
    expect(errors.limiteIteracionesIaError).toBeUndefined();
  });

  it('requires a value for a limited limit field', () => {
    const errors = validatePlanForm('base', '10', limited(''), unlimited, unlimited, messages);
    expect(errors.limiteCasosError).toBe('limit required');
  });

  it('rejects a non-integer limit', () => {
    const errors = validatePlanForm('base', '10', limited('2.5'), unlimited, unlimited, messages);
    expect(errors.limiteCasosError).toBe('limit invalid');
  });

  it('rejects a negative limit', () => {
    const errors = validatePlanForm('base', '10', limited('-1'), unlimited, unlimited, messages);
    expect(errors.limiteCasosError).toBe('limit negative');
  });

  it('validates each limit field independently', () => {
    const errors = validatePlanForm('base', '10', limited(''), limited('abc'), limited('-2'), messages);
    expect(errors.limiteCasosError).toBe('limit required');
    expect(errors.limiteCarpetasError).toBe('limit invalid');
    expect(errors.limiteIteracionesIaError).toBe('limit negative');
  });
});

describe('toPlanInput', () => {
  it('maps unlimited limiteCasos to null (R-10 sentinel)', () => {
    const input = toPlanInput('estudio', '25', unlimited, limited('0'), limited('0'));
    expect(input.limiteCasos).toBeNull();
  });

  it('maps unlimited limiteCarpetas/limiteIteracionesIa to -1 (pre-existing sentinel)', () => {
    const input = toPlanInput('plus', '19.99', unlimited, unlimited, unlimited);
    expect(input.limiteCarpetas).toBe(-1);
    expect(input.limiteIteracionesIa).toBe(-1);
  });

  it('parses concrete limit values as integers', () => {
    const input = toPlanInput('base', '0', limited('2'), limited('3'), limited('5'));
    expect(input).toEqual(
      expect.objectContaining({ limiteCasos: 2, limiteCarpetas: 3, limiteIteracionesIa: 5 }),
    );
  });

  it('trims nombre and parses a comma-decimal precio', () => {
    const input = toPlanInput('  base  ', '9,99', unlimited, unlimited, unlimited);
    expect(input.nombre).toBe('base');
    expect(input.precio).toBeCloseTo(9.99);
  });
});
