import i18n from '@/i18n';
import { useEffect } from 'react';

function resolveHtmlLang(): string {
  const lng = i18n.language;
  if (lng === 'es-AR' || lng === 'es') return 'es-AR';
  return 'en';
}

export function useDocumentLang(): void {
  useEffect(() => {
    document.documentElement.lang = resolveHtmlLang();

    const handler = () => {
      document.documentElement.lang = resolveHtmlLang();
    };

    i18n.on('languageChanged', handler);

    return () => {
      i18n.off('languageChanged', handler);
    };
  }, []);
}
