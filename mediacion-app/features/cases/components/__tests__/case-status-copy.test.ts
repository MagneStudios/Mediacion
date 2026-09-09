import en from '@/i18n/locales/en.json';
import esAR from '@/i18n/locales/es-AR.json';
import type { CaseStatusLabelKey } from '@/types/case';

/**
 * Toda clave de `CaseStatusLabelKey` necesita **dos** textos: la etiqueta del
 * chip (`cases.status.*`) y la línea de contexto de la tarjeta
 * (`cases.nextAction.*`). Ninguna de las dos la exige el compilador —son
 * lookups de i18n armados con template string— así que una clave nueva pasa
 * `tsc`, pasa los tests, y aparece **cruda en pantalla**.
 *
 * Este guard existe porque pasó dos veces: `awaitingSubscriptions` (04/09, con
 * el gate C-01) y `terminated` (09/09, con el fin autónomo de RN-08). Las dos
 * las encontró alguien mirando el navegador, no CI.
 *
 * La lista se escribe a mano y el `satisfies` la ata al tipo: si alguien suma
 * un miembro a `CaseStatusLabelKey` sin tocar acá, deja de compilar.
 */
const allStatusKeys = [
  'inReview',
  'proposalReady',
  'signed',
  'terminated',
  'awaitingCounterparty',
  'awaitingSubscriptions',
  'expired',
] as const satisfies readonly CaseStatusLabelKey[];

describe('copy de estados de caso', () => {
  it.each(allStatusKeys)('%s tiene chip y línea de contexto en los dos idiomas', (key) => {
    for (const [name, bundle] of [['es-AR', esAR], ['en', en]] as const) {
      const status = (bundle.cases.status as Record<string, string>)[key];
      const nextAction = (bundle.cases.nextAction as Record<string, string>)[key];

      // El mensaje nombra el idioma para que el fallo diga cuál de los dos
      // bundles quedó corto, en vez de sólo "undefined".
      expect(status ?? `FALTA cases.status.${key} en ${name}`).toBeTruthy();
      expect(nextAction ?? `FALTA cases.nextAction.${key} en ${name}`).toBeTruthy();
      expect(typeof status).toBe('string');
      expect(typeof nextAction).toBe('string');
    }
  });
});
