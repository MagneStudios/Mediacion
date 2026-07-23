import type { PreferredLanguage } from '../types/profile';

/**
 * The single place that translates the backend-aligned `usuarios.idioma`
 * value ('es' | 'en') to/from the i18next locale code ('es-AR' | 'en').
 * Never duplicate this mapping inside a component or hook.
 */
const IDIOMA_TO_LOCALE: Record<PreferredLanguage, string> = {
  es: 'es-AR',
  en: 'en',
};

export function idiomaToLocale(idioma: PreferredLanguage): string {
  return IDIOMA_TO_LOCALE[idioma];
}

export function localeToIdioma(locale: string): PreferredLanguage {
  return locale.startsWith('es') ? 'es' : 'en';
}
