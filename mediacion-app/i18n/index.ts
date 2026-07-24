import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import esAR from './locales/es-AR.json';

export const defaultLocale = 'es-AR';
export const supportedLocales = ['es-AR', 'en'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

function resolveDeviceLocale(): SupportedLocale {
  const deviceLanguageCode = Localization.getLocales()[0]?.languageCode;
  return deviceLanguageCode === 'en' ? 'en' : defaultLocale;
}

void i18n.use(initReactI18next).init({
  resources: {
    'es-AR': { translation: esAR },
    en: { translation: en },
  },
  lng: resolveDeviceLocale(),
  fallbackLng: defaultLocale,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
