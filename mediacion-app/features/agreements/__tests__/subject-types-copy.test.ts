import en from '@/i18n/locales/en.json';
import esAR from '@/i18n/locales/es-AR.json';
import type { MateriaAcuerdo } from '@/types/negotiation';

/**
 * `subjectTypes.*` se busca con template string (`t(\`subjectTypes.${x}\`)`),
 * así que un miembro nuevo de `materia_acuerdo` sin copy pasa `tsc`, pasa los
 * tests y sale crudo en la fila de un documento legal. Mismo guard que
 * `case-status-copy.test.ts`, por el mismo motivo.
 *
 * `null` no está en la lista a propósito: no es una materia, es "modelo viejo",
 * y la pantalla cae al título del caso en vez de a una etiqueta.
 */
const allSubjectTypes = ['tenencia', 'alimentos', 'bienes', 'otro'] as const satisfies readonly MateriaAcuerdo[];

describe('copy de materias', () => {
  it.each(allSubjectTypes)('%s tiene etiqueta en los dos idiomas', (key) => {
    for (const [name, bundle] of [['es-AR', esAR], ['en', en]] as const) {
      const label = (bundle.subjectTypes as Record<string, string>)[key];
      expect(label ?? `FALTA subjectTypes.${key} en ${name}`).toBeTruthy();
      expect(typeof label).toBe('string');
    }
  });

  it('la fila de la bandeja tiene con qué armar "Materia · vN" en los dos idiomas', () => {
    for (const bundle of [esAR, en]) {
      expect(bundle.agreement.inbox.subjectVersion).toContain('{{subject}}');
      expect(bundle.agreement.inbox.subjectVersion).toContain('{{version}}');
    }
  });
});
