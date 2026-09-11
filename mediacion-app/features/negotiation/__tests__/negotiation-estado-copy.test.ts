import en from '@/i18n/locales/en.json';
import esAR from '@/i18n/locales/es-AR.json';
import type { EstadoNegociacion } from '@/types/negotiation';

/**
 * `negotiation.estado.*` se busca con template string, así que un miembro
 * nuevo de `estado_negociacion` sin copy pasa `tsc`, pasa los tests y sale
 * crudo en la tarjeta de la materia. Mismo guard que
 * `case-status-copy.test.ts`, por el mismo motivo.
 */
const allEstados = ['borrador', 'activa', 'acordada', 'cerrada', 'terminada'] as const satisfies readonly EstadoNegociacion[];

describe('copy de estados de negociación', () => {
  it.each(allEstados)('%s tiene etiqueta en los dos idiomas', (key) => {
    for (const [name, bundle] of [['es-AR', esAR], ['en', en]] as const) {
      const label = (bundle.negotiation.estado as Record<string, string>)[key];
      expect(label ?? `FALTA negotiation.estado.${key} en ${name}`).toBeTruthy();
      expect(typeof label).toBe('string');
    }
  });
});
