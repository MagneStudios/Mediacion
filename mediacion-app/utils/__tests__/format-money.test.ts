import { formatMinorAmount } from '../format-money';

describe('formatMinorAmount', () => {
  it('reads minor units, so 4.000.000 are ARS 40.000', () => {
    // El spec §12 exige enteros de unidad minima. Interpretar el numero como
    // unidades enteras mostraria un precio cien veces mas caro.
    const shown = formatMinorAmount(4_000_000, 'ARS', 'es-AR');
    expect(shown).toContain('40');
    expect(shown).not.toContain('4.000.000');
  });

  it('uses the currency it was given, not a hardcoded one', () => {
    // La diferencia con formatPlanPrice, que fija USD para toda la app.
    expect(formatMinorAmount(3000, 'USD', 'en')).toContain('30');
    expect(formatMinorAmount(3000, 'USD', 'en')).not.toContain('ARS');
  });

  it('keeps cents when the amount actually has them', () => {
    expect(formatMinorAmount(1999, 'USD', 'en')).toContain('19.99');
  });

  it('falls back to something readable instead of throwing', () => {
    // Intl acepta cualquier codigo de tres letras, asi que hace falta uno
    // malformado para llegar al catch. El precio se sigue viendo: es lo unico
    // que no puede faltar en una pantalla que va a cobrar.
    expect(formatMinorAmount(4_000_000, 'X' as 'ARS', 'es-AR')).toContain('40000');
  });
});
